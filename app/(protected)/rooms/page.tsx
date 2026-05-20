import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Pencil, BedDouble, Zap } from 'lucide-react'
import BulkUploadButton from './BulkUploadButton'

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  occupied: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
}

export default async function RoomsPage() {
  const supabase = createClient()
  const [{ data: { user } }, { data: rooms }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('rooms').select('*, room_types(name)').order('room_number'),
  ])

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const counts = { available: 0, occupied: 0, maintenance: 0 }
  rooms?.forEach(r => { counts[r.status as keyof typeof counts]++ })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rooms</h2>
          <p className="text-sm text-slate-500 mt-0.5">{rooms?.length ?? 0} rooms total</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <BulkUploadButton />
            <Link
              href="/rooms/new"
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} /> Add Room
            </Link>
          </div>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex gap-3 mb-6">
        {Object.entries(counts).map(([status, count]) => (
          <span key={status} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
            {count} {status}
          </span>
        ))}
      </div>

      {!rooms?.length ? (
        <div className="text-center py-20 text-slate-400">
          <BedDouble size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No rooms yet</p>
          {isOwner && <p className="text-sm mt-1">Add a room or bulk upload from Excel</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {rooms.map(room => (
            <div key={room.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <span className="text-lg font-bold text-slate-900">{room.room_number}</span>
                {isOwner && (
                  <Link href={`/rooms/${room.id}/edit`} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <Pencil size={14} />
                  </Link>
                )}
              </div>
              <p className="text-xs text-slate-500">{(room.room_types as { name: string })?.name}</p>
              <p className="text-xs text-slate-400">Floor {room.floor}</p>
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[room.status]}`}>
                  {room.status}
                </span>
                <Link href={`/rooms/${room.id}`} className="text-slate-400 hover:text-blue-600 transition-colors" title="View details">
                  <Zap size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
