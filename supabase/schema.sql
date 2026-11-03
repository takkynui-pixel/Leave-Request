-- =====================================================================
-- VTA Leave System — schema.sql  (Supabase / PostgreSQL)
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- รันซ้ำได้ (idempotent) ยกเว้นข้อมูลตัวอย่างท้ายไฟล์
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) TABLES
-- ---------------------------------------------------------------------

create table if not exists public.companies (
  id                uuid primary key default gen_random_uuid(),
  company_name      text not null unique,
  leave_cutoff_time time not null default '10:00',   -- แก้ได้จากหน้าแอดมิน (super_admin)
  created_at        timestamptz not null default now()
);

-- พนักงาน 1 แถว = พนักงาน 1 คน ณ บริษัทลูกค้า 1 แห่ง
-- เบอร์เดียวกันอยู่ได้หลายบริษัท (หลายแถว, user_id เดียวกัน)
create table if not exists public.employees (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  company_id    uuid not null references public.companies(id) on delete restrict,
  phone_number  text not null check (phone_number ~ '^[0-9]{9,15}$'),
  employee_code text not null,
  full_name     text not null,
  department    text,
  position      text,
  status        text not null default 'active' check (status in ('active','inactive')),
  created_at    timestamptz not null default now(),
  unique (company_id, employee_code),
  unique (company_id, phone_number)
);
create index if not exists employees_user_idx  on public.employees(user_id);
create index if not exists employees_phone_idx on public.employees(phone_number);

create table if not exists public.company_admins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  role       text not null check (role in ('company_admin','super_admin')),
  full_name  text not null,
  created_at timestamptz not null default now(),
  constraint company_admins_scope check (
    (role = 'super_admin'   and company_id is null) or
    (role = 'company_admin' and company_id is not null)
  )
);
create unique index if not exists company_admins_super_uq   on public.company_admins(user_id) where role = 'super_admin';
create unique index if not exists company_admins_company_uq on public.company_admins(user_id, company_id) where company_id is not null;

create table if not exists public.leave_types (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  requires_attachment boolean not null default false,
  sort_order          int not null default 0
);

create table if not exists public.leave_requests (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees(id) on delete restrict,
  company_id       uuid not null references public.companies(id),
  leave_type_id    uuid not null references public.leave_types(id),
  start_date       date not null,
  end_date         date not null,
  start_time       time,
  end_time         time,
  total_days       numeric(5,1) not null default 1,
  total_hours      numeric(5,1) not null default 0,
  reason           text not null check (length(btrim(reason)) > 0),
  attachment_path  text,                         -- path ใน bucket leave-documents
  status           text not null default 'submitted'
                   check (status in ('submitted','approved','rejected','cancelled')),
  submitted_at     timestamptz not null default now(),
  reviewed_by      uuid references auth.users(id),
  reviewed_by_name text,
  reviewed_at      timestamptz,
  admin_remark     text,
  constraint leave_dates_ok check (end_date >= start_date)
);
create index if not exists leave_company_date_idx  on public.leave_requests(company_id, start_date);
create index if not exists leave_employee_idx      on public.leave_requests(employee_id, start_date);
create index if not exists leave_status_idx        on public.leave_requests(status);

-- ---------------------------------------------------------------------
-- 2) HELPER FUNCTIONS (security definer — ใช้ใน RLS เพื่อเลี่ยง recursion)
-- ---------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_admins
                 where user_id = auth.uid() and role = 'super_admin');
$$;

create or replace function public.is_admin_of_company(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (select 1 from public.company_admins
                 where user_id = auth.uid() and role = 'company_admin' and company_id = cid);
$$;

create or replace function public.is_my_employee(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees where id = eid and user_id = auth.uid());
$$;

create or replace function public.is_my_active_employee(eid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees
                 where id = eid and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_in_my_company(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees where company_id = cid and user_id = auth.uid());
$$;

-- เวลาเซิร์ฟเวอร์ + เวลา cut-off ของบริษัท (Frontend ใช้เทียบ ไม่ใช้เวลาเครื่องพนักงาน)
create or replace function public.get_submit_window(p_company uuid)
returns json language plpgsql security definer set search_path = public as $$
declare c time;
begin
  if not (public.is_admin_of_company(p_company) or public.is_in_my_company(p_company)) then
    raise exception 'forbidden';
  end if;
  select coalesce(leave_cutoff_time, time '10:00') into c from public.companies where id = p_company;
  return json_build_object(
    'server_epoch_ms', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'cutoff', to_char(c, 'HH24:MI')
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3) TRIGGERS — กฎธุรกิจฝั่งฐานข้อมูล (กัน API ยิงตรง)
-- ---------------------------------------------------------------------

create or replace function public.leave_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  emp     public.employees%rowtype;
  lt      public.leave_types%rowtype;
  cutoff  time;
  now_th  timestamp := (now() at time zone 'Asia/Bangkok');
  is_adm  boolean;
begin
  select * into emp from public.employees where id = new.employee_id;
  if not found then raise exception 'ไม่พบข้อมูลพนักงาน'; end if;

  select * into lt from public.leave_types where id = new.leave_type_id;
  if not found then raise exception 'ไม่พบประเภทการลา'; end if;

  -- auth.uid() เป็น null = service_role / SQL editor (ระบบหลังบ้าน) ถือว่าเป็นแอดมิน
  is_adm := auth.uid() is null or public.is_admin_of_company(emp.company_id);

  new.company_id := emp.company_id;          -- ไม่เชื่อค่าจาก client

  if not is_adm then
    if emp.status <> 'active' then raise exception 'บัญชีพนักงานนี้ถูกปิดใช้งาน'; end if;

    new.status           := 'submitted';
    new.submitted_at     := now();
    new.reviewed_by      := null;
    new.reviewed_by_name := null;
    new.reviewed_at      := null;
    new.admin_remark     := null;

    select coalesce(c.leave_cutoff_time, time '10:00') into cutoff
      from public.companies c where c.id = emp.company_id;

    if new.start_date < now_th::date then
      raise exception 'ไม่สามารถแจ้งลาย้อนหลังได้ กรุณาติดต่อ Admin';
    end if;
    if new.start_date = now_th::date and now_th::time > cutoff then
      raise exception 'เกินเวลา % น. สำหรับการแจ้งลาของวันนี้ กรุณาติดต่อ Admin หรือหัวหน้างาน',
        to_char(cutoff, 'HH24:MI');
    end if;
  end if;

  if lt.requires_attachment and new.attachment_path is null then
    raise exception 'ประเภทการลานี้ต้องแนบเอกสาร';
  end if;
  if new.attachment_path is not null
     and split_part(new.attachment_path, '/', 1) <> new.employee_id::text then
    raise exception 'ไฟล์แนบไม่ถูกต้อง';
  end if;

  if (new.start_time is null) <> (new.end_time is null) then
    raise exception 'กรุณาระบุเวลาเริ่มและเวลาสิ้นสุดให้ครบ';
  end if;

  -- คำนวณจำนวนวัน/ชั่วโมง
  if new.start_time is not null and new.start_date = new.end_date then
    if new.end_time <= new.start_time then raise exception 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม'; end if;
    new.total_days  := 0;
    new.total_hours := round((extract(epoch from (new.end_time - new.start_time)) / 3600.0)::numeric, 1);
  else
    new.start_time  := null;
    new.end_time    := null;
    new.total_days  := (new.end_date - new.start_date) + 1;
    new.total_hours := 0;
  end if;

  -- ห้ามมีใบลาที่ซ้อนทับกัน (กันนับวันลาซ้ำในรายงาน)
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = new.employee_id
      and r.status in ('submitted','approved')
      and daterange(r.start_date, r.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'มีใบลาที่ทับซ้อนกับช่วงวันที่นี้อยู่แล้ว';
  end if;

  if new.status in ('approved','rejected') and auth.uid() is not null then
    new.reviewed_by      := auth.uid();
    new.reviewed_by_name := (select full_name from public.company_admins
                             where user_id = auth.uid() order by role limit 1);
    new.reviewed_at      := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_leave_cutoff on public.leave_requests;
drop trigger if exists leave_before_insert  on public.leave_requests;
create trigger leave_before_insert
  before insert on public.leave_requests
  for each row execute function public.leave_before_insert();

-- ป้องกันการแก้คอลัมน์สำคัญ: แอดมินแก้ได้เฉพาะ status/admin_remark, พนักงานทำได้แค่ยกเลิกใบลาของตนที่ยังรออนุมัติ
create or replace function public.leave_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  if auth.uid() is null then return new; end if;   -- service_role

  adm := public.is_admin_of_company(old.company_id);

  if not adm then
    if not (old.status = 'submitted' and new.status = 'cancelled') then
      raise exception 'ไม่สามารถแก้ไขใบลาได้ (ยกเลิกได้เฉพาะใบลาที่ยังรออนุมัติ)';
    end if;
    new.admin_remark := old.admin_remark;
  end if;

  new.employee_id      := old.employee_id;
  new.company_id       := old.company_id;
  new.leave_type_id    := old.leave_type_id;
  new.start_date       := old.start_date;
  new.end_date         := old.end_date;
  new.start_time       := old.start_time;
  new.end_time         := old.end_time;
  new.total_days       := old.total_days;
  new.total_hours      := old.total_hours;
  new.reason           := old.reason;
  new.attachment_path  := old.attachment_path;
  new.submitted_at     := old.submitted_at;

  if adm and new.status is distinct from old.status then
    if new.status in ('approved','rejected') then
      new.reviewed_by      := auth.uid();
      new.reviewed_by_name := (select full_name from public.company_admins
                               where user_id = auth.uid() order by role limit 1);
      new.reviewed_at      := now();
    elsif new.status = 'submitted' then
      new.reviewed_by := null; new.reviewed_by_name := null; new.reviewed_at := null;
    end if;
  else
    new.reviewed_by      := old.reviewed_by;
    new.reviewed_by_name := old.reviewed_by_name;
    new.reviewed_at      := old.reviewed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists leave_before_update on public.leave_requests;
create trigger leave_before_update
  before update on public.leave_requests
  for each row execute function public.leave_before_update();

-- ---------------------------------------------------------------------
-- 4) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.companies       enable row level security;
alter table public.employees       enable row level security;
alter table public.company_admins  enable row level security;
alter table public.leave_types     enable row level security;
alter table public.leave_requests  enable row level security;

-- companies
drop policy if exists companies_select on public.companies;
drop policy if exists companies_write  on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (public.is_admin_of_company(id) or public.is_in_my_company(id));
create policy companies_write on public.companies for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- employees  (พนักงานเห็นเฉพาะแถวตนเอง / แอดมินเห็นทั้งบริษัท / พนักงานแก้ข้อมูลตัวเองไม่ได้)
drop policy if exists employees_select on public.employees;
drop policy if exists employees_write  on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (user_id = auth.uid() or public.is_admin_of_company(company_id));
create policy employees_write on public.employees for all to authenticated
  using (public.is_admin_of_company(company_id))
  with check (public.is_admin_of_company(company_id));

-- company_admins
drop policy if exists company_admins_select on public.company_admins;
drop policy if exists company_admins_write  on public.company_admins;
create policy company_admins_select on public.company_admins for select to authenticated
  using (user_id = auth.uid() or public.is_super_admin());
create policy company_admins_write on public.company_admins for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- leave_types
drop policy if exists leave_types_select on public.leave_types;
drop policy if exists leave_types_write  on public.leave_types;
create policy leave_types_select on public.leave_types for select to authenticated using (true);
create policy leave_types_write  on public.leave_types for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- leave_requests
drop policy if exists leave_select       on public.leave_requests;
drop policy if exists leave_insert_emp   on public.leave_requests;
drop policy if exists leave_insert_admin on public.leave_requests;
drop policy if exists leave_update_emp   on public.leave_requests;
drop policy if exists leave_update_admin on public.leave_requests;
drop policy if exists leave_delete       on public.leave_requests;

create policy leave_select on public.leave_requests for select to authenticated
  using (public.is_my_employee(employee_id) or public.is_admin_of_company(company_id));

create policy leave_insert_emp on public.leave_requests for insert to authenticated
  with check (public.is_my_active_employee(employee_id));

create policy leave_insert_admin on public.leave_requests for insert to authenticated
  with check (exists (select 1 from public.employees e
                      where e.id = employee_id and public.is_admin_of_company(e.company_id)));

create policy leave_update_emp on public.leave_requests for update to authenticated
  using (public.is_my_employee(employee_id) and status = 'submitted')
  with check (public.is_my_employee(employee_id) and status = 'cancelled');

create policy leave_update_admin on public.leave_requests for update to authenticated
  using (public.is_admin_of_company(company_id))
  with check (public.is_admin_of_company(company_id));

create policy leave_delete on public.leave_requests for delete to authenticated
  using (public.is_super_admin());

-- ปิดสิทธิ์ anon และจำกัดการเรียกฟังก์ชัน
revoke all on all tables in schema public from anon;
revoke execute on function
  public.is_super_admin(), public.is_admin_of_company(uuid), public.is_my_employee(uuid),
  public.is_my_active_employee(uuid), public.is_in_my_company(uuid), public.get_submit_window(uuid)
  from public, anon;
grant execute on function
  public.is_super_admin(), public.is_admin_of_company(uuid), public.is_my_employee(uuid),
  public.is_my_active_employee(uuid), public.is_in_my_company(uuid), public.get_submit_window(uuid)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5) STORAGE — bucket private สำหรับใบรับรองแพทย์/เอกสารแนบ
--    path: {employee_id}/{uuid}.{ext}  (จำกัด 5MB: jpg/png/pdf)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leave-documents', 'leave-documents', false, 5242880,
        array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_leave_folder(folder text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id::text = folder
      and (e.user_id = auth.uid() or public.is_admin_of_company(e.company_id))
  );
$$;
revoke execute on function public.can_access_leave_folder(text) from public, anon;
grant  execute on function public.can_access_leave_folder(text) to authenticated, service_role;

drop policy if exists "leave docs read"   on storage.objects;
drop policy if exists "leave docs insert" on storage.objects;
drop policy if exists "leave docs delete" on storage.objects;

create policy "leave docs read" on storage.objects for select to authenticated
  using (bucket_id = 'leave-documents'
         and public.can_access_leave_folder((storage.foldername(name))[1]));
create policy "leave docs insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'leave-documents'
         and public.can_access_leave_folder((storage.foldername(name))[1]));
create policy "leave docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'leave-documents'
         and public.can_access_leave_folder((storage.foldername(name))[1]));

-- ---------------------------------------------------------------------
-- 6) REPORT VIEW — 1 แถว = 1 วันลา (เฉพาะใบลาที่อนุมัติแล้ว)
--    security_invoker => RLS ยังทำงาน: แอดมินบริษัทเห็นเฉพาะบริษัทตน, super_admin เห็นทั้งหมด
-- ---------------------------------------------------------------------

create or replace view public.leave_daily_report
with (security_invoker = true) as
select
  c.id            as company_id,
  c.company_name,
  e.employee_code,
  e.full_name,
  d::date         as leave_date,
  lt.name         as leave_type,
  lr.reason,
  lr.total_hours,
  lr.id           as leave_request_id
from public.leave_requests lr
join public.employees   e  on e.id  = lr.employee_id
join public.companies   c  on c.id  = lr.company_id
join public.leave_types lt on lt.id = lr.leave_type_id
cross join lateral generate_series(lr.start_date::timestamp, lr.end_date::timestamp, interval '1 day') d
where lr.status = 'approved';

revoke all on public.leave_daily_report from anon;
grant select on public.leave_daily_report to authenticated;

-- ---------------------------------------------------------------------
-- 7) SEED — ประเภทการลาตามแบบฟอร์ม HR-009/Rev.-02
-- ---------------------------------------------------------------------

insert into public.leave_types (code, name, requires_attachment, sort_order) values
  ('annual',        'ลาพักผ่อนประจำปี',                false, 1),
  ('sick_no_cert',  'ลาป่วย (ไม่มีใบรับรองแพทย์)',      false, 2),
  ('sick_cert',     'ลาป่วย (มีใบรับรองแพทย์)',         true,  3),
  ('personal',      'ลากิจส่วนตัว',                     false, 4),
  ('personal_paid', 'ลากิจได้รับค่าจ้าง (แนบเอกสาร)',   true,  5),
  ('other',         'ลาอื่นๆ',                          false, 6)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------
-- 8) สร้าง super_admin คนแรก (ทำครั้งเดียว)
--    1. Authentication → Users → Add user (อีเมล+รหัสผ่าน, ติ๊ก Auto Confirm)
--    2. แก้อีเมลด้านล่าง แล้วรัน:
--
-- insert into public.company_admins (user_id, company_id, role, full_name)
-- select id, null, 'super_admin', 'ชื่อแอดมิน' from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------
