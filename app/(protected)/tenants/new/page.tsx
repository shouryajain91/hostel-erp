import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TenantForm from '../TenantForm'

export default async function NewTenantPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  // Fetch rooms with active tenant count
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_number, floor, room_types(name, capacity)')
    .neq('status', 'maintenance')
    .order('room_number')

  // Get active tenant counts per room
  const { data: activeCounts } = await supabase
    .from('tenants')
    .select('room_id')
    .eq('status', 'active')

  const countMap = new Map<string, number>()
  activeCounts?.forEach(({ room_id }) => countMap.set(room_id, (countMap.get(room_id) ?? 0) + 1))

  const roomOptions = (rooms ?? []).map(r => ({
    ...r,
    room_types: (r.room_types as unknown) as { name: string; capacity: number } | null,
    activeCount: countMap.get(r.id) ?? 0,
  }))

  return (
    <div className="max-w-2xl">
      <Link href="/tenants" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Tenants
      </Link>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        {isOwner ? 'Add Tenant' : 'Request New Tenant'}
      </h2>
      <p className="text-slate-500 text-sm mb-6">
        {isOwner ? 'Add a new tenant directly.' : 'Submit tenant details for owner approval.'}
      </p>
      <TenantForm rooms={roomOptions} isOwner={isOwner} backHref="/tenants" />
    </div>
  )
}
