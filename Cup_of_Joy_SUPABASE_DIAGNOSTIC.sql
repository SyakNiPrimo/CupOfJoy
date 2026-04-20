-- Cup of Joy Supabase Diagnostic
-- Run this in Supabase SQL Editor if employee onboarding fails.

select
  'owner_profile' as check_name,
  exists (
    select 1
    from public.profiles
    where id = 'ee11a4c9-7e33-4aa2-9e00-e89d68d9c1b4'
      and email = 'benedick.tiaga04@gmail.com'
      and role = 'owner'
      and is_active = true
  ) as ok;

select
  'default_shifts' as check_name,
  count(*) as count
from public.shifts
where is_active = true;

select
  'admin_create_employee_rpc' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_create_employee'
  ) as ok;

select
  'attendance_rpc' as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'record_attendance_scan'
  ) as ok;

select
  'storage_buckets' as check_name,
  count(*) as count
from storage.buckets
where id in ('attendance-selfies', 'payment-proofs');
