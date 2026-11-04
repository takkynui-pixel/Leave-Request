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

-- กะทำงาน (ใช้ร่วมทุกบริษัท) — แก้เวลาได้ที่หน้าแอดมิน "ตั้งค่า"
--   start/end      = เวลาเริ่ม-เลิกงานของกะ (end <= start หมายถึงข้ามเที่ยงคืน เช่น 20:00-05:00)
--   open/close     = ช่วงเวลาที่ยื่นลา "ของวันนี้" ได้ (ยื่นล่วงหน้าวันอื่นได้ตลอดเวลา)
create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  start_time time not null,
  end_time   time not null,
  open_time  time not null default '00:00',
  close_time time not null default '23:59',
  sort_order int  not null default 0,
  constraint shifts_window_ok check (open_time <= close_time)
);

-- เวลาครึ่งแรก/ครึ่งหลังของกะ (เว้นว่าง = ตัดครึ่งเวลากะอัตโนมัติ) — ตั้งให้มีช่วงพักคั่นได้
alter table public.shifts add column if not exists half1_start time;
alter table public.shifts add column if not exists half1_end   time;
alter table public.shifts add column if not exists half2_start time;
alter table public.shifts add column if not exists half2_end   time;

alter table public.leave_requests add column if not exists shift_id uuid references public.shifts(id);
alter table public.leave_requests add column if not exists day_part text not null default 'full';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leave_day_part_ok') then
    alter table public.leave_requests
      add constraint leave_day_part_ok check (day_part in ('full','first_half','second_half','hours'));
  end if;
end $$;
-- ใบลาเดิมที่ระบุเวลา = ลาเป็นชั่วโมง
update public.leave_requests set day_part = 'hours' where start_time is not null and day_part = 'full';

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

-- ช่วงเวลาจริง (timestamp) ของการลาบางส่วน โดยยึด "วันที่เริ่มกะ" เป็นวันที่ลา
-- เวลาที่น้อยกว่าเวลาเริ่มกะ (เช่น 01:00 ของกะดึก) = หลังเที่ยงคืน นับเป็นวันถัดไป
create or replace function public.leave_span(d date, sh uuid, st time, et time)
returns tsrange language plpgsql stable set search_path = public as $$
declare s time; a timestamp; b timestamp;
begin
  select start_time into s from public.shifts where id = sh;
  a := d + st;
  if s is not null and st < s then a := a + interval '1 day'; end if;
  b := a + case when et > st then et - st else (et - st) + interval '24 hours' end;
  return tsrange(a, b, '[)');
end;
$$;

-- เวลาเซิร์ฟเวอร์ + กะทั้งหมด (Frontend ใช้เทียบ ไม่ใช้เวลาเครื่องพนักงาน)
create or replace function public.get_shift_windows()
returns json language sql volatile security definer set search_path = public as $$
  select json_build_object(
    'server_epoch_ms', (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'shifts', coalesce((
      select json_agg(json_build_object(
        'id', id, 'code', code, 'name', name,
        'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI'),
        'open',  to_char(open_time,  'HH24:MI'), 'close', to_char(close_time, 'HH24:MI'),
        'half1_start', to_char(half1_start, 'HH24:MI'), 'half1_end', to_char(half1_end, 'HH24:MI'),
        'half2_start', to_char(half2_start, 'HH24:MI'), 'half2_end', to_char(half2_end, 'HH24:MI')
      ) order by sort_order) from public.shifts), '[]'::json)
  );
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
  emp       public.employees%rowtype;
  lt        public.leave_types%rowtype;
  sh        public.shifts%rowtype;
  now_th    timestamp := (now() at time zone 'Asia/Bangkok');
  is_adm    boolean;
  shift_len interval;
  n_span    tsrange;
  sh_span   tsrange;
begin
  select * into emp from public.employees where id = new.employee_id;
  if not found then raise exception 'ไม่พบข้อมูลพนักงาน'; end if;

  select * into lt from public.leave_types where id = new.leave_type_id;
  if not found then raise exception 'ไม่พบประเภทการลา'; end if;

  if new.shift_id is null then raise exception 'กรุณาเลือกกะ'; end if;
  select * into sh from public.shifts where id = new.shift_id;
  if not found then raise exception 'ไม่พบกะที่เลือก'; end if;

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

    if new.start_date < now_th::date then
      raise exception 'ไม่สามารถแจ้งลาย้อนหลังได้ กรุณาติดต่อ Admin';
    end if;
    -- ลาของ "วันนี้" ยื่นได้เฉพาะช่วงเวลาเปิด-ปิดของกะนั้น (ล่วงหน้าวันอื่นยื่นได้ตลอด)
    if new.start_date = now_th::date
       and (now_th::time < sh.open_time or now_th::time > sh.close_time) then
      raise exception 'การลา%ของวันนี้ ยื่นได้เฉพาะเวลา % – % น. กรุณาติดต่อ Admin หรือหัวหน้างาน',
        sh.name, to_char(sh.open_time, 'HH24:MI'), to_char(sh.close_time, 'HH24:MI');
    end if;
  end if;

  if lt.requires_attachment and new.attachment_path is null then
    raise exception 'ประเภทการลานี้ต้องแนบเอกสาร';
  end if;
  if new.attachment_path is not null
     and split_part(new.attachment_path, '/', 1) <> new.employee_id::text then
    raise exception 'ไฟล์แนบไม่ถูกต้อง';
  end if;

  -- ความยาวของกะ (ข้ามเที่ยงคืนได้)
  shift_len := case when sh.end_time > sh.start_time then sh.end_time - sh.start_time
                    else (sh.end_time - sh.start_time) + interval '24 hours' end;

  -- รูปแบบการลา: เต็มกะ / ครึ่งแรก / ครึ่งหลัง / ระบุชั่วโมง
  if new.day_part = 'full' then
    new.start_time  := null;
    new.end_time    := null;
    new.total_days  := (new.end_date - new.start_date) + 1;
    new.total_hours := 0;
  elsif new.day_part in ('first_half','second_half','hours') then
    if new.end_date <> new.start_date then
      raise exception 'การลาครึ่งกะหรือรายชั่วโมง เลือกได้เฉพาะวันเดียว';
    end if;
    if new.day_part = 'first_half' then
      new.start_time := coalesce(sh.half1_start, sh.start_time);
      new.end_time   := coalesce(sh.half1_end,   sh.start_time + (shift_len / 2));
    elsif new.day_part = 'second_half' then
      new.start_time := coalesce(sh.half2_start, sh.start_time + (shift_len / 2));
      new.end_time   := coalesce(sh.half2_end,   sh.end_time);
    else
      if new.start_time is null or new.end_time is null then
        raise exception 'กรุณาระบุเวลาเริ่มและเวลาสิ้นสุดของการลา';
      end if;
      if new.start_time = new.end_time then raise exception 'เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน'; end if;
    end if;

    n_span  := public.leave_span(new.start_date, new.shift_id, new.start_time, new.end_time);
    sh_span := tsrange(new.start_date + sh.start_time, new.start_date + sh.start_time + shift_len, '[)');
    if not (n_span <@ sh_span) then
      raise exception 'เวลาที่ลาต้องอยู่ในช่วงเวลา% (% – % น.)',
        sh.name, to_char(sh.start_time, 'HH24:MI'), to_char(sh.end_time, 'HH24:MI');
    end if;

    if new.day_part = 'hours' then
      new.total_days  := 0;
      new.total_hours := round((extract(epoch from (upper(n_span) - lower(n_span))) / 3600.0)::numeric, 1);
    else
      new.total_days  := 0.5;
      new.total_hours := 0;
    end if;
  else
    raise exception 'รูปแบบการลาไม่ถูกต้อง';
  end if;

  -- ห้ามมีใบลาที่ซ้อนทับกัน (กันนับวันลาซ้ำในรายงาน)
  --   เต็มกะ = ชนทั้งวัน / ครึ่งกะ-รายชั่วโมง = ชนเฉพาะเมื่อช่วงเวลาทับกันจริง
  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = new.employee_id
      and r.status in ('submitted','approved')
      and (
        ((r.day_part = 'full' or new.day_part = 'full')
          and daterange(r.start_date, r.end_date, '[]') && daterange(new.start_date, new.end_date, '[]'))
        or
        (r.day_part <> 'full' and new.day_part <> 'full'
          and public.leave_span(r.start_date, r.shift_id, r.start_time, r.end_time) && n_span)
      )
  ) then
    raise exception 'มีใบลาที่ทับซ้อนกับช่วงวันและเวลานี้อยู่แล้ว';
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

-- ป้องกันการแก้คอลัมน์สำคัญ: แอดมินแก้ได้เฉพาะ status/admin_remark, พนักงานทำได้แค่ยกเลิกใบลาของตน (ดูเงื่อนไขด้านล่าง)
create or replace function public.leave_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare adm boolean;
begin
  if auth.uid() is null then return new; end if;   -- service_role

  adm := public.is_admin_of_company(old.company_id);

  if not adm then
    -- พนักงานยกเลิกได้: ใบที่รออนุมัติ หรือใบที่อนุมัติแล้วซึ่งยังไม่เริ่มก่อนวันนี้ (เช่น มาทำงานตามปกติ)
    if not (
      new.status = 'cancelled' and (
        old.status = 'submitted'
        or (old.status = 'approved' and old.start_date >= (now() at time zone 'Asia/Bangkok')::date)
      )
    ) then
      raise exception 'ไม่สามารถยกเลิกใบลานี้ได้ (ใบลาที่เริ่มไปแล้วหรือถูกปฏิเสธ กรุณาติดต่อ Admin)';
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
  new.shift_id         := old.shift_id;
  new.day_part         := old.day_part;

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

-- shifts
alter table public.shifts enable row level security;
drop policy if exists shifts_select on public.shifts;
drop policy if exists shifts_write  on public.shifts;
create policy shifts_select on public.shifts for select to authenticated using (true);
create policy shifts_write  on public.shifts for all to authenticated
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
  using (public.is_my_employee(employee_id) and status in ('submitted','approved'))
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
  public.is_my_active_employee(uuid), public.is_in_my_company(uuid), public.get_submit_window(uuid),
  public.get_shift_windows(), public.leave_span(date, uuid, time, time)
  from public, anon;
grant execute on function
  public.is_super_admin(), public.is_admin_of_company(uuid), public.is_my_employee(uuid),
  public.is_my_active_employee(uuid), public.is_in_my_company(uuid), public.get_submit_window(uuid),
  public.get_shift_windows(), public.leave_span(date, uuid, time, time)
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
  lr.id           as leave_request_id,
  -- เพิ่มต่อท้าย (ห้ามสลับลำดับคอลัมน์เดิม)
  sh.name         as shift_name,
  lr.day_part,
  case lr.day_part when 'full' then 1 when 'hours' then 0 else 0.5 end::numeric as leave_days,
  lr.start_time,
  lr.end_time
from public.leave_requests lr
join public.employees   e  on e.id  = lr.employee_id
join public.companies   c  on c.id  = lr.company_id
join public.leave_types lt on lt.id = lr.leave_type_id
left join public.shifts sh on sh.id = lr.shift_id
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

-- กะเริ่มต้น (แก้เวลาได้ที่หน้า "ตั้งค่า" ของแอดมิน): ยื่นลาของวันนี้ได้เฉพาะช่วง open–close
insert into public.shifts (code, name, start_time, end_time, open_time, close_time, sort_order) values
  ('day',   'กะเช้า', '08:00', '17:00', '05:00', '10:00', 1),
  ('night', 'กะดึก',  '20:00', '05:00', '17:00', '22:00', 2)
on conflict (code) do nothing;

-- ครึ่งกะเริ่มต้น (ตั้งเฉพาะแถวที่ยังไม่เคยตั้ง — แก้ได้ที่หน้า "ตั้งค่า")
update public.shifts set half1_start='08:00', half1_end='12:00', half2_start='13:00', half2_end='17:00'
  where code = 'day'   and half1_start is null and half2_start is null;
update public.shifts set half1_start='20:00', half1_end='00:00', half2_start='01:00', half2_end='05:00'
  where code = 'night' and half1_start is null and half2_start is null;

-- ---------------------------------------------------------------------
-- 8) สร้าง super_admin คนแรก (ทำครั้งเดียว)
--    1. Authentication → Users → Add user (อีเมล+รหัสผ่าน, ติ๊ก Auto Confirm)
--    2. แก้อีเมลด้านล่าง แล้วรัน:
--
-- insert into public.company_admins (user_id, company_id, role, full_name)
-- select id, null, 'super_admin', 'ชื่อแอดมิน' from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------
