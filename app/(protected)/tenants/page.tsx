import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import TenantSearch from './TenantSearch'

export default async function TenantsPage() {
  const supabase = createClient()
  const [{ data: { user } }, { data: tenants }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('tenants')
      .select('id, name, mobile, status, tenancy_start_date, tenancy_end_date, rooms(room_number, room_types(name))')
      .order('created_at', { ascending: false }),
  ])

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const active = tenants?.filter(t => t.status === 'active') ?? []
  const checkedOut = tenants?.filter(t => t.status === 'checked_out') ?? []

  // Management: show their own pending approvals too
  let pendingApprovals: { id: string; created_at: string; payload: Record<string, unknown> }[] = []
  if (!isOwner) {
    const { data } = await supabase
      .from('approval_requests')
      .select('id, created_at, payload')
      .eq('requested_by', user!.id)
      .in('request_type', ['add_tenant', 'update_tenant', 'checkout_tenant'])
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    pendingApprovals = (data ?? []) as typeof pendingApprovals
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tenants</h2>
          <p className="text-sm text-slate-500 mt-0.5">{active.length} active · {checkedOut.length} checked out</p>
        </div>
        <Link
          href="/tenants/new"
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          {isOwner ? 'Add Tenant' : 'Request Tenant'}
        </Link>
      </div>

      {!isOwner && pendingApprovals.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Your Pending Submissions ({pendingApprovals.length})</p>
          <div className="space-y-1">
            {pendingApprovals.map(a => (
              <div key={a.id} className="text-xs text-amber-700 flex justify-between">
                <span>{String((a.payload as Record<string, unknown>).name ?? (a.payload as Record<string, unknown>).tenant_name ?? 'Request')}</span>
                <span>{new Date(a.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">Awaiting owner approval</p>
        </div>
      )}

      {!tenants?.length ? (
        <div className="text-center py-20 text-slate-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No tenants yet</p>
          <p className="text-sm mt-1">Add the first tenant to get started</p>
        </div>
      ) : (
        <TenantSearch tenants={tenants as unknown as Parameters<typeof TenantSearch>[0]['tenants']} isOwner={isOwner} />
      )}
    </div>
  )
}
