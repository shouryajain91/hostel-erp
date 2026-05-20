# Hostel Management ERP — Project Overview

## What Is This
A cloud-hosted, internet-accessible Hostel Management ERP built with Next.js 14 + Supabase. Two roles: Owner (approve-only) and Management (request-only). All management actions go through an approval queue before taking effect.

## Stack
| Layer         | Service              | Free Tier |
|---|---|---|
| Frontend + API | Vercel (Next.js 14) | Unlimited projects, 100GB bandwidth |
| Database      | Supabase (PostgreSQL) | 500MB, Row Level Security |
| Auth          | Supabase Auth        | 50K MAU, phone-as-username+password |
| File Storage  | Supabase Storage     | 1GB |

## Login Method
Phone number + password. Phone is stored as `{phone}@hostel.erp` in Supabase Auth (no SMS needed).

## Supabase Project
- **Project name:** hostel-erp
- **Project ID:** kdxbhueovchwbxbcjhxo
- **URL:** https://kdxbhueovchwbxbcjhxo.supabase.co
- **Region:** ap-south-1
- **Organization:** Indu Niwas (zuhsojvvchqlmybnefqs)

## Modules Planned (8 total)
| # | Module | Status |
|---|---|---|
| 1 | User Creation & Access Management | DONE |
| 2 | Room Types | Pending |
| 3 | Rooms | Pending |
| 4 | Tenants | Pending |
| 5 | Tenant Room Assignments | Pending |
| 6 | Bill Generation | Pending |
| 7 | Bill Components | Pending |
| 8 | Approval Workflow (cross-cutting) | DONE (base) |

## Docs Index
- `01-setup-steps.md` — How to get the project running
- `02-database-schema.md` — Full schema for all modules
- `03-sql-migrations.md` — Ready-to-run SQL for each module
- `04-module-plan.md` — Feature spec per module
- `05-progress.md` — What's done, what's next
