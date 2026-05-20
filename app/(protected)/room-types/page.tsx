import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Users, IndianRupee } from 'lucide-react'

export default async function RoomTypesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: roomTypes }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('room_types').select('*').order('name'),
  ])

  const isOwner = profile?.role === 'owner'

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Room Types</h2>
          <p className="text-slate-500 text-sm mt-0.5">Define room categories, amenities, and base rent</p>
        </div>
        {isOwner && (
          <Link
            href="/room-types/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm"
          >
            <Plus size={16} />
            Add Room Type
          </Link>
        )}
      </div>

      {roomTypes && roomTypes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roomTypes.map(rt => (
            <div key={rt.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{rt.name}</h3>
                  {rt.description && (
                    <p className="text-sm text-slate-500 mt-0.5">{rt.description}</p>
                  )}
                </div>
                {isOwner && (
                  <Link
                    href={`/room-types/${rt.id}/edit`}
                    className="text-slate-400 hover:text-blue-600 transition-colors p-1 ml-2 shrink-0"
                  >
                    <Pencil size={16} />
                  </Link>
                )}
              </div>

              <div className="flex items-center gap-4 mb-3 text-sm">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <Users size={14} />
                  <span>Capacity: <strong>{rt.capacity}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <IndianRupee size={14} />
                  <span>Base Rent: <strong>₹{Number(rt.base_rent).toLocaleString('en-IN')}/mo</strong></span>
                </div>
              </div>

              {rt.amenities && rt.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {rt.amenities.map((a: string) => (
                    <span key={a} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-16 text-center">
          <p className="text-slate-400 text-sm">No room types defined yet.</p>
          {isOwner && (
            <Link href="/room-types/new" className="mt-3 inline-block text-blue-600 text-sm font-medium hover:underline">
              Add your first room type →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
