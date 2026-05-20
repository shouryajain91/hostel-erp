# SQL Migrations

Each section is a self-contained migration. Run them in order via:
- Supabase Dashboard → SQL Editor, OR
- Claude Code MCP (`apply_migration`), OR
- Supabase CLI: `supabase db push`

---

## Migration 1: user_management_schema (DONE — already applied)

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('owner', 'management');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE request_type AS ENUM (
  'create_user', 'deactivate_user',
  'create_room_type', 'update_room_type', 'delete_room_type',
  'create_room', 'update_room',
  'add_tenant', 'update_tenant', 'checkout_tenant',
  'generate_bill', 'mark_bill_paid'
);

-- Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'management',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger: auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, phone, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'management')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Approval requests table
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type request_type NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status request_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  requested_by UUID NOT NULL REFERENCES profiles(id),
  resolved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Profiles
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "profiles_update_owner" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'owner')
  );

-- RLS: Approval requests
CREATE POLICY "requests_select_all" ON approval_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "requests_insert_authenticated" ON approval_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND requested_by = auth.uid());
CREATE POLICY "requests_update_owner" ON approval_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'owner')
  );
```

---

## Migration 2: room_types_and_rooms (Pending)

```sql
CREATE TYPE room_status AS ENUM ('available', 'occupied', 'maintenance');

CREATE TABLE room_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  capacity      INTEGER NOT NULL CHECK (capacity > 0),
  base_rent     NUMERIC(10,2) NOT NULL CHECK (base_rent >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE room_types ENABLE ROW LEVEL SECURITY;

CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number   TEXT UNIQUE NOT NULL,
  room_type_id  UUID NOT NULL REFERENCES room_types(id),
  floor         INTEGER,
  status        room_status NOT NULL DEFAULT 'available',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read; only owner can write
CREATE POLICY "room_types_select" ON room_types FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "room_types_insert_owner" ON room_types FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "room_types_update_owner" ON room_types FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "room_types_delete_owner" ON room_types FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "rooms_insert_owner" ON rooms FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "rooms_update_owner" ON rooms FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER room_types_updated_at BEFORE UPDATE ON room_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Migration 3: tenants_and_assignments (Pending)

```sql
CREATE TYPE assignment_status AS ENUM ('active', 'inactive');

CREATE TABLE tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  address           TEXT,
  id_proof_type     TEXT,
  id_proof_number   TEXT,
  emergency_contact TEXT,
  emergency_phone   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE tenant_room_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  room_id           UUID NOT NULL REFERENCES rooms(id),
  check_in_date     DATE NOT NULL,
  check_out_date    DATE,
  status            assignment_status NOT NULL DEFAULT 'active',
  rent_override     NUMERIC(10,2),
  security_deposit  NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tenant_room_assignments ENABLE ROW LEVEL SECURITY;

-- Enforce room capacity via trigger
CREATE OR REPLACE FUNCTION check_room_capacity()
RETURNS TRIGGER AS $$
DECLARE
  cap INTEGER;
  current_count INTEGER;
BEGIN
  SELECT rt.capacity INTO cap
  FROM rooms r JOIN room_types rt ON r.room_type_id = rt.id
  WHERE r.id = NEW.room_id;

  SELECT COUNT(*) INTO current_count
  FROM tenant_room_assignments
  WHERE room_id = NEW.room_id AND status = 'active'
    AND id != COALESCE(NEW.id, gen_random_uuid());

  IF current_count >= cap THEN
    RAISE EXCEPTION 'Room is at full capacity (% tenants)', cap;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_room_capacity
  BEFORE INSERT OR UPDATE ON tenant_room_assignments
  FOR EACH ROW WHEN (NEW.status = 'active')
  EXECUTE FUNCTION check_room_capacity();

-- Auto-update room status
CREATE OR REPLACE FUNCTION sync_room_status()
RETURNS TRIGGER AS $$
DECLARE active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM tenant_room_assignments
  WHERE room_id = COALESCE(NEW.room_id, OLD.room_id) AND status = 'active';

  UPDATE rooms
  SET status = CASE WHEN active_count > 0 THEN 'occupied'::room_status ELSE 'available'::room_status END
  WHERE id = COALESCE(NEW.room_id, OLD.room_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_room_status_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tenant_room_assignments
  FOR EACH ROW EXECUTE FUNCTION sync_room_status();

-- RLS
CREATE POLICY "tenants_select" ON tenants FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tenants_insert_owner" ON tenants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "tenants_update_owner" ON tenants FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

CREATE POLICY "assignments_select" ON tenant_room_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "assignments_insert_owner" ON tenant_room_assignments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "assignments_update_owner" ON tenant_room_assignments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## Migration 4: billing (Pending)

```sql
CREATE TYPE bill_type AS ENUM ('monthly', 'on_demand');
CREATE TYPE bill_status AS ENUM ('draft', 'pending_approval', 'approved', 'paid', 'cancelled');
CREATE TYPE bill_component_type AS ENUM ('rent', 'electricity', 'security_deposit', 'one_time', 'miscellaneous');

CREATE TABLE bills (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  room_id               UUID NOT NULL REFERENCES rooms(id),
  billing_period_start  DATE,
  billing_period_end    DATE,
  due_date              DATE,
  bill_type             bill_type NOT NULL DEFAULT 'monthly',
  status                bill_status NOT NULL DEFAULT 'draft',
  total_amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_by            UUID REFERENCES profiles(id),
  approved_by           UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at           TIMESTAMPTZ,
  UNIQUE (tenant_id, billing_period_start, billing_period_end)
);
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

CREATE TABLE bill_components (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  component_type  bill_component_type NOT NULL,
  description     TEXT,
  amount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  units_consumed  NUMERIC(8,2),
  rate_per_unit   NUMERIC(6,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE bill_components ENABLE ROW LEVEL SECURITY;

-- Auto-recalculate bill total when components change
CREATE OR REPLACE FUNCTION recalculate_bill_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bills
  SET total_amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM bill_components
    WHERE bill_id = COALESCE(NEW.bill_id, OLD.bill_id)
  )
  WHERE id = COALESCE(NEW.bill_id, OLD.bill_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER recalculate_total
  AFTER INSERT OR UPDATE OR DELETE ON bill_components
  FOR EACH ROW EXECUTE FUNCTION recalculate_bill_total();

-- RLS
CREATE POLICY "bills_select" ON bills FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bills_insert_owner" ON bills FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "bills_update_owner" ON bills FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);

CREATE POLICY "bill_components_select" ON bill_components FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bill_components_insert_owner" ON bill_components FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "bill_components_update_owner" ON bill_components FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
CREATE POLICY "bill_components_delete_owner" ON bill_components FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'owner')
);
```
