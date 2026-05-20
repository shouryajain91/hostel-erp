# Hostel ERP

A cloud-hosted, mobile-responsive Hostel Management ERP built on **Next.js 14**, **Supabase**, and **Vercel** — entirely on free-tier services.

**Live:** https://hostel-erp-ruby.vercel.app

---

## Table of Contents

1. [What it does](#what-it-does)
2. [Role model](#role-model)
3. [Tech stack](#tech-stack)
4. [Architecture overview](#architecture-overview)
5. [Database schema](#database-schema)
6. [Approval workflow](#approval-workflow)
7. [Authentication design](#authentication-design)
8. [Row Level Security](#row-level-security)
9. [File structure walkthrough](#file-structure-walkthrough)
10. [Key design decisions](#key-design-decisions)
11. [Local setup](#local-setup)
12. [Known limitations](#known-limitations)

---

## What it does

| Module | Owner | Management |
|--------|-------|-----------|
| **Dashboard** | Occupancy, billing insights, pending approvals | Same + own pending requests |
| **Room Types** | Create / edit / delete | View only |
| **Rooms** | Create / edit / bulk-upload (Excel) / electricity readings | Electricity readings only |
| **Tenants** | Add / edit / checkout directly | Submit add/edit/checkout for approval |
| **Billing** | Create bills / mark paid / mark sent | Submit for approval |
| **Users** | Add staff (direct) | Request new staff |
| **Approvals** | Approve / reject all pending requests | View own pending requests |

---

## Role model

There are exactly two roles: `owner` and `management`.

- **Owner** is the hostel proprietor. All writes take effect immediately.
- **Management** is hostel staff. Every write they attempt creates an `approval_requests` row instead of modifying data directly. The owner reviews and approves or rejects from `/approvals`.

There is no self-service registration. The first owner account is seeded via `scripts/seed-owner.ts` (run locally with the service role key). All subsequent accounts are created by the owner.

---

## Tech stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend + API | Next.js 14 (App Router) | Server Components + API routes in one repo; zero infra |
| Styling | Tailwind CSS | Utility-first, no separate CSS files |
| Icons | Lucide React | Lightweight, tree-shaken |
| Database | Supabase (PostgreSQL) | Free tier, built-in auth, RLS, storage |
| Auth | Supabase Auth | Phone-as-email trick (no SMS cost) |
| File storage | Supabase Storage | KYC documents + meter photos |
| Hosting | Vercel (Hobby) | Free, auto-deploys from git |
| Excel parsing | `xlsx` | Bulk room upload without a backend service |

Everything runs within free-tier limits. No paid services, no Docker, no separate backend.

---

## Architecture overview

```
Browser
  │
  ├── Static assets (Vercel CDN)
  │
  └── Next.js App (Vercel Serverless)
        │
        ├── /app/(protected)/**   ← React Server Components (fetch data server-side)
        │     └── Client components where interactivity is needed ('use client')
        │
        ├── /app/api/**           ← Next.js Route Handlers (REST-ish API)
        │     └── All auth-checked, role-checked before writes
        │
        ├── middleware.ts          ← Edge: session refresh + route guards
        │
        └── lib/supabase/
              ├── client.ts       ← Browser Supabase client (anon key)
              ├── server.ts       ← Server Supabase client (anon key + cookies)
              └── admin.ts        ← Server-only admin client (service role key)
                                     NEVER imported in client components
```

### Request flow for a protected page

1. Browser hits `/tenants`.
2. **Middleware** reads the JWT from cookies via `@supabase/ssr`, refreshes it if needed, and redirects to `/login` if missing.
3. **`app/(protected)/layout.tsx`** runs on the server, confirms the session, fetches the user's profile, and renders the sidebar with the correct role.
4. **`app/(protected)/tenants/page.tsx`** runs on the server, queries Supabase directly (server client bypasses the anon RLS for reads scoped to the session), and passes data as props to client components.
5. Client components (`TenantSearch`, etc.) receive already-fetched data as props and handle only interactivity — no additional API calls needed for the initial render.

### Request flow for a write (management user)

1. User fills out the tenant form and clicks "Submit for Approval".
2. The client component POSTs to `/api/tenants`.
3. The API route checks the session, reads the user's role from `profiles`.
4. Because `role === 'management'`, it inserts into `approval_requests` instead of `tenants`.
5. The owner sees the request appear on `/approvals`.
6. Owner clicks Approve → `/api/users/approve` is called → the admin client (service role key) executes the actual write, bypassing RLS.

---

## Database schema

All tables are in the `public` schema with RLS enabled.

### `profiles`
Extends `auth.users`. Created automatically by a database trigger on user signup.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | FK → `auth.users.id` |
| `phone` | text | Unique; the user's real identifier |
| `name` | text | Display name |
| `role` | enum | `owner` or `management` |
| `is_active` | bool | Soft-disable without deleting the auth user |
| `created_at` | timestamptz | |

### `room_types`
Defines categories of rooms (Single, Double, Dormitory, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | text | Unique |
| `description` | text | Optional |
| `capacity` | int | Max tenants per room; enforced at application level |
| `amenities` | text[] | Array of strings, e.g. `["AC", "WiFi"]` |
| `base_rent` | numeric | Monthly rent in INR |

### `rooms`
Individual physical rooms.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `room_number` | text | Unique |
| `room_type_id` | uuid | FK → `room_types.id` |
| `floor` | int | |
| `status` | text | `available` / `occupied` / `maintenance` |
| `notes` | text | Optional |

### `electricity_readings`
Point-in-time meter readings per room.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `room_id` | uuid | FK → `rooms.id` |
| `reading_date` | timestamptz | When the reading was taken |
| `units_reading` | numeric | Absolute meter reading |
| `units_consumed` | numeric | Calculated: current − previous reading |
| `reading_photo_url` | text | Public Supabase Storage URL |
| `ocr_reading` | numeric | Reserved for future OCR integration |
| `ocr_matched` | bool | Reserved for future OCR validation |
| `recorded_by` | uuid | FK → `profiles.id` |

### `tenants`
One row per tenant per stay (a returning tenant gets a new row).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name`, `date_of_birth`, `gender`, `mobile` | — | Personal details |
| `guardian_name`, `guardian_mobile` | — | Emergency contact |
| `permanent_address` | text | |
| `room_id` | uuid | FK → `rooms.id` |
| `booking_date`, `tenancy_start_date`, `tenancy_end_date` | date | End date set when tenant notifies |
| `security_deposit` | numeric | INR |
| `kyc_doc1_name`, `kyc_doc1_url` | text | Document type + Supabase Storage URL |
| `kyc_doc2_name`, `kyc_doc2_url` | text | |
| `status` | text | `active` / `checked_out` |
| `created_by`, `approved_by` | uuid | FK → `profiles.id` |

### `bills`
One bill per tenant per billing event.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenant_id` | uuid | FK → `tenants.id` |
| `room_id` | uuid | FK → `rooms.id` |
| `bill_type` | text | `initial` / `monthly_partial` / `monthly_regular` / `full_final` |
| `billing_period_start`, `billing_period_end` | date | |
| `due_date` | date | Optional |
| `status` | text | `draft` → `sent` → `paid` (or `cancelled`) |
| `total_amount` | numeric | Sum of all bill_components |
| `created_by`, `approved_by` | uuid | FK → `profiles.id` |

### `bill_components`
Line items within a bill.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `bill_id` | uuid | FK → `bills.id` |
| `component_type` | text | `security_deposit` / `one_time_fee` / `rent` / `electricity` / `miscellaneous` / `security_refund` |
| `description` | text | Free-text remark |
| `amount` | numeric | INR |
| `units_consumed` | numeric | Electricity only |
| `rate_per_unit` | numeric | Electricity only |
| `num_tenants` | int | Electricity: how many ways to split |
| `days` | int | Rent: how many days (partial month) |

### `approval_requests`
The central approval queue. Management users write here instead of to the target table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `request_type` | enum | See list below |
| `payload` | jsonb | Full proposed data — whatever would have been inserted/updated |
| `status` | enum | `pending` / `approved` / `rejected` |
| `notes` | text | Owner's rejection reason or generated info (e.g. temp password) |
| `requested_by` | uuid | FK → `profiles.id` |
| `resolved_by` | uuid | FK → `profiles.id` |

**`request_type` values:** `create_user`, `deactivate_user`, `create_room_type`, `update_room_type`, `delete_room_type`, `create_room`, `update_room`, `add_tenant`, `update_tenant`, `checkout_tenant`, `generate_bill`, `mark_bill_paid`

---

## Approval workflow

```
Management fills form
       │
       ▼
POST /api/tenants (or /api/rooms, /api/billing, etc.)
       │
       ├── role === 'owner'  ──► Direct INSERT into target table
       │                         Return 201 with new record
       │
       └── role === 'management'
                │
                ▼
           INSERT into approval_requests
           { request_type, payload: <full proposed record>, status: 'pending' }
           Return { approval_request: { id, ... } }  (201)
                │
                ▼ (owner reviews /approvals page)
           POST /api/users/approve
           { requestId, action: 'approve' | 'reject', notes? }
                │
                ├── action === 'reject'
                │     UPDATE approval_requests SET status='rejected', notes=...
                │
                └── action === 'approve'
                      Read payload from approval_requests
                      Execute the actual INSERT/UPDATE via admin client
                      UPDATE approval_requests SET status='approved'
```

The single endpoint `/api/users/approve` handles all request types. It reads `request_type` from the stored approval request and dispatches to the appropriate handler. The admin client (service role key) is used for the actual write so it bypasses RLS.

---

## Authentication design

Supabase Auth expects an email address. Since the app uses phone + password (no SMS OTP), phones are stored as fake emails:

```
phone: "9810063883"  →  email: "9810063883@hostel.erp"
```

This conversion happens in `lib/utils.ts` (`phoneToEmail` / `emailToPhone`). The login form accepts a plain phone number and converts it before calling `supabase.auth.signInWithPassword`.

**Session management:**
- `@supabase/ssr` handles cookie-based sessions on the server.
- The middleware refreshes expired JWTs on every request.
- `export const dynamic = 'force-dynamic'` is set on `app/(protected)/layout.tsx` to prevent Next.js from statically pre-rendering pages that require a live session.

---

## Row Level Security

Every table has RLS enabled. The policies are:

| Table | Owner | Management |
|-------|-------|-----------|
| `profiles` | Full read/write | Read all; write own row |
| `room_types` | Full | Read only |
| `rooms` | Full | Read only |
| `electricity_readings` | Full | Read + insert |
| `tenants` | Full | Read only |
| `bills` | Full | Read only |
| `bill_components` | Full | Read only |
| `approval_requests` | Full | Insert + read own rows |

Management users cannot directly INSERT into `tenants`, `bills`, etc. even if they bypass the application layer — the database enforces it. The only write available to management is inserting into `approval_requests`.

The admin client (service role key, stored only in server-side environment variables) bypasses RLS. It is used exclusively in `/api/users/approve` to execute approved changes.

---

## File structure walkthrough

```
hostel-erp/
│
├── app/
│   ├── layout.tsx                    # Root HTML shell, loads globals.css
│   ├── page.tsx                      # "/" → redirect to /dashboard
│   ├── globals.css                   # Tailwind directives + @media print rules
│   │
│   ├── login/
│   │   └── page.tsx                  # Phone + password login form
│   │
│   ├── (protected)/                  # Route group: all pages behind auth
│   │   ├── layout.tsx                # Auth check → renders Sidebar + <main>
│   │   ├── dashboard/page.tsx        # Occupancy, billing stats, alerts
│   │   ├── approvals/page.tsx        # Owner: approval queue (client component)
│   │   ├── users/
│   │   │   ├── page.tsx              # Staff list
│   │   │   └── new/page.tsx          # Add/request staff
│   │   ├── room-types/
│   │   │   ├── page.tsx              # List room types
│   │   │   ├── new/page.tsx          # Create (owner only)
│   │   │   └── [id]/edit/page.tsx    # Edit (owner only)
│   │   ├── rooms/
│   │   │   ├── page.tsx              # Room grid with status chips
│   │   │   ├── BulkUploadButton.tsx  # Client: Excel upload
│   │   │   ├── new/page.tsx          # Add room
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Room detail + tenants
│   │   │       ├── edit/page.tsx     # Edit room
│   │   │       └── ElectricityReadings.tsx  # Client: reading history + form
│   │   ├── tenants/
│   │   │   ├── page.tsx              # Tenant list (server)
│   │   │   ├── TenantSearch.tsx      # Client: live search
│   │   │   ├── TenantForm.tsx        # Client: shared new/edit form + KYC upload
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Tenant detail
│   │   │       ├── edit/page.tsx
│   │   │       └── CheckoutButton.tsx  # Client: checkout modal
│   │   └── billing/
│   │       ├── page.tsx              # Bill list (server)
│   │       ├── BillingList.tsx       # Client: search + filter table
│   │       ├── new/
│   │       │   ├── page.tsx          # Server: fetch tenants, pass to form
│   │       │   └── BillingForm.tsx   # Client: smart form with auto-population
│   │       └── [id]/
│   │           ├── page.tsx          # Bill detail + WhatsApp + print link
│   │           ├── BillActions.tsx   # Client: status transition buttons
│   │           └── print/page.tsx    # Print-optimised A4 bill layout
│   │
│   └── api/
│       ├── auth/callback/route.ts    # Supabase OAuth callback (PKCE)
│       ├── room-types/
│       │   ├── route.ts              # GET list, POST create
│       │   └── [id]/route.ts         # GET, PATCH, DELETE
│       ├── rooms/
│       │   ├── route.ts              # GET list, POST create
│       │   ├── [id]/route.ts         # GET, PATCH, DELETE
│       │   ├── [id]/electricity-readings/route.ts  # GET, POST
│       │   └── bulk-upload/route.ts  # POST: multipart Excel → batch insert
│       ├── tenants/
│       │   ├── route.ts              # GET list, POST (direct or approval)
│       │   ├── [id]/route.ts         # GET, PATCH
│       │   └── [id]/checkout/route.ts  # POST checkout (direct or approval)
│       ├── billing/
│       │   ├── route.ts              # GET list, POST create
│       │   ├── [id]/route.ts         # GET detail with components
│       │   └── [id]/status/route.ts  # PATCH status
│       └── users/
│           ├── approve/route.ts      # POST: execute any approved request
│           └── create-direct/route.ts  # POST: owner creates user directly
│
├── components/
│   └── layout/
│       └── Sidebar.tsx               # Desktop sidebar + mobile drawer
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # createBrowserClient (anon key)
│   │   ├── server.ts                 # createServerClient (cookies)
│   │   └── admin.ts                  # createClient (service role — server only)
│   └── utils.ts                      # cn(), phoneToEmail(), emailToPhone()
│
├── middleware.ts                      # Session refresh + route guards
├── scripts/seed-owner.ts             # One-time: create the owner account
├── vercel.json                        # { "framework": "nextjs" }
└── .env.local                         # NOT committed (see Environment Variables)
```

---

## Key design decisions

### Phone-as-email auth
SMS OTP services cost money. By treating the phone number as the email (`9810063883@hostel.erp`), we get standard email+password auth with zero SMS cost. The user experience is unchanged — they type their phone number on the login page.

### Single approval endpoint
Rather than one endpoint per action type, all approvals flow through `POST /api/users/approve`. The handler reads `request_type` from the stored approval request and dispatches. This keeps the routing simple and means the frontend only ever needs to know one URL to approve anything.

### No ORM
Queries use the Supabase JS client directly. For a single-developer project with a stable schema, an ORM adds abstraction without benefit. The query builder is type-safe enough for the use case.

### Server Components for reads, API Routes for writes
Data fetching happens in Server Components (faster, no client-side waterfall). Mutations go through API Routes (explicit, easy to add auth checks, testable independently). Client Components are used only where interactivity is required.

### `force-dynamic` on the protected layout
Without this, Next.js tries to statically pre-render protected pages at build time. Supabase server client requires cookies (which don't exist at build time), causing the build to fail. Setting `export const dynamic = 'force-dynamic'` on `app/(protected)/layout.tsx` makes all child pages server-render on every request.

### Electricity billing split
Electricity is divided equally among the active tenants in a room. The form auto-fetches the latest electricity reading and the current occupant count to pre-calculate the amount. The user can override. The formula is: `amount = units × rate_per_unit / num_tenants`.

### Partial-month rent (10-day buckets)
Rent for mid-month joiners is calculated in three tiers based on join date:
- Joined day 1–10: full rent (30 days)
- Joined day 11–20: 2/3 rent (~20 days)
- Joined day 21–31: 1/3 rent (~10 days)

This matches common hostel practice in India and is hardcoded in `BillingForm.tsx` (`calcRentDays` function).

### PDF without a library
Bill PDFs are generated by the browser's native print dialog via `/billing/[id]/print`. The print page is a plain HTML layout with `@media print` CSS (sidebar hidden, clean A4 margins). Zero dependencies, works offline, renders identically on any browser.

### WhatsApp share
The "Share on WhatsApp" button constructs a pre-formatted text message from the bill data and opens `https://wa.me/?text=<encoded>`. This opens WhatsApp Web on desktop or the app on mobile with the message pre-filled — one tap to send.

---

## Local setup

### Prerequisites
- Node.js 18+
- A Supabase project (free tier at supabase.com)

### Steps

```bash
# 1. Clone
git clone https://github.com/shouryajain91/hostel-erp.git
cd hostel-erp

# 2. Install
npm install

# 3. Environment variables — create .env.local with:
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # never commit this

# 4. Apply database migrations
# Run the SQL for each table via Supabase Dashboard → SQL Editor:
# profiles, room_types, rooms, electricity_readings,
# tenants, bills, bill_components, approval_requests

# 5. Create Supabase Storage buckets (public):
#    kyc-documents   ← tenant KYC images
#    meter-readings  ← electricity meter photos

# 6. Create the owner account (one-time)
npx tsx scripts/seed-owner.ts

# 7. Start dev server
npm run dev
```

### Environment variables

| Variable | Where to find | Exposed to browser? |
|----------|--------------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes (safe) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Yes (safe, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **No — server only** |

The service role key bypasses RLS. It must never appear in client-side code or be committed to version control. It is only imported in `lib/supabase/admin.ts`, which is only ever called from API routes.

---

## Known limitations

### Security & access control
- **Middleware role-check makes a DB round-trip** on every request to owner-only routes. Under heavy load this adds latency. A JWT-embedded role claim would be faster but requires a custom Supabase JWT hook.
- **Management users can read all data.** RLS allows SELECT for all authenticated users. There is no row-level tenant isolation — any management user can see all tenants, all bills. This is intentional for a single-hostel setup but would need rethinking for multi-property deployments.
- **No rate limiting.** The API routes have no rate limiting. A malicious actor with valid credentials could spam `approval_requests`.
- **Approval payload is stored as plain JSON.** A crafted payload could theoretically cause unexpected behaviour when the approve handler reads it. The handler does basic shape-checking but no exhaustive schema validation.

### Business logic
- **No duplicate bill prevention.** Two "monthly_regular" bills can be created for the same tenant for the same period. There is no unique constraint on `(tenant_id, billing_period_start, bill_type)`.
- **Electricity rate is not persisted globally.** The billing form defaults to ₹8/unit. There is no settings table; the rate must be entered manually on each bill.
- **Room capacity is enforced at application level only.** There is no database-level trigger preventing more tenants than the room type's capacity. Two simultaneous submissions could both succeed (TOCTOU race).
- **Checkout does not auto-generate a Full & Final bill.** The checkout flow marks the tenant as checked out but does not prompt to create a settlement bill — this must be done manually.
- **Security deposit tracking is manual.** The deposit is stored on the tenant record and optionally as a bill component, but there is no automatic reconciliation or refund workflow.
- **The 10-day rent bucket is hardcoded.** Changing the tier structure requires editing `BillingForm.tsx`. It is not configurable from the UI.

### Infrastructure
- **Vercel Hobby plan function timeout: 10 seconds.** The bulk-upload route could hit this with very large Excel files. Functions also cold-start after idle periods (200–800 ms delay on first request).
- **Supabase free tier pauses after 1 week of inactivity.** The first request after a pause will fail until the project resumes (~30–60 seconds). Storage limit is 1 GB.
- **No background jobs.** Monthly bill generation, rent reminders, and overdue notifications would need a cron job (Vercel Cron or Supabase `pg_cron`). All billing is currently manual.
- **No email / SMS notifications.** There is no outbound messaging. Tenants are notified only when someone manually shares a bill via WhatsApp.

### OCR integration
The "Scan Meter" button on the electricity readings page is disabled with a "coming soon" tooltip. The infrastructure is in place (`ocr_reading` and `ocr_matched` columns, photo upload), but the OCR API call is not implemented.

### Testing
There are no automated tests. Before adding features — especially around billing calculations and the approval flow — a test suite would significantly reduce regression risk.

### Multi-tenancy / scale
The application is built for a single hostel. Scaling to multiple properties would require an `organisation_id` foreign key on most tables and a full rethink of RLS policies.
