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
  role_name text,
  qr_token_hash text not null unique,
  base_daily_rate numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

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

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

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

create index if not exists idx_attendance_logs_employee_id on public.attendance_logs(employee_id);
create index if not exists idx_attendance_logs_scanned_at on public.attendance_logs(scanned_at desc);
create index if not exists idx_attendance_logs_location_id on public.attendance_logs(location_id);
create index if not exists idx_employee_shift_assignments_employee_id on public.employee_shift_assignments(employee_id);
create index if not exists idx_sales_transactions_employee_id on public.sales_transactions(employee_id);
create index if not exists idx_sales_transactions_created_at on public.sales_transactions(created_at desc);
create index if not exists idx_sales_transaction_items_transaction_id on public.sales_transaction_items(transaction_id);

alter table public.business_locations enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;
alter table public.employee_shift_assignments enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.profiles enable row level security;
alter table public.sales_transactions enable row level security;
alter table public.sales_transaction_items enable row level security;

revoke all on public.business_locations from anon, authenticated;
revoke all on public.employees from anon, authenticated;
revoke all on public.shifts from anon, authenticated;
revoke all on public.employee_shift_assignments from anon, authenticated;
revoke all on public.attendance_logs from anon, authenticated;
revoke all on public.sales_transactions from anon, authenticated;
revoke all on public.sales_transaction_items from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select on public.profiles to authenticated;
grant select on public.business_locations to authenticated;
grant select on public.employees to authenticated;
grant select on public.shifts to authenticated;
grant select on public.employee_shift_assignments to authenticated;
grant select on public.attendance_logs to authenticated;
grant select on public.sales_transactions to authenticated;
grant select on public.sales_transaction_items to authenticated;

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
      and role = 'owner'
      and is_active = true
  );
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
    qr_token_hash,
    base_daily_rate
  )
  values (
    p_employee_number,
    p_full_name,
    p_role_name,
    encode(digest(p_raw_qr_token, 'sha256'), 'hex'),
    p_base_daily_rate
  )
  returning * into inserted_employee;

  return inserted_employee;
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
    when extract(day from p_date)::integer <= 15 then date_trunc('month', p_date)::date
    else (date_trunc('month', p_date)::date + interval '15 days')::date
  end;
$$;

create or replace function public.cutoff_end_for(p_date date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::integer <= 15 then (date_trunc('month', p_date)::date + interval '14 days')::date
    else (date_trunc('month', p_date)::date + interval '1 month - 1 day')::date
  end;
$$;

create or replace function public.payday_for_cutoff(p_date date)
returns date
language sql
immutable
as $$
  select case
    when extract(day from p_date)::integer <= 15 then (date_trunc('month', p_date)::date + interval '19 days')::date
    else (date_trunc('month', p_date)::date + interval '1 month 4 days')::date
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

create or replace view public.cutoff_session_summary
with (security_invoker = true)
as
with time_ins as (
  select
    logs.*,
    employees.employee_number,
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
    shifts.scheduled_end
  from paired
  left join lateral (
    select s.*
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
    coalesce(base_daily_rate, 0) as base_daily_rate
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
    when worked_minutes is null then 0
    else greatest(0, worked_minutes - round(paid_hours * 60)::integer)
  end as overtime_minutes,
  round(
    case
      when worked_minutes is null then 0
      else greatest(0, worked_minutes - round(paid_hours * 60)::integer) / 60.0
    end,
    2
  ) as overtime_hours,
  round(
    case
      when worked_minutes is null or paid_hours <= 0 then 0
      else greatest(0, worked_minutes - round(paid_hours * 60)::integer) / 60.0 * (base_daily_rate / paid_hours) * 1.25
    end,
    2
  ) as overtime_pay,
  coalesce(worked_minutes > round(paid_hours * 60)::integer, false) as overtime_qualified,
  worked_minutes,
  round(coalesce(worked_minutes, 0) / 60.0, 2) as worked_hours,
  case when time_out_at is null then 'open' else 'completed' end as session_status,
  public.cutoff_start_for(work_date) as cutoff_start,
  public.cutoff_end_for(work_date) as cutoff_end,
  public.payday_for_cutoff(work_date) as payday,
  to_char(public.cutoff_start_for(work_date), 'Mon DD') || ' - ' || to_char(public.cutoff_end_for(work_date), 'Mon DD, YYYY') as cutoff_label
from calculated;

create or replace view public.cutoff_payroll_summary
with (security_invoker = true)
as
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
  min(time_in_at) as first_session_in,
  max(time_out_at) as last_session_out
from public.cutoff_session_summary
group by employee_id, employee_number, employee_name, cutoff_start, cutoff_end, payday, cutoff_label;

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
  ('payment-proofs', 'payment-proofs', false)
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
    'shiftName', case when p_event_type = 'time_in' then v_shift.shift_name else null end
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
  p_base_daily_rate numeric,
  p_shift_id uuid,
  p_effective_from date default null,
  p_work_days text[] default array['mon', 'tue', 'wed', 'thu', 'fri', 'sat']
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
  v_work_days text[] := coalesce(p_work_days, array['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
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
    p_base_daily_rate,
    v_employee_number
  );

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

create or replace function public.staff_dashboard(p_qr_token text)
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
begin
  select *
  into v_employee
  from public.employees
  where qr_token_hash = encode(digest(p_qr_token, 'sha256'), 'hex')
    and is_active = true;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Employee QR code not recognized.');
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

  return jsonb_build_object(
    'success', true,
    'employee', row_to_json(v_employee),
    'currentSummary', v_summary,
    'sessions', coalesce(v_sessions, '[]'::jsonb)
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
grant execute on function public.admin_create_employee(text, text, numeric, uuid, date, text[]) to authenticated;
grant execute on function public.staff_dashboard(text) to anon, authenticated;
grant execute on function public.pos_checkout(text, jsonb, text, numeric, text, text) to anon, authenticated;
