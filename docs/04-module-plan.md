# Module Feature Specifications

## How All Modules Work (Common Pattern)

**Management flow:**
1. Fills a form → creates row in `approval_requests` with `payload` (proposed data)
2. Sees request listed as "Pending" in their dashboard

**Owner flow:**
1. Sees pending request in Approval Queue (`/approvals`)
2. Reviews payload details
3. Approves → API route applies the change to the actual table
4. Rejects → request marked rejected with optional notes

---

## Module 1: User Management (DONE)

### Pages
- `/users` — List all staff (name, phone, role, status, joined date)
- `/users/new` — Add user form
- `/approvals` — Owner's queue (handles all module approvals)

### Approval Types
- `create_user` — Management requests new staff account
  - Payload: `{ name, phone }`
  - On approve: owner also sets initial password; system creates auth user
- `deactivate_user` — Management requests deactivation
  - Payload: `{ userId, name }`
  - On approve: `profiles.is_active = false`, user banned in Supabase Auth

### Owner Direct Actions
- Owner can create users directly (sets password immediately)
- Password shared with new staff — they can change it (future: add change-password page)

---

## Module 2: Room Types

### Pages
- `/room-types` — List (name, capacity, base rent, room count)
- `/room-types/new` — Add form
- `/room-types/[id]/edit` — Edit form

### Fields
| Field | Type | Notes |
|---|---|---|
| name | text | e.g. "Single AC", "Double Non-AC" |
| description | text | optional |
| capacity | integer | max tenants in one room of this type |
| base_rent | numeric | monthly rent in ₹ |

### Approval Types
- `create_room_type` — Payload: `{ name, description, capacity, base_rent }`
- `update_room_type` — Payload: `{ id, name, description, capacity, base_rent }`
- `delete_room_type` — Payload: `{ id, name }` (blocked if rooms exist for this type)

---

## Module 3: Rooms

### Pages
- `/rooms` — Grid/list view with status color coding (green=available, red=occupied, grey=maintenance)
- `/rooms/new` — Add form
- `/rooms/[id]` — Room detail: type info + current tenants + assignment history
- `/rooms/[id]/edit` — Edit form

### Fields
| Field | Type | Notes |
|---|---|---|
| room_number | text | unique identifier, e.g. "101", "G-05" |
| room_type_id | FK | links to room type |
| floor | integer | optional |
| status | enum | auto-managed by trigger (available/occupied/maintenance) |

### Approval Types
- `create_room` — Payload: `{ room_number, room_type_id, floor }`
- `update_room` — Payload: `{ id, room_number, room_type_id, floor }` (can't change type if occupied)

---

## Module 4: Tenants

### Pages
- `/tenants` — Searchable list (name, phone, current room, check-in date)
- `/tenants/new` — Add form (personal details + room assignment)
- `/tenants/[id]` — Tenant detail: personal info + room history + bill history
- `/tenants/[id]/edit` — Edit personal details
- `/tenants/[id]/checkout` — Checkout form

### Fields (Personal)
| Field | Required | Notes |
|---|---|---|
| name | yes | |
| phone | yes | |
| email | no | |
| address | no | |
| id_proof_type | no | Aadhaar / PAN / Passport / Driving License |
| id_proof_number | no | |
| emergency_contact | no | Name of contact |
| emergency_phone | no | |

### Fields (Room Assignment — on check-in)
| Field | Required | Notes |
|---|---|---|
| room_id | yes | dropdown of available rooms |
| check_in_date | yes | |
| rent_override | no | leave blank to use room type base rent |
| security_deposit | no | |

### Approval Types
- `add_tenant` — Payload: all personal fields + room assignment fields
- `update_tenant` — Payload: `{ id, ...changed fields }`
- `checkout_tenant` — Payload: `{ tenant_id, assignment_id, check_out_date }`

### Business Rules
- A tenant can only be in one active room at a time
- Room capacity check enforced at DB level (trigger)
- Checkout sets `assignment_status = 'inactive'` and `check_out_date`
- Room status auto-updates to 'available' when all tenants check out

---

## Module 5: Bill Generation

### Pages
- `/billing` — All bills list with filters (tenant, status, date range, type)
- `/billing/new` — Create bill form
- `/billing/[id]` — Bill detail with components, approve/mark paid buttons

### Bill Types
- **Monthly** — standard rent cycle (blocked if same tenant+period already billed)
- **On Demand** — ad hoc charges (electricity reads, damages, etc.)

### Bill Components
| Type | Description | Amount Calc |
|---|---|---|
| rent | Monthly rent | manual (defaults to rent_override or base_rent) |
| electricity | Units × rate | `units_consumed × rate_per_unit` |
| security_deposit | One-time on check-in | manual |
| one_time | One-off charge | manual |
| miscellaneous | Anything else | manual |

### Approval Types
- `generate_bill` — Payload: `{ tenant_id, room_id, period, components: [...] }`
  - On approve: bill inserted with status `approved`, components inserted, total auto-calculated
- `mark_bill_paid` — Payload: `{ bill_id, tenant_name, amount }`
  - On approve: `bills.status = 'paid'`

### Bill Lifecycle
```
draft → pending_approval → approved → paid
                       ↘ cancelled
```

### Business Rules
- `total_amount` always equals `SUM(bill_components.amount)` — maintained by DB trigger
- Electricity: if `units_consumed` and `rate_per_unit` are provided, `amount` is computed automatically
- Monthly bills: UNIQUE constraint on `(tenant_id, billing_period_start, billing_period_end)`

---

## Module 6 (Future): Reports / Analytics

### Owner Dashboard Stats
- Total rooms / occupied / available
- Total active tenants
- Monthly revenue (sum of approved bills this month)
- Outstanding dues (approved but unpaid bills)
- Pending approvals count

### Planned Report Pages
- `/reports/occupancy` — Room occupancy over time
- `/reports/revenue` — Monthly revenue chart
- `/reports/dues` — Tenants with unpaid bills
