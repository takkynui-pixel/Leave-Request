import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client — bypass RLS. ใช้ใน Server Action เท่านั้น
 * และต้องตรวจสิทธิ์ผู้เรียก (is_admin_of_company / is_super_admin) ก่อนทุกครั้ง
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
