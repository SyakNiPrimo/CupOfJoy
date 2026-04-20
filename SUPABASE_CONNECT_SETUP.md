# Cup of Joy Supabase Setup

This is now a SQL-only Supabase setup. You do not need to install the Supabase CLI and you do not need to deploy Edge Functions.

## Project

- Supabase URL: `https://wnomsdhflyxowrfjspzt.supabase.co`
- Owner email: `benedick.tiaga04@gmail.com`
- Owner UID: `ee11a4c9-7e33-4aa2-9e00-e89d68d9c1b4`
- Business location: `16.218029203312543, 120.50345211124746`

## 1. Create The Owner User

In Supabase Dashboard:

1. Go to Authentication.
2. Create or confirm the user `benedick.tiaga04@gmail.com`.
3. Make sure the UID is `ee11a4c9-7e33-4aa2-9e00-e89d68d9c1b4`.

## 2. Run The SQL

Open Supabase SQL Editor and run:

```text
Cup_of_Joy_FRESH_SUPABASE_SETUP.sql
```

This creates:

- business location
- default shifts
- owner profile
- employees and employee schedules
- attendance logs
- POS sales tables
- payroll and sales summary views
- private storage buckets
- storage upload policies
- SQL RPC functions used by the app

The app uses these RPC functions:

- `record_attendance_scan`
- `admin_create_employee`
- `staff_dashboard`
- `pos_checkout`

## 3. Frontend Environment Variables

Use these in local `.env` and in Netlify:

```text
VITE_SUPABASE_URL=https://wnomsdhflyxowrfjspzt.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

No service-role key is needed in the app.

## 4. Owner Workflow

1. Open the app.
2. Go to Dashboard.
3. Switch to Admin.
4. Sign in as `benedick.tiaga04@gmail.com`.
5. Use Employee Onboarding to add name, role, daily rate, shift, schedule start date, and work days.
6. The system auto-generates the employee number and QR code.
