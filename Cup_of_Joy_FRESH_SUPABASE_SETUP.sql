create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.business_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius_m integer not null default 120,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_number text unique,
  full_name text not null,
  employee_email text,
  phone_number text,
  qr_token_value text unique,
  portal_auth_user_id uuid unique references auth.users(id) on delete set null,
  role_name text,
  qr_token_hash text not null unique,
  first_week_daily_rate numeric(10,2) not null default 250,
  base_daily_rate numeric(10,2) not null default 300,
  loan_feature_enabled boolean not null default false,
  contract_status text not null default 'not_sent' check (contract_status in ('not_sent', 'pending_signature', 'signed', 'expired')),
  contract_sent_at timestamptz,
  contract_due_at timestamptz,
  contract_signed_at timestamptz,
  contract_document_path text,
  contract_signed_copy_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.employees
add column if not exists employee_email text,
add column if not exists phone_number text,
add column if not exists qr_token_value text unique,
add column if not exists portal_auth_user_id uuid references auth.users(id) on delete set null,
add column if not exists loan_feature_enabled boolean not null default false,
add column if not exists first_week_daily_rate numeric(10,2) not null default 250,
add column if not exists contract_status text not null default 'not_sent' check (contract_status in ('not_sent', 'pending_signature', 'signed', 'expired')),
add column if not exists contract_sent_at timestamptz,
add column if not exists contract_due_at timestamptz,
add column if not exists contract_signed_at timestamptz,
add column if not exists contract_document_path text,
add column if not exists contract_signed_copy_path text,
alter column base_daily_rate set default 300;

update public.employees
set
  first_week_daily_rate = coalesce(first_week_daily_rate, 250),
  base_daily_rate = coalesce(base_daily_rate, 300);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  shift_name text not null unique,
  scheduled_start time not null,
  scheduled_end time not null,
  paid_hours numeric(4,2) not null default 8.00,
  grace_minutes integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.employee_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  effective_from date not null,
  effective_to date,
  work_days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
  created_at timestamptz not null default now()
);

alter table public.employee_shift_assignments
add column if not exists work_days text[] not null default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name_snapshot text not null,
  event_type text not null check (event_type in ('time_in', 'time_out')),
  scanned_at timestamptz not null default now(),
  local_date date,
  local_time time,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  location_id uuid references public.business_locations(id),
  location_name_snapshot text,
  distance_m integer,
  status text not null check (status in ('allowed', 'outside_radius')),
  minutes_late integer not null default 0,
  payroll_deduction numeric(10,2) not null default 0,
  selfie_path text not null,
  source_label text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance_log_corrections (
  id uuid primary key default gen_random_uuid(),
  attendance_log_id uuid not null references public.attendance_logs(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null check (event_type in ('time_in', 'time_out')),
  correction_type text not null check (correction_type in ('edit_log', 'manual_time_out')),
  old_scanned_at timestamptz,
  new_scanned_at timestamptz,
  old_local_date date,
  new_local_date date,
  old_local_time time,
  new_local_time time,
  old_minutes_late integer,
  new_minutes_late integer,
  old_payroll_deduction numeric(10,2),
  new_payroll_deduction numeric(10,2),
  reason text not null,
  corrected_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'admin', 'staff'));

create table if not exists public.access_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null check (role in ('owner', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create table if not exists public.sales_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique,
  employee_id uuid references public.employees(id) on delete set null,
  employee_number_snapshot text,
  employee_name_snapshot text,
  attendance_time_in_id uuid references public.attendance_logs(id) on delete set null,
  session_time_in_at timestamptz,
  payment_method text not null check (payment_method in ('cash', 'gcash', 'paymaya', 'bank_transfer')),
  total_amount numeric(10,2) not null,
  cash_received numeric(10,2),
  change_amount numeric(10,2) not null default 0,
  payment_proof_path text,
  local_date date not null,
  local_time time not null,
  source_label text,
  correction_count integer not null default 0,
  last_corrected_at timestamptz,
  last_correction_source text,
  created_at timestamptz not null default now()
);

alter table public.sales_transactions
add column if not exists correction_count integer not null default 0,
add column if not exists last_corrected_at timestamptz,
add column if not exists last_correction_source text;

create table if not exists public.sales_transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.sales_transactions(id) on delete cascade,
  item_id text not null,
  item_name text not null,
  category text,
  unit_price numeric(10,2) not null,
  quantity integer not null check (quantity > 0),
  line_total numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_transaction_corrections (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.sales_transactions(id) on delete cascade,
  requested_by_employee_id uuid references public.employees(id) on delete set null,
  authorized_by uuid references auth.users(id) on delete set null,
  correction_source text not null check (correction_source in ('admin', 'staff')),
  admin_pin_verified boolean not null default false,
  reason text not null,
  old_transaction_snapshot jsonb not null,
  new_transaction_snapshot jsonb not null,
  old_items_snapshot jsonb not null default '[]'::jsonb,
  new_items_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  cutoff_start date not null,
  cutoff_end date not null,
  payday date not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  overtime_status text not null default 'pending' check (overtime_status in ('pending', 'approved', 'rejected')),
  payment_method text check (payment_method in ('cash', 'gcash', 'bank_transfer')),
  payment_reference text,
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  overtime_reviewed_at timestamptz,
  overtime_reviewed_by uuid references auth.users(id) on delete set null,
  notes text,
  payslip_snapshot jsonb not null default '{}'::jsonb,
  payslip_stored_at timestamptz,
  payslip_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, cutoff_start, cutoff_end)
);

alter table public.payroll_payments
  add column if not exists overtime_status text not null default 'pending' check (overtime_status in ('pending', 'approved', 'rejected')),
  add column if not exists payment_method text check (payment_method in ('cash', 'gcash', 'bank_transfer')),
  add column if not exists payment_reference text,
  add column if not exists overtime_reviewed_at timestamptz,
  add column if not exists overtime_reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists payslip_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists payslip_stored_at timestamptz,
  add column if not exists payslip_expires_at timestamptz;

create table if not exists public.owner_settings (
  id integer primary key,
  loans_enabled boolean not null default false,
  sales_correction_pin_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = 1)
);

alter table public.owner_settings
add column if not exists sales_correction_pin_hash text;

insert into public.owner_settings (id, loans_enabled)
values (1, false)
on conflict (id) do nothing;

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_date date not null,
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled')),
  unpaid boolean not null default true,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, leave_date)
);

create table if not exists public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  principal_amount numeric(10,2) not null check (principal_amount > 0),
  outstanding_balance numeric(10,2) not null check (outstanding_balance >= 0),
  payment_terms text not null,
  agreement_html text not null,
  start_date date not null,
  status text not null default 'active' check (status in ('active', 'settled', 'cancelled')),
  issued_at timestamptz not null default now(),
  issued_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.employee_loans(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.termination_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_at timestamptz not null default now(),
  notice_days integer not null default 14 check (notice_days >= 7),
  requested_last_working_date date not null,
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'cancelled', 'completed')),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_attendance_logs_employee_id on public.attendance_logs(employee_id);
create index if not exists idx_attendance_logs_scanned_at on public.attendance_logs(scanned_at desc);
create index if not exists idx_attendance_logs_location_id on public.attendance_logs(location_id);
create index if not exists idx_employee_shift_assignments_employee_id on public.employee_shift_assignments(employee_id);
create index if not exists idx_sales_transactions_employee_id on public.sales_transactions(employee_id);
create index if not exists idx_sales_transactions_created_at on public.sales_transactions(created_at desc);
create index if not exists idx_sales_transaction_items_transaction_id on public.sales_transaction_items(transaction_id);
create index if not exists idx_sales_transaction_corrections_transaction_id on public.sales_transaction_corrections(transaction_id, created_at desc);
create index if not exists idx_attendance_log_corrections_attendance_log_id on public.attendance_log_corrections(attendance_log_id, created_at desc);
create index if not exists idx_employees_portal_auth_user_id on public.employees(portal_auth_user_id);
create index if not exists idx_access_invitations_status on public.access_invitations(status, created_at desc);
create index if not exists idx_payroll_payments_employee_cutoff on public.payroll_payments(employee_id, cutoff_start, cutoff_end);
create index if not exists idx_leave_requests_employee_date on public.leave_requests(employee_id, leave_date desc);
create index if not exists idx_employee_loans_employee_id on public.employee_loans(employee_id, issued_at desc);
create index if not exists idx_loan_repayments_loan_id on public.loan_repayments(loan_id, paid_at desc);
create index if not exists idx_termination_requests_employee_id on public.termination_requests(employee_id, requested_at desc);

alter table public.business_locations enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.employee_shift_assignments enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.attendance_log_corrections enable row level security;
alter table public.profiles enable row level security;
alter table public.sales_transactions enable row level security;
alter table public.sales_transaction_items enable row level security;
alter table public.sales_transaction_corrections enable row level security;
alter table public.payroll_payments enable row level security;
alter table public.owner_settings enable row level security;
alter table public.leave_requests enable row level security;
alter table public.employee_loans enable row level security;
alter table public.loan_repayments enable row level security;
alter table public.termination_requests enable row level security;
alter table public.access_invitations enable row level security;

revoke all on public.business_locations from anon, authenticated;
revoke all on public.employees from anon, authenticated;
revoke all on public.shifts from anon, authenticated;
revoke all on public.employee_shift_assignments from anon, authenticated;
revoke all on public.attendance_logs from anon, authenticated;
revoke all on public.attendance_log_corrections from anon, authenticated;
revoke all on public.sales_transactions from anon, authenticated;
revoke all on public.sales_transaction_items from anon, authenticated;
revoke all on public.sales_transaction_corrections from anon, authenticated;
revoke all on public.payroll_payments from anon, authenticated;
revoke all on public.owner_settings from anon, authenticated;
revoke all on public.leave_requests from anon, authenticated;
revoke all on public.employee_loans from anon, authenticated;
revoke all on public.loan_repayments from anon, authenticated;
revoke all on public.termination_requests from anon, authenticated;
revoke all on public.access_invitations from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.business_locations to authenticated;
grant select on public.employees to authenticated;
grant select on public.shifts to authenticated;
grant select on public.employee_shift_assignments to authenticated;
grant select on public.attendance_logs to authenticated;
grant select on public.sales_transactions to authenticated;
grant select on public.sales_transaction_items to authenticated;
grant select on public.sales_transaction_corrections to authenticated;
grant select on public.payroll_payments to authenticated;
grant select on public.owner_settings to authenticated;
grant select on public.leave_requests to authenticated;
grant select on public.employee_loans to authenticated;
grant select on public.loan_repayments to authenticated;
grant select on public.termination_requests to authenticated;
grant select on public.access_invitations to authenticated;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public, extensions
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('owner', 'admin')
      and is_active = true
  );
$$;

create or replace function public.resolve_staff_employee(
  p_qr_token text default null,
  p_allow_inactive boolean default false
)
returns public.employees
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_email text;
begin
  if trim(coalesce(p_qr_token, '')) <> '' then
    select *
    into v_employee
    from public.employees
    where qr_token_hash = encode(digest(trim(p_qr_token), 'sha256'), 'hex')
      and (p_allow_inactive or is_active = true)
    limit 1;

    return v_employee;
  end if;

  if auth.uid() is null then
    return null;
  end if;

  select lower(coalesce(email, ''))
  into v_email
  from auth.users
  where id = auth.uid();

  select *
  into v_employee
  from public.employees
  where (portal_auth_user_id = auth.uid() or lower(coalesce(employee_email, '')) = v_email)
    and (p_allow_inactive or is_active = true)
  order by case when portal_auth_user_id = auth.uid() then 0 else 1 end, created_at asc
  limit 1;

  if found and v_employee.portal_auth_user_id is distinct from auth.uid() then
    update public.employees
    set portal_auth_user_id = auth.uid()
    where id = v_employee.id
    returning * into v_employee;
  end if;

  return v_employee;
end;
$$;

create or replace function public.claim_staff_portal_access()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_email text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'message', 'Auth session required.');
  end if;

  select lower(coalesce(email, ''))
  into v_email
  from auth.users
  where id = auth.uid();

  select *
  into v_employee
  from public.employees
  where lower(coalesce(employee_email, '')) = v_email
  order by created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'No employee record found for this email.');
  end if;

  update public.employees
  set portal_auth_user_id = auth.uid()
  where id = v_employee.id
  returning * into v_employee;

  insert into public.profiles (id, email, full_name, role, is_active, updated_at)
  values (auth.uid(), v_email, v_employee.full_name, 'staff', true, now())
  on conflict (id)
  do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = 'staff',
    is_active = true,
    updated_at = now();

  return jsonb_build_object(
    'success', true,
    'employeeId', v_employee.id,
    'employeeNumber', v_employee.employee_number,
    'employeeName', v_employee.full_name,
    'isActive', v_employee.is_active,
    'contractStatus', v_employee.contract_status
  );
end;
$$;

create or replace function public.claim_management_access()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_invitation public.access_invitations;
  v_full_name text;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'message', 'Auth session required.');
  end if;

  select lower(coalesce(email, '')), coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name', split_part(email, '@', 1))
  into v_email, v_full_name
  from auth.users
  where id = auth.uid();

  select *
  into v_invitation
  from public.access_invitations
  where lower(email) = v_email
    and status in ('pending', 'claimed')
  order by created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'No management access invite found for this email.');
  end if;

  if v_invitation.status = 'claimed' and v_invitation.claimed_by is not null and v_invitation.claimed_by <> auth.uid() then
    return jsonb_build_object('success', false, 'message', 'This management invite is already claimed by another account.');
  end if;

  insert into public.profiles (id, email, full_name, role, is_active, updated_at)
  values (auth.uid(), v_email, v_full_name, v_invitation.role, true, now())
  on conflict (id)
  do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    role = v_invitation.role,
    is_active = true,
    updated_at = now();

  update public.access_invitations
  set
    status = 'claimed',
    claimed_by = auth.uid(),
    claimed_at = coalesce(claimed_at, now())
  where id = v_invitation.id
  returning * into v_invitation;

  return jsonb_build_object('success', true, 'role', v_invitation.role, 'email', v_invitation.email);
end;
$$;

create or replace function public.owner_management_accounts_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_accounts jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(account_rows) order by account_rows.role_priority asc, account_rows.created_at asc),
    '[]'::jsonb
  )
  into v_accounts
  from (
    select
      p.id,
      p.email,
      p.full_name,
      p.role,
      p.is_active,
      p.created_at,
      p.updated_at,
      case when p.role = 'owner' then 0 else 1 end as role_priority
    from public.profiles p
    where p.role in ('owner', 'admin')
  ) account_rows;

  return jsonb_build_object('success', true, 'accounts', v_accounts);
end;
$$;

create or replace function public.owner_remove_management_access(
  p_profile_id uuid,
  p_admin_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_target public.profiles;
  v_settings public.owner_settings;
  v_clean_pin text := trim(coalesce(p_admin_pin, ''));
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_profile_id is null then
    return jsonb_build_object('success', false, 'message', 'Management account is required.');
  end if;

  if auth.uid() = p_profile_id then
    return jsonb_build_object('success', false, 'message', 'You cannot delete your own management access from here.');
  end if;

  select *
  into v_settings
  from public.owner_settings
  where id = 1;

  if v_settings.sales_correction_pin_hash is null then
    return jsonb_build_object('success', false, 'message', 'Set the sales correction admin PIN first before deleting management accounts.');
  end if;

  if encode(digest(v_clean_pin, 'sha256'), 'hex') <> v_settings.sales_correction_pin_hash then
    return jsonb_build_object('success', false, 'message', 'Admin PIN is incorrect.');
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_profile_id
    and role = 'admin';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Only admin accounts can be permanently deleted here.');
  end if;

  update public.access_invitations
  set status = 'cancelled'
  where lower(email) = lower(coalesce(v_target.email, ''));

  delete from public.profiles
  where id = p_profile_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Admin access deleted permanently.',
    'removedEmail', v_target.email
  );
end;
$$;

create or replace function public.staff_portal_identity()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(null);

  if not found then
    return jsonb_build_object('success', false, 'message', 'No linked employee portal access found for this account.');
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'employeeEmail', v_employee.employee_email,
      'isActive', v_employee.is_active,
      'contractStatus', v_employee.contract_status
    )
  );
end;
$$;

create or replace function public.owner_access_invites_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invites jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(invite_rows) order by invite_rows.created_at desc),
    '[]'::jsonb
  )
  into v_invites
  from (
    select
      id,
      email,
      role,
      status,
      notes,
      created_at,
      claimed_at
    from public.access_invitations
    order by created_at desc
    limit 100
  ) invite_rows;

  return jsonb_build_object('success', true, 'invites', v_invites);
end;
$$;

create or replace function public.owner_create_access_invite(
  p_email text,
  p_role text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.access_invitations;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  if v_email = '' then
    return jsonb_build_object('success', false, 'message', 'Invite email is required.');
  end if;

  if v_role not in ('owner', 'admin') then
    return jsonb_build_object('success', false, 'message', 'Role must be owner or admin.');
  end if;

  insert into public.access_invitations (email, role, notes, invited_by, status)
  values (v_email, v_role, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), 'pending')
  on conflict (email)
  do update set
    role = excluded.role,
    notes = excluded.notes,
    invited_by = auth.uid(),
    status = 'pending',
    claimed_by = null,
    claimed_at = null,
    created_at = now()
  returning * into v_invitation;

  return jsonb_build_object('success', true, 'invite', row_to_json(v_invitation));
end;
$$;

create or replace function public.owner_cancel_access_invite(
  p_invite_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_invitation public.access_invitations;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  update public.access_invitations
  set status = 'cancelled'
  where id = p_invite_id
  returning * into v_invitation;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Invite not found.');
  end if;

  return jsonb_build_object('success', true, 'invite', row_to_json(v_invitation));
end;
$$;

drop policy if exists "profiles read own or owner" on public.profiles;
create policy "profiles read own or owner"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_owner());

drop policy if exists "owners read locations" on public.business_locations;
create policy "owners read locations"
on public.business_locations
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read employees" on public.employees;
create policy "owners read employees"
on public.employees
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read shifts" on public.shifts;
create policy "owners read shifts"
on public.shifts
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read shift assignments" on public.employee_shift_assignments;
create policy "owners read shift assignments"
on public.employee_shift_assignments
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read attendance" on public.attendance_logs;
create policy "owners read attendance"
on public.attendance_logs
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read sales transactions" on public.sales_transactions;
create policy "owners read sales transactions"
on public.sales_transactions
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read sales items" on public.sales_transaction_items;
create policy "owners read sales items"
on public.sales_transaction_items
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read sales corrections" on public.sales_transaction_corrections;
create policy "owners read sales corrections"
on public.sales_transaction_corrections
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read payroll payments" on public.payroll_payments;
create policy "owners read payroll payments"
on public.payroll_payments
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read owner settings" on public.owner_settings;
create policy "owners read owner settings"
on public.owner_settings
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read leave requests" on public.leave_requests;
create policy "owners read leave requests"
on public.leave_requests
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read employee loans" on public.employee_loans;
create policy "owners read employee loans"
on public.employee_loans
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read access invitations" on public.access_invitations;
create policy "owners read access invitations"
on public.access_invitations
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read loan repayments" on public.loan_repayments;
create policy "owners read loan repayments"
on public.loan_repayments
for select
to authenticated
using (public.is_owner());

drop policy if exists "owners read termination requests" on public.termination_requests;
create policy "owners read termination requests"
on public.termination_requests
for select
to authenticated
using (public.is_owner());

create or replace function public.create_employee_with_qr(
  p_full_name text,
  p_role_name text,
  p_raw_qr_token text,
  p_base_daily_rate numeric default null,
  p_employee_number text default null
)
returns public.employees
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_employee public.employees;
begin
  insert into public.employees (
    employee_number,
    full_name,
    role_name,
    qr_token_value,
    qr_token_hash,
    base_daily_rate
  )
  values (
    p_employee_number,
    p_full_name,
    p_role_name,
    p_raw_qr_token,
    encode(digest(p_raw_qr_token, 'sha256'), 'hex'),
    p_base_daily_rate
  )
  returning * into inserted_employee;

  return inserted_employee;
end;
$$;

create or replace function public.owner_reset_employee_qr(
  p_employee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_qr_token text;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  if p_employee_id is null then
    return jsonb_build_object('success', false, 'message', 'Employee is required.');
  end if;

  v_qr_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  update public.employees
  set
    qr_token_value = v_qr_token,
    qr_token_hash = encode(digest(v_qr_token, 'sha256'), 'hex')
  where id = p_employee_id
  returning * into v_employee;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'qrToken', v_qr_token
  );
end;
$$;

create or replace function public.next_employee_number()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  next_number integer;
begin
  select greatest(
    1000,
    coalesce(max(nullif(regexp_replace(employee_number, '[^0-9]', '', 'g'), '')::integer), 1000)
  ) + 1
  into next_number
  from public.employees;

  return next_number::text;
end;
$$;

create or replace function public.next_transaction_number()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  today_label text := to_char((now() at time zone 'Asia/Manila')::date, 'YYYYMMDD');
  next_number integer;
begin
  select coalesce(max(right(transaction_number, 4)::integer), 0) + 1
  into next_number
  from public.sales_transactions
  where transaction_number like 'COJ-' || today_label || '-%';

  return 'COJ-' || today_label || '-' || lpad(next_number::text, 4, '0');
end;
$$;

create or replace function public.cutoff_start_for(p_date date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::integer between 11 and 25 then (date_trunc('month', p_date)::date + interval '10 days')::date
    when extract(day from p_date)::integer >= 26 then (date_trunc('month', p_date)::date + interval '25 days')::date
    else (date_trunc('month', p_date)::date - interval '1 month' + interval '25 days')::date
  end;
$$;

create or replace function public.cutoff_end_for(p_date date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::integer between 11 and 25 then (date_trunc('month', p_date)::date + interval '24 days')::date
    when extract(day from p_date)::integer >= 26 then (date_trunc('month', p_date)::date + interval '1 month 9 days')::date
    else (date_trunc('month', p_date)::date + interval '9 days')::date
  end;
$$;

create or replace function public.payday_for_cutoff(p_date date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::integer between 11 and 25 then (
      date_trunc('month', p_date)::date
      + (least(29, extract(day from ((date_trunc('month', p_date)::date + interval '1 month - 1 day')::date))::integer - 1) * interval '1 day')
    )::date
    when extract(day from p_date)::integer >= 26 then (date_trunc('month', p_date)::date + interval '1 month 14 days')::date
    else (date_trunc('month', p_date)::date + interval '14 days')::date
  end;
$$;

create or replace view public.attendance_daily_rollup
with (security_invoker = true)
as
with day_events as (
  select
    employee_id,
    employee_name_snapshot,
    local_date,
    min(case when event_type = 'time_in' then local_time end) as first_time_in,
    max(case when event_type = 'time_out' then local_time end) as last_time_out,
    sum(minutes_late) as total_late_minutes,
    sum(payroll_deduction) as total_payroll_deduction
  from public.attendance_logs
  group by employee_id, employee_name_snapshot, local_date
)
select * from day_events;

drop view if exists public.cutoff_payroll_summary;
drop view if exists public.cutoff_session_summary;

create or replace view public.cutoff_session_summary
with (security_invoker = true)
as
with time_ins as (
  select
    logs.*,
    employees.employee_number,
    employees.first_week_daily_rate,
    employees.base_daily_rate
  from public.attendance_logs logs
  join public.employees employees on employees.id = logs.employee_id
  where logs.event_type = 'time_in'
),
paired as (
  select
    time_ins.*,
    time_out.id as time_out_id,
    time_out.scanned_at as time_out_at,
    time_out.local_time as time_out_local_time,
    time_out.location_name_snapshot as time_out_location,
    time_out.selfie_path as time_out_selfie_path
  from time_ins
  left join lateral (
    select out_logs.*
    from public.attendance_logs out_logs
    where out_logs.employee_id = time_ins.employee_id
      and out_logs.event_type = 'time_out'
      and out_logs.scanned_at > time_ins.scanned_at
    order by out_logs.scanned_at asc
    limit 1
  ) time_out on true
),
with_shift as (
  select
    paired.*,
    shifts.shift_name,
    shifts.paid_hours,
    shifts.scheduled_start,
    shifts.scheduled_end,
    shifts.assignment_start_date
  from paired
  left join lateral (
    select s.*
      , esa.effective_from as assignment_start_date
    from public.employee_shift_assignments esa
    join public.shifts s on s.id = esa.shift_id
    where esa.employee_id = paired.employee_id
      and esa.effective_from <= paired.local_date
      and (esa.effective_to is null or esa.effective_to >= paired.local_date)
    order by esa.effective_from desc
    limit 1
  ) shifts on true
),
calculated as (
  select
    employee_id,
    employee_number,
    employee_name_snapshot as employee_name,
    local_date as work_date,
    scanned_at as time_in_at,
    local_time as time_in_local_time,
    location_name_snapshot as time_in_location,
    selfie_path as time_in_selfie_path,
    minutes_late as late_minutes,
    payroll_deduction,
    time_out_at,
    time_out_local_time,
    time_out_location,
    time_out_selfie_path,
    case
      when time_out_at is null then null
      else greatest(0, floor(extract(epoch from (time_out_at - scanned_at)) / 60)::integer)
    end as worked_minutes,
    coalesce(paid_hours, 8.00) as paid_hours,
    coalesce(base_daily_rate, 0) as base_daily_rate,
    case
      when assignment_start_date is not null and local_date < assignment_start_date + 7 then coalesce(first_week_daily_rate, 250)
      else coalesce(base_daily_rate, 300)
    end as effective_daily_rate
  from with_shift
)
select
  employee_id,
  employee_number,
  employee_name,
  work_date,
  time_in_at,
  time_in_local_time,
  time_in_location,
  time_in_selfie_path,
  late_minutes,
  payroll_deduction,
  time_out_at,
  time_out_local_time,
  time_out_location,
  time_out_selfie_path,
  case
    when worked_minutes is null or late_minutes > 0 then 0
    when greatest(0, worked_minutes - round(paid_hours * 60)::integer) <= 60 then 0
    else greatest(0, worked_minutes - round(paid_hours * 60)::integer)
  end as overtime_minutes,
  round(
    case
      when worked_minutes is null or late_minutes > 0 then 0
      when greatest(0, worked_minutes - round(paid_hours * 60)::integer) <= 60 then 0
      else greatest(0, worked_minutes - round(paid_hours * 60)::integer) / 60.0
    end,
    2
  ) as overtime_hours,
  round(
    case
      when worked_minutes is null or paid_hours <= 0 or late_minutes > 0 then 0
      when greatest(0, worked_minutes - round(paid_hours * 60)::integer) <= 60 then 0
      else greatest(0, worked_minutes - round(paid_hours * 60)::integer) / 60.0 * (effective_daily_rate / paid_hours) * 1.25
    end,
    2
  ) as overtime_pay,
  coalesce(late_minutes = 0 and worked_minutes - round(paid_hours * 60)::integer > 60, false) as overtime_qualified,
  worked_minutes,
  round(coalesce(worked_minutes, 0) / 60.0, 2) as worked_hours,
  effective_daily_rate as daily_rate_applied,
  base_daily_rate,
  coalesce(time_out_at is not null and worked_minutes >= round(paid_hours * 60)::integer, false) as full_day_paid,
  round(
    case
      when time_out_at is not null and worked_minutes >= round(paid_hours * 60)::integer then effective_daily_rate
      else 0
    end,
    2
  ) as regular_pay,
  case when time_out_at is null then 'open' else 'completed' end as session_status,
  public.cutoff_start_for(work_date) as cutoff_start,
  public.cutoff_end_for(work_date) as cutoff_end,
  public.payday_for_cutoff(work_date) as payday,
  to_char(public.cutoff_start_for(work_date), 'Mon DD') || ' - ' || to_char(public.cutoff_end_for(work_date), 'Mon DD, YYYY') as cutoff_label
from calculated;

create or replace view public.cutoff_payroll_summary
with (security_invoker = true)
as
with summarized as (
  select
    employee_id,
    employee_number,
    employee_name,
    cutoff_start,
    cutoff_end,
    payday,
    cutoff_label,
    count(*)::integer as total_sessions,
    count(*) filter (where session_status = 'completed')::integer as completed_sessions,
    count(*) filter (where full_day_paid)::integer as paid_full_days,
    count(*) filter (where session_status = 'open')::integer as open_sessions,
    count(*) filter (where late_minutes = 0)::integer as on_time_days,
    count(*) filter (where late_minutes > 0)::integer as late_days,
    coalesce(sum(worked_minutes), 0)::integer as total_worked_minutes,
    round(coalesce(sum(worked_minutes), 0) / 60.0, 2) as total_worked_hours,
    coalesce(sum(late_minutes), 0)::integer as total_late_minutes,
    round(coalesce(sum(payroll_deduction), 0), 2) as total_payroll_deduction,
    coalesce(sum(overtime_minutes), 0)::integer as total_overtime_minutes,
    round(coalesce(sum(overtime_hours), 0), 2) as total_overtime_hours,
    round(coalesce(sum(overtime_pay), 0), 2) as total_overtime_pay,
    coalesce(sum(overtime_minutes), 0) > 0 as has_overtime,
    round(coalesce(max(base_daily_rate), 0), 2) as daily_rate,
    round(coalesce(sum(regular_pay), 0), 2) as gross_regular_pay,
    min(time_in_at) as first_session_in,
    max(time_out_at) as last_session_out
  from public.cutoff_session_summary
  group by employee_id, employee_number, employee_name, cutoff_start, cutoff_end, payday, cutoff_label
)
select
  summarized.*,
  case
    when coalesce(payments.overtime_status, 'pending') = 'approved' then summarized.total_overtime_pay
    else 0
  end as approved_overtime_pay,
  coalesce(payments.overtime_status, 'pending') as overtime_status,
  payments.overtime_reviewed_at,
  round(
    gross_regular_pay
    + case when coalesce(payments.overtime_status, 'pending') = 'approved' then summarized.total_overtime_pay else 0 end
    - total_payroll_deduction,
    2
  ) as net_pay,
  coalesce(payments.status, 'unpaid') as payroll_status,
  payments.payment_method,
  payments.payment_reference,
  payments.paid_at,
  payments.notes as payroll_notes,
  payments.payslip_stored_at,
  payments.payslip_expires_at
from summarized
left join public.payroll_payments payments
  on payments.employee_id = summarized.employee_id
  and payments.cutoff_start = summarized.cutoff_start
  and payments.cutoff_end = summarized.cutoff_end;

create or replace view public.sales_session_summary
with (security_invoker = true)
as
select
  employee_id,
  employee_number_snapshot as employee_number,
  employee_name_snapshot as employee_name,
  session_time_in_at,
  min(created_at) as first_sale_at,
  max(created_at) as last_sale_at,
  count(*)::integer as transaction_count,
  round(coalesce(sum(total_amount), 0), 2) as total_sales,
  round(coalesce(sum(total_amount) filter (where payment_method = 'cash'), 0), 2) as cash_sales,
  round(coalesce(sum(total_amount) filter (where payment_method <> 'cash'), 0), 2) as digital_sales
from public.sales_transactions
group by employee_id, employee_number_snapshot, employee_name_snapshot, session_time_in_at;

grant select on public.attendance_daily_rollup to authenticated;
grant select on public.cutoff_session_summary to authenticated;
grant select on public.cutoff_payroll_summary to authenticated;
grant select on public.sales_session_summary to authenticated;

insert into public.business_locations (name, latitude, longitude, allowed_radius_m, is_active)
values ('Cup of Joy Main Location', 16.218029203312543, 120.50345211124746, 120, true)
on conflict do nothing;

insert into public.shifts (shift_name, scheduled_start, scheduled_end, paid_hours, grace_minutes, is_active)
values
  ('Opening Shift', '08:00:00', '17:00:00', 8, 5, true),
  ('Mid Shift', '11:00:00', '20:00:00', 8, 5, true),
  ('Closing Shift', '15:00:00', '00:00:00', 8, 5, true)
on conflict (shift_name) do nothing;

insert into public.profiles (id, email, full_name, role, is_active)
values (
  'ee11a4c9-7e33-4aa2-9e00-e89d68d9c1b4',
  'benedick.tiaga04@gmail.com',
  'Benedick Tiaga',
  'owner',
  true
)
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'owner',
  is_active = true,
  updated_at = now();

insert into public.profiles (id, email, full_name, role, is_active)
select id, email, 'Benedick Tiaga', 'owner', true
from auth.users
where email = 'benedick.tiaga04@gmail.com'
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  role = 'owner',
  is_active = true,
  updated_at = now();

insert into storage.buckets (id, name, public)
values
  ('attendance-selfies', 'attendance-selfies', false),
  ('payment-proofs', 'payment-proofs', false),
  ('contract-documents', 'contract-documents', false),
  ('signed-contracts', 'signed-contracts', false)
on conflict (id) do nothing;

drop policy if exists "allow attendance selfie uploads" on storage.objects;
create policy "allow attendance selfie uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'attendance-selfies');

drop policy if exists "allow payment proof uploads" on storage.objects;
create policy "allow payment proof uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'payment-proofs');

drop policy if exists "allow signed contract uploads" on storage.objects;
create policy "allow signed contract uploads"
on storage.objects
for insert
to anon, authenticated
with check (bucket_id = 'signed-contracts');

drop policy if exists "allow contract document uploads" on storage.objects;
create policy "allow contract document uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'contract-documents');

drop policy if exists "allow contract document reads" on storage.objects;
create policy "allow contract document reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'contract-documents');

drop policy if exists "allow signed contract reads" on storage.objects;
create policy "allow signed contract reads"
on storage.objects
for select
to authenticated
using (bucket_id = 'signed-contracts');

create or replace function public.distance_meters(
  p_lat1 double precision,
  p_lon1 double precision,
  p_lat2 double precision,
  p_lon2 double precision
)
returns integer
language sql
immutable
as $$
  select round(
    6371000 * 2 * atan2(
      sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2) +
        cos(radians(p_lat1)) * cos(radians(p_lat2)) *
        power(sin(radians(p_lon2 - p_lon1) / 2), 2)
      ),
      sqrt(
        1 - (
          power(sin(radians(p_lat2 - p_lat1) / 2), 2) +
          cos(radians(p_lat1)) * cos(radians(p_lat2)) *
          power(sin(radians(p_lon2 - p_lon1) / 2), 2)
        )
      )
    )
  )::integer;
$$;

create or replace function public.record_attendance_scan(
  p_qr_token text,
  p_event_type text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_selfie_path text default null,
  p_source_label text default 'web-kiosk'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_location public.business_locations;
  v_distance integer;
  v_scanned_at timestamptz := now();
  v_local_date date := (now() at time zone 'Asia/Manila')::date;
  v_local_time time := (now() at time zone 'Asia/Manila')::time;
  v_day_key text := lower(trim(to_char((now() at time zone 'Asia/Manila')::date, 'dy')));
  v_shift record;
  v_shift_name text := null;
  v_late_minutes integer := 0;
  v_payroll_deduction numeric(10,2) := 0;
  v_attendance public.attendance_logs;
  v_open_session record;
  v_has_open_session boolean := false;
begin
  if p_qr_token is null or p_qr_token = '' or p_event_type not in ('time_in', 'time_out') or p_selfie_path is null or p_selfie_path = '' then
    return jsonb_build_object('success', false, 'message', 'Missing QR token, event type, or selfie.');
  end if;

  select *
  into v_employee
  from public.employees
  where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee QR code not recognized.');
  end if;

  if p_event_type = 'time_in' then
    if v_employee.contract_status = 'pending_signature'
      and v_employee.contract_due_at is not null
      and v_employee.contract_due_at < now() then
      update public.employees
      set contract_status = 'expired'
      where id = v_employee.id
      returning * into v_employee;
    end if;

    if coalesce(v_employee.contract_status, 'not_sent') <> 'signed' then
      return jsonb_build_object(
        'success', false,
        'message', 'Signed contract is required before the employee can time in.',
        'employeeId', v_employee.id,
        'employeeNumber', v_employee.employee_number,
        'employeeName', v_employee.full_name
      );
    end if;
  end if;

  select loc.*
  into v_location
  from public.business_locations loc
  where loc.is_active = true
  order by public.distance_meters(p_latitude, p_longitude, loc.latitude, loc.longitude)
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'No allowed business locations found.');
  end if;

  v_distance := public.distance_meters(p_latitude, p_longitude, v_location.latitude, v_location.longitude);

  if v_distance > v_location.allowed_radius_m then
    return jsonb_build_object(
      'success', false,
      'message', 'You are outside the allowed radius for ' || v_location.name || '. Move closer and try again.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'locationName', v_location.name,
      'distanceM', v_distance,
      'status', 'outside_radius'
    );
  end if;

  select time_in.*
  into v_open_session
  from public.attendance_logs time_in
  where time_in.employee_id = v_employee.id
    and time_in.event_type = 'time_in'
    and not exists (
      select 1
      from public.attendance_logs time_out
      where time_out.employee_id = time_in.employee_id
        and time_out.event_type = 'time_out'
        and time_out.scanned_at > time_in.scanned_at
    )
  order by time_in.scanned_at desc
  limit 1;

  v_has_open_session := found;

  if p_event_type = 'time_in' and v_has_open_session then
    return jsonb_build_object(
      'success', false,
      'message', 'This employee already has an active time-in session. Please time out first.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'status', 'already_timed_in'
    );
  end if;

  if p_event_type = 'time_out' and not v_has_open_session then
    return jsonb_build_object(
      'success', false,
      'message', 'No active time-in session found. Please time in first.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'status', 'no_active_session'
    );
  end if;

  if p_event_type = 'time_in' then
    select s.shift_name, s.scheduled_start, s.paid_hours, s.grace_minutes, esa.work_days
    into v_shift
    from public.employee_shift_assignments esa
    join public.shifts s on s.id = esa.shift_id
    where esa.employee_id = v_employee.id
      and esa.effective_from <= v_local_date
      and (esa.effective_to is null or esa.effective_to >= v_local_date)
    order by esa.effective_from desc
    limit 1;

    if not found or not (v_day_key = any(v_shift.work_days)) then
      return jsonb_build_object(
        'success', false,
        'message', 'No scheduled shift for this employee today. Please check the employee work days.',
        'employeeId', v_employee.id,
        'employeeNumber', v_employee.employee_number,
        'employeeName', v_employee.full_name
      );
    end if;

    v_late_minutes := greatest(
      0,
      floor(extract(epoch from (v_local_time - (v_shift.scheduled_start + make_interval(mins => v_shift.grace_minutes)))) / 60)::integer
    );

    if v_late_minutes > 0 and coalesce(v_employee.base_daily_rate, 0) > 0 and v_shift.paid_hours > 0 then
      v_payroll_deduction := round((v_employee.base_daily_rate / (v_shift.paid_hours * 60)) * v_late_minutes, 2);
    end if;

    v_shift_name := v_shift.shift_name;
  end if;

  insert into public.attendance_logs (
    employee_id,
    employee_name_snapshot,
    event_type,
    scanned_at,
    local_date,
    local_time,
    latitude,
    longitude,
    accuracy_m,
    location_id,
    location_name_snapshot,
    distance_m,
    status,
    minutes_late,
    payroll_deduction,
    selfie_path,
    source_label
  )
  values (
    v_employee.id,
    v_employee.full_name,
    p_event_type,
    v_scanned_at,
    v_local_date,
    v_local_time,
    p_latitude,
    p_longitude,
    p_accuracy,
    v_location.id,
    v_location.name,
    v_distance,
    'allowed',
    v_late_minutes,
    v_payroll_deduction,
    p_selfie_path,
    p_source_label
  )
  returning * into v_attendance;

  return jsonb_build_object(
    'success', true,
    'message', case when p_event_type = 'time_in' then 'Time in recorded successfully.' else 'Time out recorded successfully.' end,
    'employeeId', v_employee.id,
    'employeeNumber', v_employee.employee_number,
    'employeeName', v_employee.full_name,
    'eventType', p_event_type,
    'locationName', v_location.name,
    'distanceM', v_distance,
    'scannedAt', v_attendance.scanned_at,
    'status', 'allowed',
    'lateMinutes', v_late_minutes,
    'payrollDeduction', v_payroll_deduction,
    'shiftName', v_shift_name
  );
end;
$$;

create or replace function public.list_open_attendance_sessions()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sessions jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'employeeId', open_sessions.employee_id,
        'employeeNumber', open_sessions.employee_number,
        'employeeName', open_sessions.employee_name,
        'timeInAt', open_sessions.time_in_at
      )
      order by open_sessions.time_in_at desc
    ),
    '[]'::jsonb
  )
  into v_sessions
  from (
    select
      time_in.employee_id,
      employees.employee_number,
      employees.full_name as employee_name,
      time_in.scanned_at as time_in_at
    from public.attendance_logs time_in
    join public.employees employees on employees.id = time_in.employee_id
    where employees.is_active = true
      and time_in.event_type = 'time_in'
      and not exists (
        select 1
        from public.attendance_logs time_out
        where time_out.employee_id = time_in.employee_id
          and time_out.event_type = 'time_out'
          and time_out.scanned_at > time_in.scanned_at
      )
    order by time_in.scanned_at desc
  ) open_sessions;

  return jsonb_build_object('success', true, 'sessions', v_sessions);
end;
$$;

create or replace function public.record_attendance_time_out_by_employee(
  p_employee_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision default null,
  p_selfie_path text default null,
  p_source_label text default 'web-kiosk'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_location public.business_locations;
  v_distance integer;
  v_scanned_at timestamptz := now();
  v_local_date date := (now() at time zone 'Asia/Manila')::date;
  v_local_time time := (now() at time zone 'Asia/Manila')::time;
  v_open_session record;
  v_attendance public.attendance_logs;
begin
  if p_employee_id is null or p_selfie_path is null or p_selfie_path = '' then
    return jsonb_build_object('success', false, 'message', 'Missing employee or selfie.');
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Active employee not found.');
  end if;

  select loc.*
  into v_location
  from public.business_locations loc
  where loc.is_active = true
  order by public.distance_meters(p_latitude, p_longitude, loc.latitude, loc.longitude)
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'No allowed business locations found.');
  end if;

  v_distance := public.distance_meters(p_latitude, p_longitude, v_location.latitude, v_location.longitude);

  if v_distance > v_location.allowed_radius_m then
    return jsonb_build_object(
      'success', false,
      'message', 'You are outside the allowed radius for ' || v_location.name || '. Move closer and try again.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'locationName', v_location.name,
      'distanceM', v_distance,
      'status', 'outside_radius'
    );
  end if;

  select time_in.*
  into v_open_session
  from public.attendance_logs time_in
  where time_in.employee_id = v_employee.id
    and time_in.event_type = 'time_in'
    and not exists (
      select 1
      from public.attendance_logs time_out
      where time_out.employee_id = time_in.employee_id
        and time_out.event_type = 'time_out'
        and time_out.scanned_at > time_in.scanned_at
    )
  order by time_in.scanned_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'No active time-in session found. Please time in first.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'status', 'no_active_session'
    );
  end if;

  insert into public.attendance_logs (
    employee_id,
    employee_name_snapshot,
    event_type,
    scanned_at,
    local_date,
    local_time,
    latitude,
    longitude,
    accuracy_m,
    location_id,
    location_name_snapshot,
    distance_m,
    status,
    minutes_late,
    payroll_deduction,
    selfie_path,
    source_label
  )
  values (
    v_employee.id,
    v_employee.full_name,
    'time_out',
    v_scanned_at,
    v_local_date,
    v_local_time,
    p_latitude,
    p_longitude,
    p_accuracy,
    v_location.id,
    v_location.name,
    v_distance,
    'allowed',
    0,
    0,
    p_selfie_path,
    p_source_label
  )
  returning * into v_attendance;

  return jsonb_build_object(
    'success', true,
    'message', 'Time out recorded successfully.',
    'employeeId', v_employee.id,
    'employeeNumber', v_employee.employee_number,
    'employeeName', v_employee.full_name,
    'eventType', 'time_out',
    'locationName', v_location.name,
    'distanceM', v_distance,
    'scannedAt', v_attendance.scanned_at,
    'status', 'allowed'
  );
end;
$$;

create or replace function public.admin_create_employee(
  p_full_name text,
  p_role_name text,
  p_shift_id uuid,
  p_base_daily_rate numeric default 300,
  p_effective_from date default null,
  p_work_days text[] default array['mon', 'tue', 'wed', 'thu', 'fri'],
  p_first_week_daily_rate numeric default 250,
  p_employee_email text default null,
  p_phone_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_shift public.shifts;
  v_employee_number text;
  v_qr_token text;
  v_effective_from date := coalesce(p_effective_from, (now() at time zone 'Asia/Manila')::date);
  v_work_days text[] := coalesce(p_work_days, array['mon', 'tue', 'wed', 'thu', 'fri']);
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_full_name is null or trim(p_full_name) = '' then
    return jsonb_build_object('success', false, 'message', 'Employee name is required.');
  end if;

  if p_shift_id is null then
    return jsonb_build_object('success', false, 'message', 'Shift is required.');
  end if;

  if array_length(v_work_days, 1) is null then
    return jsonb_build_object('success', false, 'message', 'Choose at least one work day.');
  end if;

  if array_length(v_work_days, 1) > 5 then
    return jsonb_build_object('success', false, 'message', 'Employees are entitled to 2 rest days. Please choose up to 5 work days only.');
  end if;

  select * into v_shift from public.shifts where id = p_shift_id and is_active = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Selected shift was not found.');
  end if;

  v_employee_number := public.next_employee_number();
  v_qr_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  select *
  into v_employee
  from public.create_employee_with_qr(
    trim(p_full_name),
    coalesce(nullif(trim(p_role_name), ''), 'Staff'),
    v_qr_token,
    coalesce(p_base_daily_rate, 300),
    v_employee_number
  );

  update public.employees
  set
    employee_email = nullif(lower(trim(coalesce(p_employee_email, ''))), ''),
    phone_number = nullif(trim(coalesce(p_phone_number, '')), ''),
    first_week_daily_rate = coalesce(p_first_week_daily_rate, 250),
    base_daily_rate = coalesce(p_base_daily_rate, 300),
    contract_status = 'not_sent',
    contract_sent_at = null,
    contract_due_at = null,
    contract_signed_at = null,
    contract_signed_copy_path = null
  where id = v_employee.id
  returning * into v_employee;

  insert into public.employee_shift_assignments (employee_id, shift_id, effective_from, work_days)
  values (v_employee.id, v_shift.id, v_effective_from, v_work_days);

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'shift', row_to_json(v_shift),
    'qrToken', v_qr_token,
    'effectiveFrom', v_effective_from,
    'workDays', v_work_days
  );
end;
$$;

create or replace function public.owner_update_employee_terms(
  p_employee_id uuid,
  p_first_week_daily_rate numeric,
  p_base_daily_rate numeric,
  p_work_days text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_assignment public.employee_shift_assignments;
  v_work_days text[] := coalesce(p_work_days, array['mon', 'tue', 'wed', 'thu', 'fri']);
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_employee_id is null then
    return jsonb_build_object('success', false, 'message', 'Employee is required.');
  end if;

  if coalesce(p_first_week_daily_rate, -1) < 0 or coalesce(p_base_daily_rate, -1) < 0 then
    return jsonb_build_object('success', false, 'message', 'Rates must be zero or greater.');
  end if;

  if array_length(v_work_days, 1) is null then
    return jsonb_build_object('success', false, 'message', 'Choose at least one work day.');
  end if;

  if array_length(v_work_days, 1) > 5 then
    return jsonb_build_object('success', false, 'message', 'Employees are entitled to 2 rest days. Please choose up to 5 work days only.');
  end if;

  update public.employees
  set
    first_week_daily_rate = coalesce(p_first_week_daily_rate, 250),
    base_daily_rate = coalesce(p_base_daily_rate, 300)
  where id = p_employee_id
  returning * into v_employee;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  update public.employee_shift_assignments
  set work_days = v_work_days
  where id = (
    select esa.id
    from public.employee_shift_assignments esa
    where esa.employee_id = p_employee_id
      and (esa.effective_to is null or esa.effective_to >= (now() at time zone 'Asia/Manila')::date)
    order by esa.effective_from desc
    limit 1
  )
  returning * into v_assignment;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Active shift assignment not found for this employee.');
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'assignment', row_to_json(v_assignment)
  );
end;
$$;

create or replace function public.owner_set_employee_active(
  p_employee_id uuid,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_has_open_session boolean := false;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_employee_id is null then
    return jsonb_build_object('success', false, 'message', 'Employee is required.');
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  if coalesce(p_is_active, v_employee.is_active) = v_employee.is_active then
    return jsonb_build_object(
      'success', true,
      'message', case when v_employee.is_active then 'Employee is already active.' else 'Employee is already inactive.' end,
      'employee', row_to_json(v_employee)
    );
  end if;

  if p_is_active = false then
    select exists (
      select 1
      from public.attendance_logs time_in
      where time_in.employee_id = v_employee.id
        and time_in.event_type = 'time_in'
        and not exists (
          select 1
          from public.attendance_logs time_out
          where time_out.employee_id = time_in.employee_id
            and time_out.event_type = 'time_out'
            and time_out.scanned_at > time_in.scanned_at
        )
    )
    into v_has_open_session;

    if v_has_open_session then
      return jsonb_build_object(
        'success', false,
        'message', 'This employee still has an open time-in session. Please fix the attendance log first before deactivating.'
      );
    end if;
  end if;

  update public.employees
  set is_active = p_is_active
  where id = p_employee_id
  returning * into v_employee;

  return jsonb_build_object(
    'success', true,
    'message', case when p_is_active then 'Employee reactivated successfully.' else 'Employee deactivated successfully.' end,
    'employee', row_to_json(v_employee)
  );
end;
$$;

create or replace function public.owner_attendance_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_sessions jsonb;
  v_corrections jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(session_rows) order by session_rows.time_in_at desc),
    '[]'::jsonb
  )
  into v_sessions
  from (
    with time_ins as (
      select
        logs.id as time_in_id,
        logs.employee_id,
        employees.employee_number,
        employees.full_name as employee_name,
        logs.scanned_at as time_in_at,
        logs.local_date as work_date,
        logs.minutes_late,
        logs.payroll_deduction
      from public.attendance_logs logs
      join public.employees employees on employees.id = logs.employee_id
      where logs.event_type = 'time_in'
        and logs.scanned_at >= now() - interval '90 days'
    )
    select
      time_ins.employee_id,
      time_ins.employee_number,
      time_ins.employee_name,
      time_ins.work_date,
      time_ins.time_in_id,
      time_ins.time_in_at,
      time_out.id as time_out_id,
      time_out.scanned_at as time_out_at,
      case
        when time_out.scanned_at is null then null
        else round(extract(epoch from (time_out.scanned_at - time_ins.time_in_at)) / 3600.0, 2)
      end as worked_hours,
      time_ins.minutes_late as late_minutes,
      time_ins.payroll_deduction,
      case when time_out.id is null then 'open' else 'completed' end as session_status,
      (
        select count(*)
        from public.attendance_log_corrections corrections
        where corrections.attendance_log_id = time_ins.time_in_id
           or corrections.attendance_log_id = time_out.id
      ) as correction_count
    from time_ins
    left join lateral (
      select out_logs.id, out_logs.scanned_at
      from public.attendance_logs out_logs
      where out_logs.employee_id = time_ins.employee_id
        and out_logs.event_type = 'time_out'
        and out_logs.scanned_at > time_ins.time_in_at
      order by out_logs.scanned_at asc
      limit 1
    ) time_out on true
    order by time_ins.time_in_at desc
    limit 200
  ) session_rows;

  select coalesce(
    jsonb_agg(to_jsonb(correction_rows) order by correction_rows.corrected_at desc),
    '[]'::jsonb
  )
  into v_corrections
  from (
    select
      corrections.id,
      corrections.employee_id,
      employees.employee_number,
      employees.full_name as employee_name,
      corrections.event_type,
      corrections.correction_type,
      corrections.old_scanned_at,
      corrections.new_scanned_at,
      corrections.reason,
      profiles.full_name as corrected_by_name,
      corrections.created_at as corrected_at
    from public.attendance_log_corrections corrections
    join public.employees employees on employees.id = corrections.employee_id
    left join public.profiles profiles on profiles.id = corrections.corrected_by
    order by corrections.created_at desc
    limit 50
  ) correction_rows;

  return jsonb_build_object(
    'success', true,
    'sessions', v_sessions,
    'corrections', v_corrections
  );
end;
$$;

create or replace function public.owner_update_attendance_log(
  p_attendance_log_id uuid,
  p_corrected_scanned_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_log public.attendance_logs;
  v_employee public.employees;
  v_local_date date;
  v_local_time time;
  v_day_key text;
  v_shift record;
  v_late_minutes integer := 0;
  v_payroll_deduction numeric(10,2) := 0;
  v_old_scanned_at timestamptz;
  v_old_local_date date;
  v_old_local_time time;
  v_old_minutes_late integer;
  v_old_payroll_deduction numeric(10,2);
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_attendance_log_id is null or p_corrected_scanned_at is null then
    return jsonb_build_object('success', false, 'message', 'Attendance log and corrected time are required.');
  end if;

  if coalesce(length(trim(p_reason)), 0) < 5 then
    return jsonb_build_object('success', false, 'message', 'Please provide a clear correction reason.');
  end if;

  select *
  into v_log
  from public.attendance_logs
  where id = p_attendance_log_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Attendance log not found.');
  end if;

  select *
  into v_employee
  from public.employees
  where id = v_log.employee_id;

  v_old_scanned_at := v_log.scanned_at;
  v_old_local_date := v_log.local_date;
  v_old_local_time := v_log.local_time;
  v_old_minutes_late := v_log.minutes_late;
  v_old_payroll_deduction := v_log.payroll_deduction;

  v_local_date := (p_corrected_scanned_at at time zone 'Asia/Manila')::date;
  v_local_time := (p_corrected_scanned_at at time zone 'Asia/Manila')::time;
  v_day_key := lower(trim(to_char(v_local_date, 'dy')));

  if v_log.event_type = 'time_in' then
    select s.shift_name, s.scheduled_start, s.paid_hours, s.grace_minutes, esa.work_days
    into v_shift
    from public.employee_shift_assignments esa
    join public.shifts s on s.id = esa.shift_id
    where esa.employee_id = v_log.employee_id
      and esa.effective_from <= v_local_date
      and (esa.effective_to is null or esa.effective_to >= v_local_date)
    order by esa.effective_from desc
    limit 1;

    if found and v_day_key = any(v_shift.work_days) then
      v_late_minutes := greatest(
        0,
        floor(extract(epoch from (v_local_time - (v_shift.scheduled_start + make_interval(mins => v_shift.grace_minutes)))) / 60)::integer
      );

      if v_late_minutes > 0 and coalesce(v_employee.base_daily_rate, 0) > 0 and coalesce(v_shift.paid_hours, 0) > 0 then
        v_payroll_deduction := round((v_employee.base_daily_rate / (v_shift.paid_hours * 60)) * v_late_minutes, 2);
      end if;
    end if;
  end if;

  update public.attendance_logs
  set
    scanned_at = p_corrected_scanned_at,
    local_date = v_local_date,
    local_time = v_local_time,
    minutes_late = case when v_log.event_type = 'time_in' then v_late_minutes else 0 end,
    payroll_deduction = case when v_log.event_type = 'time_in' then v_payroll_deduction else 0 end,
    source_label = 'owner-attendance-correction'
  where id = p_attendance_log_id
  returning * into v_log;

  insert into public.attendance_log_corrections (
    attendance_log_id,
    employee_id,
    event_type,
    correction_type,
    old_scanned_at,
    new_scanned_at,
    old_local_date,
    new_local_date,
    old_local_time,
    new_local_time,
    old_minutes_late,
    new_minutes_late,
    old_payroll_deduction,
    new_payroll_deduction,
    reason,
    corrected_by
  )
  values (
    v_log.id,
    v_log.employee_id,
    v_log.event_type,
    'edit_log',
    v_old_scanned_at,
    p_corrected_scanned_at,
    v_old_local_date,
    v_local_date,
    v_old_local_time,
    v_local_time,
    v_old_minutes_late,
    case when v_log.event_type = 'time_in' then v_late_minutes else 0 end,
    v_old_payroll_deduction,
    case when v_log.event_type = 'time_in' then v_payroll_deduction else 0 end,
    trim(p_reason),
    auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Attendance log updated successfully.',
    'attendanceLog', row_to_json(v_log)
  );
end;
$$;

create or replace function public.owner_close_open_attendance_session(
  p_time_in_log_id uuid,
  p_time_out_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_time_in public.attendance_logs;
  v_employee public.employees;
  v_location public.business_locations;
  v_time_out public.attendance_logs;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_time_in_log_id is null or p_time_out_at is null then
    return jsonb_build_object('success', false, 'message', 'Time in log and corrected time out are required.');
  end if;

  if coalesce(length(trim(p_reason)), 0) < 5 then
    return jsonb_build_object('success', false, 'message', 'Please provide a clear correction reason.');
  end if;

  select *
  into v_time_in
  from public.attendance_logs
  where id = p_time_in_log_id
    and event_type = 'time_in';

  if not found then
    return jsonb_build_object('success', false, 'message', 'Time in log not found.');
  end if;

  if p_time_out_at <= v_time_in.scanned_at then
    return jsonb_build_object('success', false, 'message', 'Time out must be later than time in.');
  end if;

  if exists (
    select 1
    from public.attendance_logs time_out
    where time_out.employee_id = v_time_in.employee_id
      and time_out.event_type = 'time_out'
      and time_out.scanned_at > v_time_in.scanned_at
  ) then
    return jsonb_build_object('success', false, 'message', 'This session already has a recorded time out.');
  end if;

  select *
  into v_employee
  from public.employees
  where id = v_time_in.employee_id;

  select *
  into v_location
  from public.business_locations
  where is_active = true
  order by created_at asc
  limit 1;

  if not found then
    return jsonb_build_object('success', false, 'message', 'No active business location found for the manual time out.');
  end if;

  insert into public.attendance_logs (
    employee_id,
    employee_name_snapshot,
    event_type,
    scanned_at,
    local_date,
    local_time,
    latitude,
    longitude,
    accuracy_m,
    location_id,
    location_name_snapshot,
    distance_m,
    status,
    minutes_late,
    payroll_deduction,
    selfie_path,
    source_label
  )
  values (
    v_time_in.employee_id,
    coalesce(v_employee.full_name, v_time_in.employee_name_snapshot),
    'time_out',
    p_time_out_at,
    (p_time_out_at at time zone 'Asia/Manila')::date,
    (p_time_out_at at time zone 'Asia/Manila')::time,
    v_location.latitude,
    v_location.longitude,
    0,
    v_location.id,
    v_location.name,
    0,
    'allowed',
    0,
    0,
    'manual-owner-adjustment',
    'owner-attendance-correction'
  )
  returning * into v_time_out;

  insert into public.attendance_log_corrections (
    attendance_log_id,
    employee_id,
    event_type,
    correction_type,
    old_scanned_at,
    new_scanned_at,
    old_local_date,
    new_local_date,
    old_local_time,
    new_local_time,
    old_minutes_late,
    new_minutes_late,
    old_payroll_deduction,
    new_payroll_deduction,
    reason,
    corrected_by
  )
  values (
    v_time_out.id,
    v_time_out.employee_id,
    'time_out',
    'manual_time_out',
    null,
    v_time_out.scanned_at,
    null,
    v_time_out.local_date,
    null,
    v_time_out.local_time,
    null,
    0,
    null,
    0,
    trim(p_reason),
    auth.uid()
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Manual time out recorded successfully.',
    'attendanceLog', row_to_json(v_time_out)
  );
end;
$$;

create or replace function public.owner_set_employee_contract_signed(
  p_employee_id uuid,
  p_signed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Management login required.');
  end if;

  if p_employee_id is null then
    return jsonb_build_object('success', false, 'message', 'Employee is required.');
  end if;

  update public.employees
  set
    contract_status = case when p_signed then 'signed' else 'pending_signature' end,
    contract_signed_at = case when p_signed then now() else null end
  where id = p_employee_id
  returning * into v_employee;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  return jsonb_build_object(
    'success', true,
    'message', case when p_signed then 'Contract marked as signed.' else 'Contract marked as awaiting signature.' end,
    'employee', row_to_json(v_employee)
  );
end;
$$;

create or replace function public.staff_dashboard(p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_summary jsonb;
  v_sessions jsonb;
  v_payroll_history jsonb;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
  end if;

  select to_jsonb(row_data)
  into v_summary
  from (
    select *
    from public.cutoff_payroll_summary
    where employee_id = v_employee.id
      and cutoff_start <= v_today
      and cutoff_end >= v_today
    limit 1
  ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by work_date desc, time_in_at desc), '[]'::jsonb)
  into v_sessions
  from (
    select *
    from public.cutoff_session_summary
    where employee_id = v_employee.id
      and (
        v_summary is null
        or (work_date >= (v_summary->>'cutoff_start')::date and work_date <= (v_summary->>'cutoff_end')::date)
      )
    ) row_data;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by cutoff_start desc, cutoff_end desc), '[]'::jsonb)
  into v_payroll_history
  from (
    select *
    from public.cutoff_payroll_summary
    where employee_id = v_employee.id
    order by cutoff_start desc, cutoff_end desc
    limit 24
  ) row_data;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'currentSummary', v_summary,
    'sessions', coalesce(v_sessions, '[]'::jsonb),
    'payrollHistory', coalesce(v_payroll_history, '[]'::jsonb)
  );
end;
$$;

create or replace function public.staff_sales_history(p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_cutoff_start date := public.cutoff_start_for(v_today);
  v_cutoff_end date := public.cutoff_end_for(v_today);
  v_summary jsonb;
  v_transactions jsonb;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
  end if;

  select jsonb_build_object(
    'cutoffStart', v_cutoff_start,
    'cutoffEnd', v_cutoff_end,
    'transactionCount', count(*),
    'totalSales', coalesce(sum(total_amount), 0),
    'cashSales', coalesce(sum(total_amount) filter (where payment_method = 'cash'), 0),
    'digitalSales', coalesce(sum(total_amount) filter (where payment_method <> 'cash'), 0)
  )
  into v_summary
  from public.sales_transactions
  where employee_id = v_employee.id
    and local_date >= v_cutoff_start
    and local_date <= v_cutoff_end;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by created_at desc), '[]'::jsonb)
  into v_transactions
  from (
    select
      id,
      transaction_number,
      payment_method,
      total_amount,
      cash_received,
      change_amount,
      correction_count,
      last_corrected_at,
      last_correction_source,
      local_date,
      local_time,
      created_at
    from public.sales_transactions
    where employee_id = v_employee.id
    order by created_at desc
    limit 50
  ) row_data;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'summary', v_summary,
    'transactions', v_transactions
  );
end;
$$;

create or replace function public.staff_contract_info(p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_assignment record;
  v_primary_location text;
  v_has_assignment boolean := false;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
  end if;

  select name
  into v_primary_location
  from public.business_locations
  where is_active = true
  order by created_at asc
  limit 1;

  select
    esa.effective_from,
    esa.effective_to,
    esa.work_days,
    s.shift_name,
    s.scheduled_start,
    s.scheduled_end,
    s.paid_hours,
    s.grace_minutes
  into v_assignment
  from public.employee_shift_assignments esa
  join public.shifts s on s.id = esa.shift_id
  where esa.employee_id = v_employee.id
    and esa.effective_from <= (now() at time zone 'Asia/Manila')::date
    and (esa.effective_to is null or esa.effective_to >= (now() at time zone 'Asia/Manila')::date)
  order by esa.effective_from desc
  limit 1;

  v_has_assignment := found;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'contract', jsonb_build_object(
        'generatedAt', now(),
        'employeeNumber', v_employee.employee_number,
        'employeeName', v_employee.full_name,
        'employeeEmail', v_employee.employee_email,
        'phoneNumber', v_employee.phone_number,
        'roleName', v_employee.role_name,
        'employmentStatus', 'Probationary',
        'businessName', 'Cup of Joy',
      'businessAddress', coalesce(v_primary_location, 'Cup of Joy Main Location'),
      'employeeAddress', 'To be completed during onboarding',
      'positionTitle', coalesce(v_employee.role_name, 'Staff'),
      'firstWeekDailyRate', v_employee.first_week_daily_rate,
      'dailyRate', v_employee.base_daily_rate,
        'status', case when v_employee.is_active then 'Active' else 'Inactive' end,
        'startDate', case when v_has_assignment then v_assignment.effective_from else v_employee.created_at::date end,
        'primaryWorkLocations', coalesce(v_primary_location, 'Cup of Joy Main Location'),
        'payrollSchedule', 'Cutoff 26-10 paid on the 15th; cutoff 11-25 paid on the 30th',
        'shiftName', case when v_has_assignment then v_assignment.shift_name else null end,
        'scheduledStart', case when v_has_assignment then v_assignment.scheduled_start else null end,
        'scheduledEnd', case when v_has_assignment then v_assignment.scheduled_end else null end,
        'paidHours', case when v_has_assignment then v_assignment.paid_hours else null end,
        'graceMinutes', case when v_has_assignment then v_assignment.grace_minutes else null end,
        'workDays', case when v_has_assignment then v_assignment.work_days else array[]::text[] end,
        'overtimeApprovalRule', 'Owner approval required',
        'cashPosResponsibility', 'Yes, if assigned to POS or cash handling duties',
        'uniformCompanyPropertyIssued', 'To be listed by management if issued',
        'emergencyContact', 'To be completed during onboarding',
        'immediateSupervisor', 'Cup of Joy Owner / Management',
        'loanAccessEnabled', v_employee.loan_feature_enabled,
        'contractStatus', v_employee.contract_status,
        'contractSentAt', v_employee.contract_sent_at,
        'contractDueAt', v_employee.contract_due_at,
        'contractSignedAt', v_employee.contract_signed_at,
        'contractSignedCopyPath', v_employee.contract_signed_copy_path,
        'restDays', (
          select array_agg(day_key order by ordering)
        from (
            select * from (values
              ('mon', 1), ('tue', 2), ('wed', 3), ('thu', 4), ('fri', 5), ('sat', 6), ('sun', 7)
            ) as days(day_key, ordering)
            where not (day_key = any(case when v_has_assignment then v_assignment.work_days else array[]::text[] end))
          ) remaining_days
        )
      )
  );
end;
$$;

create or replace function public.owner_employee_contract_info(p_employee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_assignment record;
  v_primary_location text;
  v_has_assignment boolean := false;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  select *
  into v_employee
  from public.employees
  where id = p_employee_id
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee not found.');
  end if;

  select name
  into v_primary_location
  from public.business_locations
  where is_active = true
  order by created_at asc
  limit 1;

  select
    esa.effective_from,
    esa.effective_to,
    esa.work_days,
    s.shift_name,
    s.scheduled_start,
    s.scheduled_end,
    s.paid_hours,
    s.grace_minutes
  into v_assignment
  from public.employee_shift_assignments esa
  join public.shifts s on s.id = esa.shift_id
  where esa.employee_id = v_employee.id
    and esa.effective_from <= (now() at time zone 'Asia/Manila')::date
    and (esa.effective_to is null or esa.effective_to >= (now() at time zone 'Asia/Manila')::date)
  order by esa.effective_from desc
  limit 1;

  v_has_assignment := found;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'contract', jsonb_build_object(
      'generatedAt', now(),
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'employeeEmail', v_employee.employee_email,
      'phoneNumber', v_employee.phone_number,
      'roleName', v_employee.role_name,
      'employmentStatus', 'Probationary',
      'businessName', 'Cup of Joy',
      'businessAddress', coalesce(v_primary_location, 'Cup of Joy Main Location'),
      'employeeAddress', 'To be completed during onboarding',
      'positionTitle', coalesce(v_employee.role_name, 'Staff'),
      'firstWeekDailyRate', v_employee.first_week_daily_rate,
      'dailyRate', v_employee.base_daily_rate,
      'status', case when v_employee.is_active then 'Active' else 'Inactive' end,
      'startDate', case when v_has_assignment then v_assignment.effective_from else v_employee.created_at::date end,
      'primaryWorkLocations', coalesce(v_primary_location, 'Cup of Joy Main Location'),
      'payrollSchedule', 'Cutoff 26-10 paid on the 15th; cutoff 11-25 paid on the 30th',
      'shiftName', case when v_has_assignment then v_assignment.shift_name else null end,
      'scheduledStart', case when v_has_assignment then v_assignment.scheduled_start else null end,
      'scheduledEnd', case when v_has_assignment then v_assignment.scheduled_end else null end,
      'paidHours', case when v_has_assignment then v_assignment.paid_hours else null end,
      'graceMinutes', case when v_has_assignment then v_assignment.grace_minutes else null end,
      'workDays', case when v_has_assignment then v_assignment.work_days else array[]::text[] end,
      'overtimeApprovalRule', 'Owner approval required',
      'cashPosResponsibility', 'Yes, if assigned to POS or cash handling duties',
      'uniformCompanyPropertyIssued', 'To be listed by management if issued',
      'emergencyContact', 'To be completed during onboarding',
      'immediateSupervisor', 'Cup of Joy Owner / Management',
      'loanAccessEnabled', v_employee.loan_feature_enabled,
      'contractStatus', v_employee.contract_status,
      'contractSentAt', v_employee.contract_sent_at,
      'contractDueAt', v_employee.contract_due_at,
      'contractSignedAt', v_employee.contract_signed_at,
      'contractDocumentPath', v_employee.contract_document_path,
      'contractSignedCopyPath', v_employee.contract_signed_copy_path,
      'restDays', (
        select array_agg(day_key order by ordering)
        from (
          select * from (values
            ('mon', 1), ('tue', 2), ('wed', 3), ('thu', 4), ('fri', 5), ('sat', 6), ('sun', 7)
          ) as days(day_key, ordering)
          where not (day_key = any(case when v_has_assignment then v_assignment.work_days else array[]::text[] end))
        ) remaining_days
      )
    )
  );
end;
$$;

create or replace function public.owner_dispatch_employee_contract(
  p_employee_id uuid,
  p_employee_email text,
  p_contract_document_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_email text := lower(trim(coalesce(p_employee_email, '')));
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    return jsonb_build_object('success', false, 'message', 'A valid employee email is required before sending the contract.');
  end if;

  update public.employees
  set
    employee_email = v_email,
    contract_status = 'pending_signature',
    contract_sent_at = now(),
    contract_due_at = now() + interval '3 hours',
    contract_signed_at = null,
    contract_document_path = nullif(trim(coalesce(p_contract_document_path, '')), ''),
    contract_signed_copy_path = null
  where id = p_employee_id
    and is_active = true
  returning * into v_employee;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee not found.');
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'dueAt', v_employee.contract_due_at,
    'message', 'Contract dispatch logged. The signed copy must be returned within 3 hours.'
  );
end;
$$;

create or replace function public.staff_submit_signed_contract(
  p_qr_token text,
  p_signed_copy_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
  end if;

  if trim(coalesce(p_signed_copy_path, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Signed contract upload is required.');
  end if;

  if v_employee.contract_status = 'signed' then
    return jsonb_build_object('success', true, 'message', 'Signed contract is already on file.', 'employee', row_to_json(v_employee));
  end if;

  if v_employee.contract_status <> 'pending_signature' then
    return jsonb_build_object('success', false, 'message', 'No active contract dispatch was found. Ask the owner to send the contract first.');
  end if;

  if v_employee.contract_due_at is not null and v_employee.contract_due_at < now() then
    update public.employees
    set contract_status = 'expired'
    where id = v_employee.id
    returning * into v_employee;

    return jsonb_build_object('success', false, 'message', 'The 3-hour signature window has expired. Ask the owner to resend the contract.');
  end if;

  update public.employees
  set
    contract_status = 'signed',
    contract_signed_at = now(),
    contract_signed_copy_path = trim(p_signed_copy_path)
  where id = v_employee.id
  returning * into v_employee;

  return jsonb_build_object(
    'success', true,
    'message', 'Signed contract submitted successfully.',
    'employee', row_to_json(v_employee)
  );
end;
$$;

create or replace function public.submit_termination_request(
  p_qr_token text,
  p_requested_last_working_date date,
  p_reason text,
  p_notice_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_notice_days integer := greatest(coalesce(p_notice_days, 14), 14);
  v_request public.termination_requests;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Reason is required.');
  end if;

  if p_requested_last_working_date is null or p_requested_last_working_date < (v_today + v_notice_days) then
    return jsonb_build_object('success', false, 'message', format('Last working day must be at least %s days from today.', v_notice_days));
  end if;

  insert into public.termination_requests (
    employee_id,
    requested_last_working_date,
    reason,
    notice_days,
    status,
    updated_at
  )
  values (
    v_employee.id,
    p_requested_last_working_date,
    trim(p_reason),
    v_notice_days,
    'requested',
    now()
  )
  returning * into v_request;

  return jsonb_build_object('success', true, 'request', row_to_json(v_request));
end;
$$;

create or replace function public.staff_termination_dashboard(p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_requests jsonb := '[]'::jsonb;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by requested_at desc), '[]'::jsonb)
  into v_requests
  from (
    select
      id,
      requested_at,
      notice_days,
      requested_last_working_date,
      reason,
      status,
      reviewed_at,
      review_notes
    from public.termination_requests
    where employee_id = v_employee.id
  ) row_data;

  return jsonb_build_object(
    'success', true,
    'noticeDays', 14,
    'requests', v_requests
  );
end;
$$;

create or replace function public.owner_termination_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_requests jsonb := '[]'::jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by requested_at desc), '[]'::jsonb)
  into v_requests
  from (
    select
      requests.id,
      requests.employee_id,
      employees.employee_number,
      employees.full_name as employee_name,
      requests.requested_at,
      requests.notice_days,
      requests.requested_last_working_date,
      requests.reason,
      requests.status,
      requests.reviewed_at,
      requests.review_notes
    from public.termination_requests requests
    join public.employees employees on employees.id = requests.employee_id
  ) row_data;

  return jsonb_build_object('success', true, 'requests', v_requests);
end;
$$;

create or replace function public.owner_review_termination_request(
  p_termination_request_id uuid,
  p_status text,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request public.termination_requests;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_status not in ('approved', 'rejected', 'cancelled', 'completed') then
    return jsonb_build_object('success', false, 'message', 'Invalid termination status.');
  end if;

  update public.termination_requests
  set
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_review_notes,
    updated_at = now()
  where id = p_termination_request_id
  returning * into v_request;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Termination request not found.');
  end if;

  return jsonb_build_object('success', true, 'request', row_to_json(v_request));
end;
$$;

create or replace function public.admin_set_payroll_status(
  p_employee_id uuid,
  p_cutoff_start date,
  p_cutoff_end date,
  p_status text,
  p_payment_method text default null,
  p_payment_reference text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payday date;
  v_payment public.payroll_payments;
  v_payslip jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_status not in ('unpaid', 'paid') then
    return jsonb_build_object('success', false, 'message', 'Invalid payroll status.');
  end if;

  if p_status = 'paid' and p_payment_method not in ('cash', 'gcash', 'bank_transfer') then
    return jsonb_build_object('success', false, 'message', 'Choose cash, GCash, or bank transfer before marking payroll paid.');
  end if;

  if p_employee_id is null or p_cutoff_start is null or p_cutoff_end is null then
    return jsonb_build_object('success', false, 'message', 'Missing employee or cutoff.');
  end if;

  delete from public.payroll_payments
  where payslip_expires_at is not null
    and payslip_expires_at < now();

  v_payday := public.payday_for_cutoff(p_cutoff_start);

  select to_jsonb(row_data)
  into v_payslip
  from (
    select *
    from public.cutoff_payroll_summary
    where employee_id = p_employee_id
      and cutoff_start = p_cutoff_start
      and cutoff_end = p_cutoff_end
    limit 1
  ) row_data;

  if v_payslip is null then
    return jsonb_build_object('success', false, 'message', 'No payroll summary found for this cutoff.');
  end if;

  insert into public.payroll_payments (
    employee_id,
    cutoff_start,
    cutoff_end,
    payday,
    status,
    overtime_status,
    payment_method,
    payment_reference,
    paid_at,
    paid_by,
    notes,
    payslip_snapshot,
    payslip_stored_at,
    payslip_expires_at,
    updated_at
  )
  values (
    p_employee_id,
    p_cutoff_start,
    p_cutoff_end,
    v_payday,
    p_status,
    'pending',
    case when p_status = 'paid' then p_payment_method else null end,
    nullif(trim(coalesce(p_payment_reference, '')), ''),
    case when p_status = 'paid' then now() else null end,
    case when p_status = 'paid' then auth.uid() else null end,
    p_notes,
    v_payslip,
    now(),
    now() + interval '1 year',
    now()
  )
  on conflict (employee_id, cutoff_start, cutoff_end)
  do update set
    payday = excluded.payday,
    status = excluded.status,
    payment_method = excluded.payment_method,
    payment_reference = excluded.payment_reference,
    paid_at = excluded.paid_at,
    paid_by = excluded.paid_by,
    notes = excluded.notes,
    payslip_snapshot = excluded.payslip_snapshot,
    payslip_stored_at = excluded.payslip_stored_at,
    payslip_expires_at = excluded.payslip_expires_at,
    updated_at = now()
  returning * into v_payment;

  return jsonb_build_object('success', true, 'payment', row_to_json(v_payment));
end;
$$;

create or replace function public.owner_settings_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settings public.owner_settings;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  select * into v_settings from public.owner_settings where id = 1;

  return jsonb_build_object(
    'success', true,
    'settings', jsonb_build_object(
      'loansEnabled', coalesce(v_settings.loans_enabled, false),
      'salesCorrectionPinSet', v_settings.sales_correction_pin_hash is not null
    )
  );
end;
$$;

create or replace function public.owner_set_sales_correction_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settings public.owner_settings;
  v_clean_pin text := trim(coalesce(p_pin, ''));
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if length(v_clean_pin) < 4 then
    return jsonb_build_object('success', false, 'message', 'Admin PIN must be at least 4 characters.');
  end if;

  insert into public.owner_settings (id, loans_enabled, sales_correction_pin_hash, updated_at)
  values (
    1,
    coalesce((select loans_enabled from public.owner_settings where id = 1), false),
    encode(digest(v_clean_pin, 'sha256'), 'hex'),
    now()
  )
  on conflict (id)
  do update set
    sales_correction_pin_hash = excluded.sales_correction_pin_hash,
    updated_at = now()
  returning * into v_settings;

  return jsonb_build_object(
    'success', true,
    'settings', jsonb_build_object(
      'loansEnabled', coalesce(v_settings.loans_enabled, false),
      'salesCorrectionPinSet', v_settings.sales_correction_pin_hash is not null
    )
  );
end;
$$;

create or replace function public.owner_set_loans_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_settings public.owner_settings;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  insert into public.owner_settings (id, loans_enabled, updated_at)
  values (1, coalesce(p_enabled, false), now())
  on conflict (id)
  do update set
    loans_enabled = excluded.loans_enabled,
    updated_at = now()
  returning * into v_settings;

  return jsonb_build_object('success', true, 'settings', row_to_json(v_settings));
end;
$$;

create or replace function public.owner_set_employee_loan_enabled(
  p_employee_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  update public.employees
  set loan_feature_enabled = coalesce(p_enabled, false)
  where id = p_employee_id
  returning * into v_employee;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  return jsonb_build_object('success', true, 'employee', row_to_json(v_employee));
end;
$$;

create or replace function public.owner_set_overtime_status(
  p_employee_id uuid,
  p_cutoff_start date,
  p_cutoff_end date,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_payday date;
  v_payment public.payroll_payments;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_status not in ('pending', 'approved', 'rejected') then
    return jsonb_build_object('success', false, 'message', 'Invalid overtime status.');
  end if;

  if p_employee_id is null or p_cutoff_start is null or p_cutoff_end is null then
    return jsonb_build_object('success', false, 'message', 'Missing employee or cutoff.');
  end if;

  v_payday := public.payday_for_cutoff(p_cutoff_start);

  insert into public.payroll_payments (
    employee_id,
    cutoff_start,
    cutoff_end,
    payday,
    status,
    overtime_status,
    overtime_reviewed_at,
    overtime_reviewed_by,
    notes,
    updated_at
  )
  values (
    p_employee_id,
    p_cutoff_start,
    p_cutoff_end,
    v_payday,
    'unpaid',
    p_status,
    case when p_status = 'pending' then null else now() end,
    case when p_status = 'pending' then null else auth.uid() end,
    p_notes,
    now()
  )
  on conflict (employee_id, cutoff_start, cutoff_end)
  do update set
    overtime_status = excluded.overtime_status,
    overtime_reviewed_at = excluded.overtime_reviewed_at,
    overtime_reviewed_by = excluded.overtime_reviewed_by,
    notes = coalesce(excluded.notes, public.payroll_payments.notes),
    updated_at = now()
  returning * into v_payment;

  return jsonb_build_object('success', true, 'payment', row_to_json(v_payment));
end;
$$;

create or replace function public.submit_unpaid_leave_request(
  p_qr_token text,
  p_leave_date date,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_start_date date;
  v_request public.leave_requests;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  select coalesce(max(effective_from), v_employee.created_at::date)
  into v_start_date
  from public.employee_shift_assignments
  where employee_id = v_employee.id;

  if p_leave_date is null or p_leave_date < (v_today + 14) then
    return jsonb_build_object('success', false, 'message', 'Leave date must be at least 14 days from today.');
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Reason is required.');
  end if;

  if v_start_date > (v_today - interval '3 months')::date then
    return jsonb_build_object('success', false, 'message', 'Scheduled leave becomes available after 3 months of employment.');
  end if;

  insert into public.leave_requests (
    employee_id,
    leave_date,
    reason,
    status,
    unpaid,
    updated_at
  )
  values (
    v_employee.id,
    p_leave_date,
    trim(p_reason),
    'requested',
    true,
    now()
  )
  on conflict (employee_id, leave_date)
  do update set
    reason = excluded.reason,
    status = 'requested',
    unpaid = true,
    reviewed_at = null,
    reviewed_by = null,
    review_notes = null,
    updated_at = now()
  returning * into v_request;

  return jsonb_build_object('success', true, 'request', row_to_json(v_request));
end;
$$;

create or replace function public.staff_leave_dashboard(p_qr_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_start_date date;
  v_loans_enabled boolean := false;
  v_leave_requests jsonb := '[]'::jsonb;
  v_loans jsonb := '[]'::jsonb;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  select coalesce(max(effective_from), v_employee.created_at::date)
  into v_start_date
  from public.employee_shift_assignments
  where employee_id = v_employee.id;

  v_loans_enabled := coalesce(v_employee.loan_feature_enabled, false);

  select coalesce(jsonb_agg(to_jsonb(row_data) order by leave_date desc), '[]'::jsonb)
  into v_leave_requests
  from (
    select
      id,
      leave_date,
      reason,
      status,
      unpaid,
      requested_at,
      reviewed_at,
      review_notes
    from public.leave_requests
    where employee_id = v_employee.id
  ) row_data;

  if coalesce(v_loans_enabled, false) then
    select coalesce(jsonb_agg(to_jsonb(row_data) order by issued_at desc), '[]'::jsonb)
    into v_loans
    from (
      select
        loans.id,
        loans.principal_amount,
        loans.outstanding_balance,
        loans.payment_terms,
        loans.agreement_html,
        loans.start_date,
        loans.status,
        loans.issued_at,
        loans.notes,
        (
          select coalesce(jsonb_agg(to_jsonb(repayment) order by repayment.paid_at desc), '[]'::jsonb)
          from (
            select amount, paid_at, notes
            from public.loan_repayments
            where loan_id = loans.id
          ) repayment
        ) as repayments
      from public.employee_loans loans
      where loans.employee_id = v_employee.id
    ) row_data;
  end if;

  return jsonb_build_object(
    'success', true,
    'employee', jsonb_build_object(
      'id', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'startDate', v_start_date,
      'leaveEligible', v_start_date <= ((now() at time zone 'Asia/Manila')::date - interval '3 months')::date
    ),
    'loansEnabled', coalesce(v_loans_enabled, false),
    'leaveRequests', v_leave_requests,
    'loans', v_loans
  );
end;
$$;

create or replace function public.owner_leave_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_requests jsonb := '[]'::jsonb;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  select coalesce(jsonb_agg(to_jsonb(row_data) order by leave_date asc, requested_at asc), '[]'::jsonb)
  into v_requests
  from (
    select
      requests.id,
      requests.employee_id,
      employees.employee_number,
      employees.full_name as employee_name,
      requests.leave_date,
      requests.reason,
      requests.status,
      requests.unpaid,
      requests.requested_at,
      requests.reviewed_at,
      requests.review_notes
    from public.leave_requests requests
    join public.employees employees on employees.id = requests.employee_id
  ) row_data;

  return jsonb_build_object('success', true, 'requests', v_requests);
end;
$$;

create or replace function public.owner_review_leave_request(
  p_leave_request_id uuid,
  p_status text,
  p_review_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_request public.leave_requests;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_status not in ('approved', 'rejected', 'cancelled') then
    return jsonb_build_object('success', false, 'message', 'Invalid leave status.');
  end if;

  update public.leave_requests
  set
    status = p_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    review_notes = p_review_notes,
    updated_at = now()
  where id = p_leave_request_id
  returning * into v_request;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Leave request not found.');
  end if;

  return jsonb_build_object('success', true, 'request', row_to_json(v_request));
end;
$$;

create or replace function public.owner_issue_employee_loan(
  p_employee_id uuid,
  p_principal_amount numeric,
  p_payment_terms text,
  p_start_date date default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_start_date date := coalesce(p_start_date, (now() at time zone 'Asia/Manila')::date);
  v_loan public.employee_loans;
  v_agreement_html text;
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_principal_amount is null or p_principal_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Loan amount must be greater than zero.');
  end if;

  if trim(coalesce(p_payment_terms, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Payment terms are required.');
  end if;

  select * into v_employee from public.employees where id = p_employee_id and is_active = true;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not found.');
  end if;

  if not coalesce(v_employee.loan_feature_enabled, false) then
    return jsonb_build_object('success', false, 'message', 'Loan feature is not enabled for this employee.');
  end if;

  v_agreement_html := format(
    '<!doctype html><html><head><meta charset="utf-8"><title>Loan Agreement</title></head><body><h1>Cup of Joy Loan Agreement</h1><p>Employee: %s (%s)</p><p>Loan amount: PHP %s</p><p>Start date: %s</p><p>Payment terms: %s</p><p>Notes: %s</p><p>Owner signature: ____________________</p><p>Employee signature: ____________________</p></body></html>',
    coalesce(v_employee.full_name, 'Employee'),
    coalesce(v_employee.employee_number, '-'),
    to_char(p_principal_amount, 'FM999999990.00'),
    v_start_date,
    replace(trim(p_payment_terms), E'\n', '<br />'),
    replace(coalesce(trim(p_notes), '-'), E'\n', '<br />')
  );

  insert into public.employee_loans (
    employee_id,
    principal_amount,
    outstanding_balance,
    payment_terms,
    agreement_html,
    start_date,
    status,
    issued_by,
    notes,
    updated_at
  )
  values (
    p_employee_id,
    round(p_principal_amount, 2),
    round(p_principal_amount, 2),
    trim(p_payment_terms),
    v_agreement_html,
    v_start_date,
    'active',
    auth.uid(),
    p_notes,
    now()
  )
  returning * into v_loan;

  return jsonb_build_object('success', true, 'loan', row_to_json(v_loan));
end;
$$;

create or replace function public.owner_record_loan_repayment(
  p_loan_id uuid,
  p_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_loan public.employee_loans;
  v_repayment public.loan_repayments;
  v_new_balance numeric(10,2);
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'message', 'Repayment amount must be greater than zero.');
  end if;

  select * into v_loan from public.employee_loans where id = p_loan_id;
  if not found then
    return jsonb_build_object('success', false, 'message', 'Loan record not found.');
  end if;

  insert into public.loan_repayments (
    loan_id,
    amount,
    recorded_by,
    notes
  )
  values (
    p_loan_id,
    round(p_amount, 2),
    auth.uid(),
    p_notes
  )
  returning * into v_repayment;

  v_new_balance := greatest(0, coalesce(v_loan.outstanding_balance, 0) - round(p_amount, 2));

  update public.employee_loans
  set
    outstanding_balance = v_new_balance,
    status = case when v_new_balance <= 0 then 'settled' else status end,
    updated_at = now()
  where id = p_loan_id
  returning * into v_loan;

  return jsonb_build_object('success', true, 'loan', row_to_json(v_loan), 'repayment', row_to_json(v_repayment));
end;
$$;

create or replace function public.delete_expired_payroll_payslips()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_deleted integer := 0;
begin
  if not public.is_owner() then
    raise exception 'Owner login required.';
  end if;

  delete from public.payroll_payments
  where payslip_expires_at is not null
    and payslip_expires_at < now();

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

create or replace function public.sales_transaction_detail(
  p_transaction_id uuid,
  p_qr_token text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_transaction public.sales_transactions;
  v_employee public.employees;
  v_items jsonb := '[]'::jsonb;
  v_corrections jsonb := '[]'::jsonb;
begin
  select *
  into v_transaction
  from public.sales_transactions
  where id = p_transaction_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Sales transaction not found.');
  end if;

  if public.is_owner() then
    null;
  else
    select *
    into v_employee
    from public.resolve_staff_employee(p_qr_token);

    if not found then
      return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
    end if;

    if v_transaction.employee_id is distinct from v_employee.id then
      return jsonb_build_object('success', false, 'message', 'You can only edit your own sales transactions.');
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', items.id,
        'itemId', items.item_id,
        'itemName', items.item_name,
        'category', items.category,
        'unitPrice', items.unit_price,
        'quantity', items.quantity,
        'lineTotal', items.line_total
      )
      order by items.created_at asc, items.id asc
    ),
    '[]'::jsonb
  )
  into v_items
  from public.sales_transaction_items items
  where items.transaction_id = v_transaction.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', corrections.id,
        'correctionSource', corrections.correction_source,
        'adminPinVerified', corrections.admin_pin_verified,
        'reason', corrections.reason,
        'createdAt', corrections.created_at,
        'requestedByName', requester.full_name,
        'authorizedByName', authorizer.full_name
      )
      order by corrections.created_at desc
    ),
    '[]'::jsonb
  )
  into v_corrections
  from public.sales_transaction_corrections corrections
  left join public.employees requester on requester.id = corrections.requested_by_employee_id
  left join public.profiles authorizer on authorizer.id = corrections.authorized_by
  where corrections.transaction_id = v_transaction.id;

  return jsonb_build_object(
    'success', true,
    'transaction', to_jsonb(v_transaction),
    'items', v_items,
    'corrections', v_corrections
  );
end;
$$;

create or replace function public.apply_sales_transaction_correction(
  p_transaction_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_reason text,
  p_correction_source text,
  p_requested_by_employee_id uuid,
  p_authorized_by uuid,
  p_admin_pin_verified boolean,
  p_cash_received numeric default null,
  p_payment_proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_transaction public.sales_transactions;
  v_updated_transaction public.sales_transactions;
  v_item record;
  v_total numeric(10,2) := 0;
  v_cash_received numeric(10,2);
  v_change_amount numeric(10,2) := 0;
  v_old_items_snapshot jsonb := '[]'::jsonb;
  v_new_items_snapshot jsonb := '[]'::jsonb;
  v_correction public.sales_transaction_corrections;
begin
  if p_correction_source not in ('admin', 'staff') then
    return jsonb_build_object('success', false, 'message', 'Invalid correction source.');
  end if;

  if trim(coalesce(p_reason, '')) = '' then
    return jsonb_build_object('success', false, 'message', 'Reason for sale correction is required.');
  end if;

  if p_payment_method not in ('cash', 'gcash', 'paymaya', 'bank_transfer') then
    return jsonb_build_object('success', false, 'message', 'Invalid payment method.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'At least one sale item is required.');
  end if;

  select *
  into v_transaction
  from public.sales_transactions
  where id = p_transaction_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Sales transaction not found.');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', items.id,
        'itemId', items.item_id,
        'itemName', items.item_name,
        'category', items.category,
        'unitPrice', items.unit_price,
        'quantity', items.quantity,
        'lineTotal', items.line_total
      )
      order by items.created_at asc, items.id asc
    ),
    '[]'::jsonb
  )
  into v_old_items_snapshot
  from public.sales_transaction_items items
  where items.transaction_id = v_transaction.id;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(itemId text, itemName text, category text, unitPrice numeric, quantity integer)
  loop
    if trim(coalesce(v_item.itemId, '')) = ''
      or trim(coalesce(v_item.itemName, '')) = ''
      or coalesce(v_item.unitPrice, -1) < 0
      or coalesce(v_item.quantity, 0) <= 0 then
      return jsonb_build_object('success', false, 'message', 'Each corrected item needs a name, price, and quantity.');
    end if;

    v_total := v_total + round(v_item.unitPrice * v_item.quantity, 2);
  end loop;

  v_cash_received := case when p_payment_method = 'cash' then round(coalesce(p_cash_received, 0), 2) else null end;

  if p_payment_method = 'cash' and coalesce(v_cash_received, 0) < v_total then
    return jsonb_build_object('success', false, 'message', 'Cash received is lower than the corrected total.');
  end if;

  if p_payment_method <> 'cash' and coalesce(nullif(trim(coalesce(p_payment_proof_path, '')), ''), v_transaction.payment_proof_path) is null then
    return jsonb_build_object('success', false, 'message', 'Payment proof is required for digital payment corrections.');
  end if;

  v_change_amount := case when p_payment_method = 'cash' then round(v_cash_received - v_total, 2) else 0 end;

  update public.sales_transactions
  set
    payment_method = p_payment_method,
    total_amount = v_total,
    cash_received = v_cash_received,
    change_amount = v_change_amount,
    payment_proof_path = case
      when p_payment_method = 'cash' then null
      else coalesce(nullif(trim(coalesce(p_payment_proof_path, '')), ''), v_transaction.payment_proof_path)
    end,
    correction_count = coalesce(correction_count, 0) + 1,
    last_corrected_at = now(),
    last_correction_source = p_correction_source
  where id = p_transaction_id
  returning * into v_updated_transaction;

  delete from public.sales_transaction_items
  where transaction_id = p_transaction_id;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(itemId text, itemName text, category text, unitPrice numeric, quantity integer)
  loop
    insert into public.sales_transaction_items (
      transaction_id,
      item_id,
      item_name,
      category,
      unit_price,
      quantity,
      line_total
    )
    values (
      p_transaction_id,
      trim(v_item.itemId),
      trim(v_item.itemName),
      nullif(trim(coalesce(v_item.category, '')), ''),
      round(v_item.unitPrice, 2),
      v_item.quantity,
      round(v_item.unitPrice * v_item.quantity, 2)
    );
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', items.id,
        'itemId', items.item_id,
        'itemName', items.item_name,
        'category', items.category,
        'unitPrice', items.unit_price,
        'quantity', items.quantity,
        'lineTotal', items.line_total
      )
      order by items.created_at asc, items.id asc
    ),
    '[]'::jsonb
  )
  into v_new_items_snapshot
  from public.sales_transaction_items items
  where items.transaction_id = p_transaction_id;

  insert into public.sales_transaction_corrections (
    transaction_id,
    requested_by_employee_id,
    authorized_by,
    correction_source,
    admin_pin_verified,
    reason,
    old_transaction_snapshot,
    new_transaction_snapshot,
    old_items_snapshot,
    new_items_snapshot
  )
  values (
    p_transaction_id,
    p_requested_by_employee_id,
    p_authorized_by,
    p_correction_source,
    coalesce(p_admin_pin_verified, false),
    trim(p_reason),
    to_jsonb(v_transaction),
    to_jsonb(v_updated_transaction),
    v_old_items_snapshot,
    v_new_items_snapshot
  )
  returning * into v_correction;

  return jsonb_build_object(
    'success', true,
    'transaction', to_jsonb(v_updated_transaction),
    'correction', to_jsonb(v_correction),
    'items', v_new_items_snapshot
  );
end;
$$;

create or replace function public.owner_update_sales_transaction(
  p_transaction_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_reason text,
  p_cash_received numeric default null,
  p_payment_proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_owner() then
    return jsonb_build_object('success', false, 'message', 'Owner login required.');
  end if;

  return public.apply_sales_transaction_correction(
    p_transaction_id,
    p_items,
    p_payment_method,
    p_reason,
    'admin',
    null,
    auth.uid(),
    false,
    p_cash_received,
    p_payment_proof_path
  );
end;
$$;

create or replace function public.staff_update_sales_transaction(
  p_transaction_id uuid,
  p_qr_token text,
  p_items jsonb,
  p_payment_method text,
  p_reason text,
  p_admin_pin text,
  p_cash_received numeric default null,
  p_payment_proof_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_transaction public.sales_transactions;
  v_pin_hash text;
begin
  select *
  into v_employee
  from public.resolve_staff_employee(p_qr_token);

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee record not recognized.');
  end if;

  select *
  into v_transaction
  from public.sales_transactions
  where id = p_transaction_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Sales transaction not found.');
  end if;

  if v_transaction.employee_id is distinct from v_employee.id then
    return jsonb_build_object('success', false, 'message', 'You can only edit your own sales transactions.');
  end if;

  select sales_correction_pin_hash
  into v_pin_hash
  from public.owner_settings
  where id = 1;

  if v_pin_hash is null then
    return jsonb_build_object('success', false, 'message', 'Admin PIN has not been configured yet.');
  end if;

  if encode(digest(trim(coalesce(p_admin_pin, '')), 'sha256'), 'hex') <> v_pin_hash then
    return jsonb_build_object('success', false, 'message', 'Admin PIN is incorrect.');
  end if;

  return public.apply_sales_transaction_correction(
    p_transaction_id,
    p_items,
    p_payment_method,
    p_reason,
    'staff',
    v_employee.id,
    null,
    true,
    p_cash_received,
    p_payment_proof_path
  );
end;
$$;

create or replace function public.pos_checkout(
  p_qr_token text,
  p_items jsonb,
  p_payment_method text,
  p_cash_received numeric default null,
  p_payment_proof_path text default null,
  p_source_label text default 'web-pos'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_employee public.employees;
  v_item record;
  v_total numeric(10,2) := 0;
  v_transaction_number text;
  v_transaction public.sales_transactions;
  v_cash_received numeric(10,2);
  v_change_amount numeric(10,2) := 0;
  v_local_date date := (now() at time zone 'Asia/Manila')::date;
  v_local_time time := (now() at time zone 'Asia/Manila')::time;
  v_open_session record;
begin
  if p_payment_method not in ('cash', 'gcash', 'paymaya', 'bank_transfer') then
    return jsonb_build_object('success', false, 'message', 'Invalid payment method.');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'message', 'Cart is empty.');
  end if;

  select *
  into v_employee
  from public.employees
  where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee QR code not recognized.');
  end if;

  if v_employee.contract_status = 'pending_signature'
    and v_employee.contract_due_at is not null
    and v_employee.contract_due_at < now() then
    update public.employees
    set contract_status = 'expired'
    where id = v_employee.id
    returning * into v_employee;
  end if;

  if coalesce(v_employee.contract_status, 'not_sent') <> 'signed' then
    return jsonb_build_object(
      'success', false,
      'message', 'Signed contract is required before this employee can use the POS.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'status', 'contract_not_signed'
    );
  end if;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(id text, name text, price numeric, quantity integer, category text)
  loop
    if v_item.id is null or v_item.name is null or v_item.price < 0 or v_item.quantity <= 0 then
      return jsonb_build_object('success', false, 'message', 'Cart contains an invalid item.');
    end if;

    v_total := v_total + round(v_item.price * v_item.quantity, 2);
  end loop;

  v_cash_received := case when p_payment_method = 'cash' then p_cash_received else null end;

  if p_payment_method = 'cash' and coalesce(v_cash_received, 0) < v_total then
    return jsonb_build_object('success', false, 'message', 'Cash received is lower than the order total.');
  end if;

  if p_payment_method <> 'cash' and (p_payment_proof_path is null or p_payment_proof_path = '') then
    return jsonb_build_object('success', false, 'message', 'Payment proof is required for digital payments.');
  end if;

  select time_in.*
  into v_open_session
  from public.attendance_logs time_in
  where time_in.employee_id = v_employee.id
    and time_in.event_type = 'time_in'
    and not exists (
      select 1
      from public.attendance_logs time_out
      where time_out.employee_id = time_in.employee_id
        and time_out.event_type = 'time_out'
        and time_out.scanned_at > time_in.scanned_at
    )
  order by time_in.scanned_at desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'No active staff time-in session found. Please time in before using POS.',
      'employeeId', v_employee.id,
      'employeeNumber', v_employee.employee_number,
      'employeeName', v_employee.full_name,
      'status', 'no_active_session'
    );
  end if;

  v_transaction_number := public.next_transaction_number();
  v_change_amount := case when p_payment_method = 'cash' then round(v_cash_received - v_total, 2) else 0 end;

  insert into public.sales_transactions (
    transaction_number,
    employee_id,
    employee_number_snapshot,
    employee_name_snapshot,
    attendance_time_in_id,
    session_time_in_at,
    payment_method,
    total_amount,
    cash_received,
    change_amount,
    payment_proof_path,
    local_date,
    local_time,
    source_label
  )
  values (
    v_transaction_number,
    v_employee.id,
    v_employee.employee_number,
    v_employee.full_name,
    v_open_session.id,
    v_open_session.scanned_at,
    p_payment_method,
    v_total,
    v_cash_received,
    v_change_amount,
    p_payment_proof_path,
    v_local_date,
    v_local_time,
    p_source_label
  )
  returning * into v_transaction;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(id text, name text, price numeric, quantity integer, category text)
  loop
    insert into public.sales_transaction_items (
      transaction_id,
      item_id,
      item_name,
      category,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_transaction.id,
      v_item.id,
      v_item.name,
      v_item.category,
      v_item.price,
      v_item.quantity,
      round(v_item.price * v_item.quantity, 2)
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'transactionId', v_transaction.id,
    'transactionNumber', v_transaction.transaction_number,
    'totalAmount', v_total,
    'cashReceived', v_cash_received,
    'changeAmount', v_change_amount,
    'paymentProofPath', p_payment_proof_path
  );
end;
$$;

grant execute on function public.record_attendance_scan(text, text, double precision, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.list_open_attendance_sessions() to anon, authenticated;
grant execute on function public.record_attendance_time_out_by_employee(uuid, double precision, double precision, double precision, text, text) to anon, authenticated;
grant execute on function public.owner_reset_employee_qr(uuid) to authenticated;
grant execute on function public.admin_create_employee(text, text, uuid, numeric, date, text[], numeric, text, text) to authenticated;
grant execute on function public.owner_update_employee_terms(uuid, numeric, numeric, text[]) to authenticated;
grant execute on function public.owner_set_employee_active(uuid, boolean) to authenticated;
grant execute on function public.owner_attendance_dashboard() to authenticated;
grant execute on function public.owner_update_attendance_log(uuid, timestamptz, text) to authenticated;
grant execute on function public.owner_close_open_attendance_session(uuid, timestamptz, text) to authenticated;
grant execute on function public.owner_set_employee_contract_signed(uuid, boolean) to authenticated;
grant execute on function public.claim_staff_portal_access() to authenticated;
grant execute on function public.claim_management_access() to authenticated;
grant execute on function public.staff_portal_identity() to authenticated;
grant execute on function public.owner_access_invites_dashboard() to authenticated;
grant execute on function public.owner_management_accounts_dashboard() to authenticated;
grant execute on function public.owner_create_access_invite(text, text, text) to authenticated;
grant execute on function public.owner_cancel_access_invite(uuid) to authenticated;
grant execute on function public.owner_remove_management_access(uuid, text) to authenticated;
grant execute on function public.staff_dashboard(text) to anon, authenticated;
grant execute on function public.staff_sales_history(text) to anon, authenticated;
grant execute on function public.staff_contract_info(text) to anon, authenticated;
grant execute on function public.owner_employee_contract_info(uuid) to authenticated;
grant execute on function public.owner_dispatch_employee_contract(uuid, text, text) to authenticated;
grant execute on function public.staff_submit_signed_contract(text, text) to anon, authenticated;
grant execute on function public.admin_set_payroll_status(uuid, date, date, text, text, text, text) to authenticated;
grant execute on function public.owner_settings_dashboard() to authenticated;
grant execute on function public.owner_set_sales_correction_pin(text) to authenticated;
grant execute on function public.owner_set_loans_enabled(boolean) to authenticated;
grant execute on function public.owner_set_employee_loan_enabled(uuid, boolean) to authenticated;
grant execute on function public.owner_set_overtime_status(uuid, date, date, text, text) to authenticated;
grant execute on function public.submit_unpaid_leave_request(text, date, text) to anon, authenticated;
grant execute on function public.staff_leave_dashboard(text) to anon, authenticated;
grant execute on function public.owner_leave_dashboard() to authenticated;
grant execute on function public.owner_review_leave_request(uuid, text, text) to authenticated;
grant execute on function public.submit_termination_request(text, date, text, integer) to anon, authenticated;
grant execute on function public.staff_termination_dashboard(text) to anon, authenticated;
grant execute on function public.owner_termination_dashboard() to authenticated;
grant execute on function public.owner_review_termination_request(uuid, text, text) to authenticated;
grant execute on function public.owner_issue_employee_loan(uuid, numeric, text, date, text) to authenticated;
grant execute on function public.owner_record_loan_repayment(uuid, numeric, text) to authenticated;
grant execute on function public.delete_expired_payroll_payslips() to authenticated;
grant execute on function public.sales_transaction_detail(uuid, text) to anon, authenticated;
grant execute on function public.owner_update_sales_transaction(uuid, jsonb, text, text, numeric, text) to authenticated;
grant execute on function public.staff_update_sales_transaction(uuid, text, jsonb, text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.pos_checkout(text, jsonb, text, numeric, text, text) to anon, authenticated;

revoke all on function public.apply_sales_transaction_correction(uuid, jsonb, text, text, text, uuid, uuid, boolean, numeric, text) from public, anon, authenticated;
