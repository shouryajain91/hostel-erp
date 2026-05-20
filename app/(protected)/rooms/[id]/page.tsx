import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import ElectricityReadings from './ElectricityReadings'

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700',
  occupied: 'bg-blue-100 text-blue-700',
  maintenance: 'bg-amber-100 text-amber-700',
}

export default async function RoomDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: { user } }, { data: room }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('rooms').select('*, room_types(name, capacity, base_rent, amenities)').eq('id', params.id).single(),
  ])

  if (!room) notFound()

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isOwner = profile?.role === 'owner'

  const roomType = room.room_types as { name: string; capacity: number; base_rent: number; amenities: string[] }

  return (
    <div className="max-w-2xl">
      <Link href="/rooms" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <ArrowLeft size={16} /> Back to Rooms
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold text-slate-900">Room {room.room_number}</h2>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[room.status]}`}>
              {room.status}
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            {roomType?.name} · Floor {room.floor} · ₹{roomType?.base_rent}/mo · Capacity {roomType?.capacity}
          </p>
        </div>
        {isOwner && (
          <Link href={`/rooms/${room.id}/edit`} className="inline-flex items-center gap-1.5 text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
            <Pencil size={14} /> Edit
          </Link>
        )}
      </div>

      {roomType?.amenities?.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Amenities</p>
          <div className="flex flex-wrap gap-1.5">
            {roomType.amenities.map((a: string) => (
              <span key={a} className="text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">{a}</span>
            ))}
          </div>
        </div>
      )}

      {room.notes && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{room.notes}
        </div>
      )}

      <ElectricityReadings roomId={room.id} isOwnerOrManagement={true} />
    </div>
  )
}
