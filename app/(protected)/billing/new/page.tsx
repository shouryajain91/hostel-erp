import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BillingForm from './BillingForm'

export default async function NewBillingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, mobile, room_id, tenancy_start_date, rooms(room_number, room_type_id, room_types(name, base_rent, capacity))')
    .eq('status', 'active')
    .order('name')

  return (
    <div className="max-w-3xl">
      <Link href="/billing" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Billing
      </Link>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        {isOwner ? 'Create Bill' : 'Request New Bill'}
      </h2>
      <p className="text-slate-500 text-sm mb-6">
        {isOwner ? 'Create a bill directly for any active tenant.' : 'Submit bill details for owner approval.'}
      </p>
      <BillingForm
        tenants={(tenants ?? []) as unknown as Parameters<typeof BillingForm>[0]['tenants']}
        isOwner={isOwner}
      />
    </div>
  )
}
