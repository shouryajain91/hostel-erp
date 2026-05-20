import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export default async function UsersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: currentProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, phone, role, is_active, created_at')
    .order('created_at', { ascending: false })

  const isOwner = currentProfile?.role === 'owner'

  return (
    <div className="max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Users</h2>
          <p className="text-slate-500 text-sm mt-0.5">Manage staff accounts</p>
        </div>
        <Link
          href="/users/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition-colors text-sm self-start sm:self-auto"
        >
          <UserPlus size={16} />
          {isOwner ? 'Add User' : 'Request New User'}
        </Link>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {profiles?.map(profile => (
          <div key={profile.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-slate-900">{profile.name}</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold capitalize ${
                profile.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>{profile.role}</span>
            </div>
            <p className="text-sm text-slate-600 mb-2">{profile.phone}</p>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                profile.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>{profile.is_active ? 'Active' : 'Inactive'}</span>
              <span className="text-xs text-slate-400">{new Date(profile.created_at).toLocaleDateString('en-IN')}</span>
            </div>
          </div>
        ))}
        {(!profiles || !profiles.length) && (
          <p className="text-center text-slate-400 py-10 text-sm">No users found.</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Name</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Phone</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Role</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-3 font-semibold text-slate-600">Joined</th>
            </tr>
          </thead>
          <tbody>
            {profiles?.map(profile => (
              <tr key={profile.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-6 py-4 font-medium text-slate-900">{profile.name}</td>
                <td className="px-6 py-4 text-slate-600">{profile.phone}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                    profile.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>{profile.role}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    profile.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{profile.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="px-6 py-4 text-slate-500">{new Date(profile.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
            {(!profiles || !profiles.length) && (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
