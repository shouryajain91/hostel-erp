# Database Schema — All Modules

## Enums

```sql
CREATE TYPE user_role AS ENUM ('owner', 'management');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE request_type AS ENUM (
  'create_user', 'deactivate_user',
  'create_room_type', 'update_room_type', 'delete_room_type',
  'create_room', 'update_room',
  'add_tenant', 'update_tenant', 'checkout_tenant',
  'generate_bill', 'mark_bill_paid'
);
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance');
CREATE TYPE assignment_status AS ENUM ('active', 'inactive');
CREATE TYPE bill_type AS ENUM ('monthly', 'on_demand');
CREATE TYPE bill_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid', 'cancelled');
CREATE TYPE bill_component_type AS ENUM ('rent', 'electricity', 'security_deposit', 'one_time', 'miscellaneous');
```

---

## Module 1: User Management (DONE)

```
profiles
├── id          UUID  PK  → auth.users(id)
├── phone       TEXT  UNIQUE NOT NULL
├── name        TEXT  NOT NULL
├── role        user_role  DEFAULT 'management'
├── is_active   BOOLEAN  DEFAULT true
└── created_at  TIMESTAMPTZ  DEFAULT NOW()

approval_requests
├── id            UUID  PK  DEFAULT gen_random_uuid()
├── request_type  request_type  NOT NULL
├── payload       JSONB  DEFAULT '{}'
├── status        request_status  DEFAULT 'pending'
├── notes         TEXT
├── requested_by  UUID  → profiles(id)
├── resolved_by   UUID  → profiles(id)
├── created_at    TIMESTAMPTZ  DEFAULT NOW()
└── resolved_at   TIMESTAMPTZ
```

---

## Module 2: Room Types

```
room_types
├── id            UUID  PK  DEFAULT gen_random_uuid()
├── name          TEXT  NOT NULL         -- e.g. "Single", "Double", "Dormitory"
├── description   TEXT
├── capacity      INTEGER  NOT NULL      -- max tenants per room
├── base_rent     NUMERIC(10,2)  NOT NULL
├── created_at    TIMESTAMPTZ  DEFAULT NOW()
└── updated_at    TIMESTAMPTZ  DEFAULT NOW()
```

---

## Module 3: Rooms

```
rooms
├── id            UUID  PK  DEFAULT gen_random_uuid()
├── room_number   TEXT  UNIQUE  NOT NULL
├── room_type_id  UUID  → room_types(id)
├── floor         INTEGER
├── status        room_status  DEFAULT 'available'
├── created_at    TIMESTAMPTZ  DEFAULT NOW()
└── updated_at    TIMESTAMPTZ  DEFAULT NOW()
```

---

## Module 4: Tenants

```
tenants
├── id                  UUID  PK  DEFAULT gen_random_uuid()
├── name                TEXT  NOT NULL
├── phone               TEXT  NOT NULL
├── email               TEXT
├── address             TEXT
├── id_proof_type       TEXT          -- Aadhaar, PAN, Passport, etc.
├── id_proof_number     TEXT
├── emergency_contact   TEXT
├── emergency_phone     TEXT
├── created_at          TIMESTAMPTZ  DEFAULT NOW()
└── updated_at          TIMESTAMPTZ  DEFAULT NOW()
```

---

## Module 5: Tenant Room Assignments

```
tenant_room_assignments
├── id                UUID  PK  DEFAULT gen_random_uuid()
├── tenant_id         UUID  → tenants(id)
├── room_id           UUID  → rooms(id)
├── check_in_date     DATE  NOT NULL
├── check_out_date    DATE                  -- NULL = currently checked in
├── status            assignment_status  DEFAULT 'active'
├── rent_override     NUMERIC(10,2)         -- NULL = use room_type.base_rent
├── security_deposit  NUMERIC(10,2)
└── created_at        TIMESTAMPTZ  DEFAULT NOW()

CONSTRAINT: active tenants in a room cannot exceed room_type.capacity
```

---

## Module 6 & 7: Billing

```
bills
├── id                    UUID  PK  DEFAULT gen_random_uuid()
├── tenant_id             UUID  → tenants(id)
├── room_id               UUID  → rooms(id)
├── billing_period_start  DATE
├── billing_period_end    DATE
├── due_date              DATE
├── bill_type             bill_type  NOT NULL
├── status                bill_status  DEFAULT 'draft'
├── total_amount          NUMERIC(10,2)  DEFAULT 0
├── notes                 TEXT
├── created_by            UUID  → profiles(id)
├── approved_by           UUID  → profiles(id)
├── created_at            TIMESTAMPTZ  DEFAULT NOW()
└── approved_at           TIMESTAMPTZ

UNIQUE(tenant_id, billing_period_start, billing_period_end)  -- no duplicate monthly bills

bill_components
├── id              UUID  PK  DEFAULT gen_random_uuid()
├── bill_id         UUID  → bills(id)  ON DELETE CASCADE
├── component_type  bill_component_type  NOT NULL
├── description     TEXT
├── amount          NUMERIC(10,2)  NOT NULL
├── units_consumed  NUMERIC(8,2)          -- electricity only
├── rate_per_unit   NUMERIC(6,2)          -- electricity only
└── created_at      TIMESTAMPTZ  DEFAULT NOW()
```

---

## RLS Summary

| Table | Owner | Management |
|---|---|---|
| profiles | Full CRUD | SELECT only |
| approval_requests | Full CRUD | SELECT + INSERT (own requests) |
| room_types | Full CRUD | SELECT only |
| rooms | Full CRUD | SELECT only |
| tenants | Full CRUD | SELECT only |
| tenant_room_assignments | Full CRUD | SELECT only |
| bills | Full CRUD | SELECT only |
| bill_components | Full CRUD | SELECT only |

All changes by management go through `approval_requests` → Owner approves → API route applies the change using service role.

---

## Key Triggers

### `handle_new_user` (DONE)
Fires on `auth.users` INSERT → auto-creates row in `profiles` using `raw_user_meta_data`.

### `update_room_status` (Pending)
Fires on `tenant_room_assignments` INSERT/UPDATE → sets `rooms.status` to 'occupied' or 'available' based on active assignment count.

### `update_bill_total` (Pending)
Fires on `bill_components` INSERT/UPDATE/DELETE → recalculates `bills.total_amount` as SUM of component amounts.
