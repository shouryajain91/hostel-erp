import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const BILL_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial Payment',
  monthly_partial: 'Monthly Bill – Partial Month',
  monthly_regular: 'Monthly Bill',
  full_final: 'Full & Final Settlement',
}

const COMPONENT_LABELS: Record<string, string> = {
  security_deposit: 'Security Deposit',
  one_time_fee: 'One-time Fee',
  rent: 'Rent',
  electricity: 'Electricity',
  miscellaneous: 'Miscellaneous',
  security_refund: 'Security Refund',
}

type BillComponent = {
  id: string; component_type: string; description: string | null
  amount: number; units_consumed: number | null; rate_per_unit: number | null
  num_tenants: number | null; days: number | null
}

export default async function BillPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: bill } = await supabase.from('bills').select(`
    *,
    tenants(id, name, mobile, guardian_name, permanent_address, tenancy_start_date),
    rooms(room_number, floor, room_types(name)),
    bill_components(*)
  `).eq('id', params.id).single()

  if (!bill) notFound()

  const tenant = bill.tenants as unknown as { name: string; mobile: string; permanent_address: string }
  const room = bill.rooms as unknown as { room_number: string; floor: number; room_types: { name: string } | null }
  const components = (bill.bill_components as unknown as BillComponent[]) ?? []

  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 20mm; size: A4; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: white; margin: 0; padding: 0; }
      `}</style>

      <div className="max-w-[700px] mx-auto p-8">
        {/* Print button — hidden in print */}
        <div className="no-print mb-6 flex gap-3">
          <button
            onClick={() => window.print()}
            className="bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            Print / Save as PDF
          </button>
          <button onClick={() => window.close()} className="border border-slate-200 text-sm font-medium px-4 py-2 rounded-lg text-slate-700">
            Close
          </button>
        </div>

        {/* Bill */}
        <div className="border border-slate-300 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-slate-900 text-white px-8 py-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">HOSTEL ERP</h1>
                <p className="text-slate-300 text-sm mt-1">Payment Receipt / Bill</p>
              </div>
              <div className="text-right">
                <p className="text-slate-300 text-xs">Bill #</p>
                <p className="font-mono text-sm">{params.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Bill type + status */}
          <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Bill Type</p>
              <p className="font-semibold text-slate-900">{BILL_TYPE_LABELS[bill.bill_type] ?? bill.bill_type}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
              <p className="font-semibold capitalize text-slate-900">{bill.status}</p>
            </div>
          </div>

          {/* Tenant + Period */}
          <div className="px-8 py-5 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Billed To</p>
                <p className="font-semibold text-slate-900 text-base">{tenant?.name}</p>
                <p className="text-slate-600">{tenant?.mobile}</p>
                {tenant?.permanent_address && <p className="text-slate-500 text-xs mt-1">{tenant.permanent_address}</p>}
              </div>
              <div>
                <p className="text-slate-500 text-xs uppercase mb-1">Room Details</p>
                <p className="font-semibold text-slate-900">Room {room?.room_number}, Floor {room?.floor}</p>
                <p className="text-slate-600">{room?.room_types?.name}</p>
                <div className="mt-3">
                  <p className="text-slate-500 text-xs uppercase mb-1">Billing Period</p>
                  <p className="text-slate-800">{fmt(bill.billing_period_start)} – {fmt(bill.billing_period_end)}</p>
                  {bill.due_date && <p className="text-slate-500 text-xs">Due: {fmt(bill.due_date)}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Components table */}
          <div className="px-8 py-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 font-semibold text-slate-700">Description</th>
                  <th className="text-right py-2 font-semibold text-slate-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {components.map((c, i) => (
                  <tr key={c.id ?? i} className="border-b border-slate-100">
                    <td className="py-3">
                      <p className="font-medium text-slate-800">{COMPONENT_LABELS[c.component_type] ?? c.component_type}</p>
                      {c.description && <p className="text-xs text-slate-500">{c.description}</p>}
                      {c.component_type === 'electricity' && c.units_consumed && (
                        <p className="text-xs text-slate-400">
                          {c.units_consumed} units × ₹{c.rate_per_unit}/unit{c.num_tenants && c.num_tenants > 1 ? ` ÷ ${c.num_tenants} tenants` : ''}
                        </p>
                      )}
                      {c.component_type === 'rent' && c.days && (
                        <p className="text-xs text-slate-400">{c.days} days</p>
                      )}
                    </td>
                    <td className="py-3 text-right font-medium tabular-nums">₹{Number(c.amount).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-4 font-bold text-lg text-slate-900">Total Amount</td>
                  <td className="pt-4 text-right font-bold text-xl text-slate-900 tabular-nums">
                    ₹{Number(bill.total_amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {bill.notes && (
            <div className="px-8 pb-5">
              <p className="text-xs text-slate-500 uppercase mb-1">Notes</p>
              <p className="text-sm text-slate-700">{bill.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
            Generated on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · This is a computer-generated bill
          </div>
        </div>
      </div>
    </>
  )
}
