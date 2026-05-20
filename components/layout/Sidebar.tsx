'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, CheckSquare, Building2, BedDouble,
  UserCheck, FileText, LogOut, Menu, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavItem { href: string; label: string; icon: React.ElementType; ownerOnly?: boolean }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, ownerOnly: true },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/room-types', label: 'Room Types', icon: Building2 },
  { href: '/rooms', label: 'Rooms', icon: BedDouble },
  { href: '/tenants', label: 'Tenants', icon: UserCheck },
  { href: '/billing', label: 'Billing', icon: FileText },
]

interface SidebarProps { role: 'owner' | 'management'; userName: string }

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)

  const visible = navItems.filter(item => !item.ownerOnly || role === 'owner')

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const navContent = (
    <>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visible.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <div className="text-sm text-slate-400 px-3 mb-2 truncate">{userName}</div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors w-full"
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-900 flex items-center justify-between px-4 shadow-md">
        <span className="text-white font-bold text-base">Hostel ERP</span>
        <button
          onClick={() => setOpen(true)}
          className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
      </header>

      {/* Mobile overlay backdrop */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar: always visible on desktop, slide-in drawer on mobile */}
      <aside
        className={cn(
          'flex flex-col bg-slate-900 text-white',
          'fixed top-0 left-0 h-full z-50 w-64 transition-transform duration-200 ease-in-out',
          'lg:relative lg:z-auto lg:translate-x-0 lg:min-h-screen',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Hostel ERP</h1>
            <p className="text-xs text-slate-400 mt-0.5 capitalize">{role}</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        {navContent}
      </aside>
    </>
  )
}
