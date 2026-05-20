'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'

type RoomType = { id: string; name: string; capacity: number; base_rent: number }

const STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
]

export default function EditRoomPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [roomNumber, setRoomNumber] = useState('')
  const [roomTypeId, setRoomTypeId] = useState('')
  const [floor, setFloor] = useState('1')
  const [status, setStatus] = useState('available')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/room-types').then(r => r.json()),
      fetch(`/api/rooms/${id}`).then(r => r.json()),
    ]).then(([types, room]) => {
      setRoomTypes(types)
      if (room.error) { router.push('/rooms'); return }
      setRoomNumber(room.room_number)
      setRoomTypeId(room.room_type_id)
      setFloor(String(room.floor))
      setStatus(room.status)
      setNotes(room.notes || '')
      setFetching(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_number: roomNumber, room_type_id: roomTypeId, floor: parseInt(floor), status, notes }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Failed to update room.')
    } else {
      router.push('/rooms')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete room "${roomNumber}"? This cannot be undone.`)) return  // eslint-disable-line no-restricted-globals
    setDeleting(true)
    const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) {
      setError(data.error || 'Failed to delete room.')
    } else {
      router.push('/rooms')
    }
  }

  if (fetching) return <div className="text-slate-400 text-sm p-6">Loading…</div>

  return (
    <div className="max-w-lg">
      <Link href="/rooms" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Rooms
      </Link>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-slate-900">Edit Room</h2>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          <Trash2 size={15} />
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      <p className="text-slate-500 text-sm mb-6">Update room details and status.</p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Room Number</label>
            <input
              type="text"
              value={roomNumber}
              onChange={e => setRoomNumber(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Floor</label>
            <input
              type="number"
              value={floor}
              onChange={e => setFloor(e.target.value)}
              min={0}
              required
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Room Type</label>
          <select
            value={roomTypeId}
            onChange={e => setRoomTypeId(e.target.value)}
            required
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          >
            <option value="">Select a room type…</option>
            {roomTypes.map(rt => (
              <option key={rt.id} value={rt.id}>{rt.name} (₹{rt.base_rent}/mo, cap: {rt.capacity})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
          <div className="flex gap-2">
            {STATUSES.map(s => (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatus(s.value)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  status === s.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/rooms" className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm flex items-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
