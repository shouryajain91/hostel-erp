import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import TenantForm from '../../TenantForm'

export default async function EditTenantPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: { user } }, { data: tenant }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('tenants').select('*').eq('id', params.id).single(),
  ])

  if (!tenant) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, room_number, floor, room_types(name, capacity)')
    .order('room_number')

  const { data: activeCounts } = await supabase
    .from('tenants')
    .select('room_id')
    .eq('status', 'active')
    .neq('id', params.id)

  const countMap = new Map<string, number>()
  activeCounts?.forEach(({ room_id }) => countMap.set(room_id, (countMap.get(room_id) ?? 0) + 1))

  const roomOptions = (rooms ?? []).map(r => ({
    ...r,
    room_types: (r.room_types as unknown) as { name: string; capacity: number } | null,
    activeCount: countMap.get(r.id) ?? 0,
  }))

  return (
    <div className="max-w-2xl">
      <Link href={`/tenants/${params.id}`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Tenant
      </Link>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">
        {isOwner ? 'Edit Tenant' : 'Request Tenant Update'}
      </h2>
      <p className="text-slate-500 text-sm mb-6">
        {isOwner ? 'Update tenant details directly.' : 'Submit changes for owner approval.'}
      </p>
      <TenantForm
        rooms={roomOptions}
        isOwner={isOwner}
        tenantId={params.id}
        initialData={tenant}
        backHref={`/tenants/${params.id}`}
      />
    </div>
  )
}
