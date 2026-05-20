import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import CheckoutButton from './CheckoutButton'

export default async function TenantDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: { user } }, { data: tenant }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('tenants')
      .select('*, rooms(room_number, floor, room_types(name, base_rent))')
      .eq('id', params.id)
      .single(),
  ])

  if (!tenant) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const room = tenant.rooms as { room_number: string; floor: number; room_types: { name: string; base_rent: number } | null } | null

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-900">{value || '—'}</p>
    </div>
  )

  return (
    <div className="max-w-2xl">
      <Link href="/tenants" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Tenants
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">{tenant.name}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${
              tenant.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {tenant.status === 'checked_out' ? 'Checked Out' : 'Active'}
            </span>
          </div>
          <p className="text-slate-500 text-sm">Room {room?.room_number} · {room?.room_types?.name} · Floor {room?.floor}</p>
        </div>
        <div className="flex items-center gap-2">
          {tenant.status === 'active' && (
            <CheckoutButton tenantId={tenant.id} tenantName={tenant.name} isOwner={isOwner} />
          )}
          <Link href={`/tenants/${tenant.id}/edit`} className="inline-flex items-center gap-1.5 text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
            <Pencil size={14} /> Edit
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {/* Personal */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Personal Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date of Birth" value={tenant.date_of_birth ? new Date(tenant.date_of_birth).toLocaleDateString('en-IN') : null} />
            <Field label="Gender" value={tenant.gender ? tenant.gender.charAt(0).toUpperCase() + tenant.gender.slice(1) : null} />
            <Field label="Mobile" value={tenant.mobile} />
            <Field label="Guardian Name" value={tenant.guardian_name} />
            <Field label="Guardian Mobile" value={tenant.guardian_mobile} />
            <div className="col-span-2"><Field label="Permanent Address" value={tenant.permanent_address} /></div>
          </div>
        </div>

        {/* Tenancy */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Tenancy Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Booking Date" value={tenant.booking_date ? new Date(tenant.booking_date).toLocaleDateString('en-IN') : null} />
            <Field label="Tenancy Start" value={tenant.tenancy_start_date ? new Date(tenant.tenancy_start_date).toLocaleDateString('en-IN') : null} />
            <Field label="Security Deposit" value={tenant.security_deposit != null ? `₹${Number(tenant.security_deposit).toLocaleString('en-IN')}` : null} />
            <Field label="Monthly Rent" value={room?.room_types?.base_rent != null ? `₹${Number(room.room_types.base_rent).toLocaleString('en-IN')}` : null} />
            {tenant.tenancy_end_date && (
              <Field label="Tenancy End" value={new Date(tenant.tenancy_end_date).toLocaleDateString('en-IN')} />
            )}
          </div>
        </div>

        {/* KYC */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">KYC Documents</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: tenant.kyc_doc1_name, url: tenant.kyc_doc1_url, label: 'Document 1' },
              { name: tenant.kyc_doc2_name, url: tenant.kyc_doc2_url, label: 'Document 2' },
            ].map((doc, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{doc.label}: {doc.name}</p>
                {doc.url && (
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={doc.url} alt={doc.name} className="w-full h-36 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
