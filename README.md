# Cup of Joy Staff App Starter v2

This version now includes:

1. Attendance login/logout using QR scan + selfie + geofence validation
2. Real Cup of Joy POS menu based on the menu images you sent
3. Payroll-ready attendance fields for lateness deduction by actual late minutes

## Stack

- Frontend: React + Vite
- Hosting: Netlify
- Database and storage: Supabase
- Secure attendance handling: Supabase SQL RPC functions

## What is included

### Attendance
- QR scan for employee code
- Time In and Time Out actions
- Browser location request
- Selfie capture before submit
- Upload selfie to Supabase Storage
- Save attendance log with nearest allowed location and distance
- Save local date and local time in Asia/Manila
- Compute late minutes during Time In
- Compute payroll deduction based on daily rate, paid hours, and late minutes

### POS
- Real Cup of Joy menu items for coffee, milk based drinks, fruit soda, meals, snacks, and add-ons
- Cart and totals
- Ready for next step checkout, sales logs, and stock deduction

## Payroll logic used in this starter

This starter uses the safest default payroll rule for tardiness:

- Deduct only the actual late minutes
- Do not apply a separate fixed penalty inside the system
- Formula:

```text
minute rate = daily rate / (paid hours x 60)
late deduction = minute rate x late minutes
```

Example:

```text
daily rate = 500
paid hours = 8
minute rate = 500 / 480 = 1.0417
15 minutes late = 15.63 deduction
```

If you want a grace period, set it in the assigned shift.

## Project structure

- `src/` React app
- `supabase/sql/schema.sql` database schema with shifts and payroll-ready attendance logs
- `supabase/sql/schema.sql` includes secure SQL RPC functions for attendance logging, employee onboarding, POS checkout, dashboards, and payroll summaries

## Setup

### 1. Create your Supabase project
Create a new Supabase project.

### 2. Run the SQL schema
Open the SQL editor in Supabase and run `supabase/sql/schema.sql`.

### 3. Create a private storage bucket
Create a bucket named `attendance-selfies`.
Keep it private.

### 4. Add site locations
Insert your allowed locations into `business_locations`.

Example:

```sql
insert into public.business_locations (name, latitude, longitude, allowed_radius_m, is_active)
values
  ('Cup of Joy Udiao Shop', 16.240000, 120.490000, 120, true),
  ('Rosario Food Bazaar', 16.230000, 120.480000, 150, true);
```

Replace the coordinates with your real locations.

### 5. Add shifts
Example:

```sql
insert into public.shifts (shift_name, scheduled_start, scheduled_end, paid_hours, grace_minutes)
values
  ('Opening Shift', '08:00:00', '17:00:00', 8, 5),
  ('Mid Shift', '11:00:00', '20:00:00', 8, 5),
  ('Closing Shift', '15:00:00', '00:00:00', 8, 5),
  ('Bazaar Shift', '13:00:00', '22:00:00', 8, 5);
```

### 6. Add employees
For each employee, generate a random QR token. Put only the hash into the database.

```sql
select public.create_employee_with_qr('Sammy', 'Barista', 'sammy-secret-token-001', 500);
select public.create_employee_with_qr('Puyot', 'Staff', 'puyot-secret-token-001', 500);
```

The QR code image should contain only the raw token like `sammy-secret-token-001`.

### 7. Assign shifts
Example:

```sql
insert into public.employee_shift_assignments (employee_id, shift_id, effective_from)
select e.id, s.id, current_date
from public.employees e
cross join public.shifts s
where e.full_name = 'Sammy'
  and s.shift_name = 'Opening Shift';
```

### 8. Configure Netlify environment variables
Add these environment variables in Netlify:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 9. Local run
```bash
npm install
npm run dev
```

### 10. Netlify deploy
Push this project to GitHub and connect it to Netlify.
Build command: `npm run build`
Publish directory: `dist`

## Suggested next steps

1. Add employee list and real daily rates
2. Add real coordinates for Udiao shop and bazaar
3. Generate one QR per employee
4. Add sales history table
5. Add stock recipes and inventory deduction
6. Add admin dashboard and payroll summary export
