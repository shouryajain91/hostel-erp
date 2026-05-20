'use client'

import { useEffect, useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

interface ApprovalRequest {
  id: string
  request_type: string
  payload: Record<string, string>
  status: string
  notes: string | null
  created_at: string
  profiles: { name: string; phone: string } | null
}

const requestTypeLabel: Record<string, string> = {
  create_user: 'Create User',
  deactivate_user: 'Deactivate User',
  create_room_type: 'Create Room Type',
  update_room_type: 'Update Room Type',
  delete_room_type: 'Delete Room Type',
  create_room: 'Create Room',
  update_room: 'Update Room',
  add_tenant: 'Add Tenant',
  update_tenant: 'Update Tenant',
  checkout_tenant: 'Checkout Tenant',
  generate_bill: 'Generate Bill',
  mark_bill_paid: 'Mark Bill Paid',
}

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const supabase = createClient()

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('approval_requests')
      .select('*, profiles!requested_by(name, phone)')
      .order('created_at', { ascending: false })
    setRequests((data as unknown as ApprovalRequest[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    setActionLoading(requestId)
    setMessage(null)

    const res = await fetch('/api/users/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        action,
        notes: rejectNotes[requestId] || undefined,
      }),
    })

    const data = await res.json()
    setActionLoading(null)

    if (!res.ok) {
      setMessage({ type: 'error', text: data.error || 'Action failed.' })
    } else {
      if (action === 'approve' && data.tempPassword) {
        setMessage({
          type: 'success',
          text: `✓ User created! Temporary password: ${data.tempPassword} — share this with the new staff member so they can log in.`,
        })
      } else {
        setMessage({ type: 'success', text: `Request ${action}d successfully.` })
      }
      fetchRequests()
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const resolved = requests.filter(r => r.status !== 'pending')

  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Approval Queue</h2>
      <p className="text-slate-500 text-sm mb-6">Review and act on pending requests from management</p>

      {message && (
        <div className={`mb-5 p-4 rounded-lg text-sm font-medium border ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border-green-200'
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <section className="mb-8">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Pending ({pending.length})
        </h3>

        {loading ? (
          <p className="text-slate-400 text-sm py-8 text-center">Loading…</p>
        ) : pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400">
            No pending requests. All caught up!
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-orange-200 shadow-sm p-5">
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">
                      {requestTypeLabel[req.request_type] || req.request_type}
                    </span>
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <Clock size={10} /> Pending
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
                    Requested by: <span className="font-medium text-slate-700">{req.profiles?.name}</span>
                    {' '}({req.profiles?.phone}) · {new Date(req.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>

                <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 mb-4">
                  {Object.entries(req.payload).map(([k, v]) => (
                    <div key={k}>
                      <span className="font-medium capitalize">{k}:</span>{' '}
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAction(req.id, 'approve')}
                    disabled={actionLoading === req.id}
                    className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle size={15} />
                    {actionLoading === req.id ? 'Processing…' : 'Approve'}
                  </button>

                  <input
                    type="text"
                    placeholder="Rejection reason (optional)"
                    value={rejectNotes[req.id] || ''}
                    onChange={e => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />

                  <button
                    onClick={() => handleAction(req.id, 'reject')}
                    disabled={actionLoading === req.id}
                    className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                  >
                    <XCircle size={15} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Resolved ({resolved.length})
          </h3>
          <div className="space-y-2">
            {resolved.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <span className={`flex-shrink-0 ${req.status === 'approved' ? 'text-green-500' : 'text-red-400'}`}>
                  {req.status === 'approved' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {requestTypeLabel[req.request_type]} — by {req.profiles?.name}
                  </div>
                  {req.notes && (
                    <div className="text-xs text-slate-500 truncate">{req.notes}</div>
                  )}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(req.created_at).toLocaleDateString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
