'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function CheckoutButton({ tenantId, tenantName, isOwner }: { tenantId: string; tenantName: string; isOwner: boolean }) {
  const [show, setShow] = useState(false)
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/tenants/${tenantId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenancy_end_date: endDate }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed.')
    } else if (data.approval_request) {
      setSubmitted(true)
    } else {
      router.push('/tenants')
    }
  }

  if (submitted) {
    return <span className="text-sm text-green-600 font-medium">Checkout submitted for approval</span>
  }

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 text-sm border border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-amber-700 hover:bg-amber-100 transition-colors"
      >
        <LogOut size={14} /> Checkout
      </button>

      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-1">Checkout: {tenantName}</h3>
            <p className="text-sm text-slate-500 mb-4">
              {isOwner ? 'Set the tenancy end date.' : 'Submit checkout request for owner approval.'}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Tenancy End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-sm"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                >
                  {loading ? 'Processing…' : isOwner ? 'Confirm Checkout' : 'Submit for Approval'}
                </button>
                <button type="button" onClick={() => setShow(false)} className="px-4 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
