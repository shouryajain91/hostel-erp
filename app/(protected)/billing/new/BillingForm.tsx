'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type RoomType = { name: string; base_rent: number; capacity: number }
type Room = { room_number: string; room_type_id: string; room_types: RoomType | null }
type TenantOption = {
  id: string; name: string; mobile: string; room_id: string
  tenancy_start_date: string; rooms: Room | null
}

type Component = {
  component_type: string
  description: string
  amount: string
  units_consumed: string
  rate_per_unit: string
  num_tenants: string
  days: string
}

const BILL_TYPES = [
  { value: 'initial', label: 'Initial Payment (Security + One-time)' },
  { value: 'monthly_partial', label: 'Monthly – Partial Month' },
  { value: 'monthly_regular', label: 'Monthly – Regular' },
  { value: 'full_final', label: 'Full & Final Settlement' },
]

const COMPONENT_TYPES = [
  { value: 'security_deposit', label: 'Security Deposit' },
  { value: 'one_time_fee', label: 'One-time Fee' },
  { value: 'rent', label: 'Rent' },
  { value: 'electricity', label: 'Electricity' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
  { value: 'security_refund', label: 'Security Refund' },
]

function emptyComponent(type: string): Component {
  return { component_type: type, description: '', amount: '', units_consumed: '', rate_per_unit: '', num_tenants: '', days: '' }
}

function calcRentDays(base_rent: number, joinDate: string): { amount: number; days: number } {
  const d = new Date(joinDate).getDate()
  if (d <= 10) return { amount: base_rent, days: 30 }
  if (d <= 20) return { amount: Math.round((base_rent * 2) / 3), days: 20 }
  return { amount: Math.round(base_rent / 3), days: 10 }
}

export default function BillingForm({ tenants, isOwner }: { tenants: TenantOption[]; isOwner: boolean }) {
  const router = useRouter()
  const supabase = createClient()

  const [tenantId, setTenantId] = useState('')
  const [billType, setBillType] = useState('monthly_regular')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const tenant = tenants.find(t => t.id === tenantId)
  const room = tenant?.rooms
  const baseRent = room?.room_types?.base_rent ?? 0

  // Auto-populate components when bill type or tenant changes
  useEffect(() => {
    if (!tenantId || !billType) return

    const fetchElectricity = async () => {
      if (!tenant?.room_id) return null
      const { data } = await supabase
        .from('electricity_readings')
        .select('units_consumed, reading_date')
        .eq('room_id', tenant.room_id)
        .order('reading_date', { ascending: false })
        .limit(1)
      return data?.[0] ?? null
    }

    const fetchOccupants = async () => {
      if (!tenant?.room_id) return 1
      const { count } = await supabase
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', tenant.room_id)
        .eq('status', 'active')
      return count ?? 1
    }

    const build = async () => {
      const [elec, occupants] = await Promise.all([fetchElectricity(), fetchOccupants()])

      if (billType === 'initial') {
        setComponents([
          emptyComponent('security_deposit'),
          emptyComponent('one_time_fee'),
        ])
        return
      }

      if (billType === 'monthly_partial') {
        const joinDate = tenant?.tenancy_start_date ?? ''
        const { amount: rentAmt, days } = joinDate ? calcRentDays(baseRent, joinDate) : { amount: baseRent, days: 30 }
        const elecAmount = elec?.units_consumed
          ? Math.round((elec.units_consumed * 8) / occupants)  // default ₹8/unit
          : 0

        setComponents([
          { ...emptyComponent('rent'), amount: String(rentAmt), days: String(days), description: `Rent for ${days} days` },
          {
            ...emptyComponent('electricity'),
            units_consumed: elec?.units_consumed ? String(elec.units_consumed) : '',
            rate_per_unit: '8',
            num_tenants: String(occupants),
            amount: String(elecAmount),
            description: `Electricity ÷ ${occupants} tenant${occupants > 1 ? 's' : ''}`,
          },
          emptyComponent('miscellaneous'),
        ])
        return
      }

      if (billType === 'monthly_regular') {
        const elecAmount = elec?.units_consumed
          ? Math.round((elec.units_consumed * 8) / occupants)
          : 0

        setComponents([
          { ...emptyComponent('rent'), amount: String(baseRent), description: 'Monthly rent' },
          {
            ...emptyComponent('electricity'),
            units_consumed: elec?.units_consumed ? String(elec.units_consumed) : '',
            rate_per_unit: '8',
            num_tenants: String(occupants),
            amount: String(elecAmount),
            description: `Electricity ÷ ${occupants} tenant${occupants > 1 ? 's' : ''}`,
          },
          emptyComponent('miscellaneous'),
        ])
        return
      }

      if (billType === 'full_final') {
        setComponents([
          { ...emptyComponent('rent'), amount: '', description: 'Final month rent (if applicable)' },
          {
            ...emptyComponent('electricity'),
            units_consumed: elec?.units_consumed ? String(elec.units_consumed) : '',
            rate_per_unit: '8',
            num_tenants: String(occupants),
            amount: elec?.units_consumed ? String(Math.round((elec.units_consumed * 8) / occupants)) : '',
            description: `Final electricity ÷ ${occupants} tenant${occupants > 1 ? 's' : ''}`,
          },
          emptyComponent('miscellaneous'),
          { ...emptyComponent('security_refund'), amount: '', description: 'Security deposit refund' },
        ])
        return
      }
    }

    build()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, billType])

  // Recalculate electricity when units or rate changes
  const updateComponent = (i: number, field: keyof Component, value: string) => {
    setComponents(prev => {
      const updated = [...prev]
      updated[i] = { ...updated[i], [field]: value }
      if (updated[i].component_type === 'electricity') {
        const u = parseFloat(updated[i].units_consumed || '0')
        const r = parseFloat(updated[i].rate_per_unit || '0')
        const n = parseInt(updated[i].num_tenants || '1')
        if (u > 0 && r > 0 && n > 0) {
          updated[i].amount = String(Math.round((u * r) / n))
        }
      }
      return updated
    })
  }

  const addComponent = () => setComponents(prev => [...prev, emptyComponent('miscellaneous')])
  const removeComponent = (i: number) => setComponents(prev => prev.filter((_, idx) => idx !== i))

  const total = components.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !periodStart || !periodEnd || !components.length) {
      setError('Please fill all required fields and add at least one component.')
      return
    }
    setLoading(true)
    setError('')

    const body = {
      tenant_id: tenantId,
      room_id: tenant?.room_id,
      bill_type: billType,
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      due_date: dueDate || null,
      notes: notes || null,
      components: components.filter(c => c.amount && parseFloat(c.amount) !== 0),
    }

    const res = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }

    if (data.approval_request) {
      setSubmitted(true)
      return
    }

    router.push(`/billing/${data.id}`)
    router.refresh()
  }

  if (submitted) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <p className="text-lg font-semibold text-amber-800">Submitted for Approval</p>
        <p className="text-sm text-amber-700 mt-2">The bill will be created once the owner approves your request.</p>
        <button onClick={() => router.push('/billing')} className="mt-4 text-sm text-blue-600 hover:underline">Back to Billing</button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Tenant + Bill Type */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h3 className="font-semibold text-slate-900">Bill Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Tenant *</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select tenant…</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} — Room {t.rooms?.room_number ?? '?'} ({t.mobile})
                </option>
              ))}
            </select>
            {tenant && (
              <p className="text-xs text-slate-500 mt-1">
                Room {tenant.rooms?.room_number} · {tenant.rooms?.room_types?.name} · ₹{baseRent.toLocaleString('en-IN')}/month
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Bill Type *</label>
            <select
              value={billType}
              onChange={e => setBillType(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {BILL_TYPES.map(bt => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period Start *</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period End *</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Bill Components</h3>
          <button type="button" onClick={addComponent}
            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
            <Plus size={14} /> Add Line
          </button>
        </div>

        <div className="space-y-4">
          {components.map((comp, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-4 bg-slate-50">
              <div className="flex items-center justify-between mb-3">
                <select
                  value={comp.component_type}
                  onChange={e => updateComponent(i, 'component_type', e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {COMPONENT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
                <button type="button" onClick={() => removeComponent(i)}
                  className="text-slate-400 hover:text-red-500">
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="Description / remark"
                    value={comp.description}
                    onChange={e => updateComponent(i, 'description', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {comp.component_type === 'electricity' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Units consumed</label>
                      <input type="number" step="0.01" placeholder="Units"
                        value={comp.units_consumed}
                        onChange={e => updateComponent(i, 'units_consumed', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Rate per unit (₹)</label>
                      <input type="number" step="0.01" placeholder="₹/unit"
                        value={comp.rate_per_unit}
                        onChange={e => updateComponent(i, 'rate_per_unit', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">No. of tenants (for split)</label>
                      <input type="number" min="1"
                        value={comp.num_tenants}
                        onChange={e => updateComponent(i, 'num_tenants', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </>
                )}

                {comp.component_type === 'rent' && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Days</label>
                    <input type="number" min="1" max="31"
                      value={comp.days}
                      onChange={e => updateComponent(i, 'days', e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                <div className={comp.component_type === 'electricity' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs text-slate-500 mb-1">Amount (₹) *</label>
                  <input type="number" step="0.01" required
                    value={comp.amount}
                    onChange={e => updateComponent(i, 'amount', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>
          ))}

          {!components.length && (
            <p className="text-center text-sm text-slate-400 py-4">Select a tenant and bill type to auto-populate components</p>
          )}
        </div>

        {components.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="text-xl font-bold text-slate-900">₹{total.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-3 rounded-lg transition-colors">
          {loading ? 'Saving…' : isOwner ? 'Create Bill' : 'Submit for Approval'}
        </button>
        <button type="button" onClick={() => router.back()}
          className="px-6 py-3 border border-slate-200 text-sm font-medium text-slate-700 rounded-lg hover:bg-slate-50">
          Cancel
        </button>
      </div>
    </form>
  )
}
