/**
 * Run once to create the owner account:
 *   npx ts-node --project tsconfig.json scripts/seed-owner.ts
 *
 * Set OWNER_PHONE and OWNER_PASSWORD as env vars or edit below.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const OWNER_NAME = process.env.OWNER_NAME || 'Owner'
const OWNER_PHONE = process.env.OWNER_PHONE || '9999999999'
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'ChangeMe@123'

async function main() {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const email = `${OWNER_PHONE}@hostel.erp`

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { name: OWNER_NAME, phone: OWNER_PHONE, role: 'owner' },
  })

  if (error) {
    console.error('Error creating owner:', error.message)
    process.exit(1)
  }

  console.log(`Owner created successfully!`)
  console.log(`  Name:     ${OWNER_NAME}`)
  console.log(`  Phone:    ${OWNER_PHONE}`)
  console.log(`  Password: ${OWNER_PASSWORD}`)
  console.log(`  User ID:  ${data.user?.id}`)
  console.log(`\nLogin with phone: ${OWNER_PHONE} and the password above.`)
}

main()
