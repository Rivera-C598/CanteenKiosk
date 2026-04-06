'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

const navItems = [
  { href: '/admin/dashboard', icon: 'dashboard', label: 'Dashboard' },
  { href: '/admin/menu', icon: 'restaurant_menu', label: 'Menu' },
  { href: '/admin/orders', icon: 'receipt_long', label: 'Orders' },
  { href: '/admin/gcash', icon: 'qr_code', label: 'GCash' },
  { href: '/admin/settings', icon: 'settings', label: 'Settings' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()

  // Don't show sidebar on login page
  if (pathname === '/admin/login') {
    return <div className="min-h-screen bg-background">{children}</div>
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-60 bg-surface-container-lowest shadow-ambient flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-6 py-5 border-b border-surface-container">
          <h1 className="text-2xl font-black italic text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            HyperBite
          </h1>
          <p className="text-xs text-on-surface-variant font-medium mt-0.5">Admin Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-150 ${
                  active
                    ? 'bg-primary text-on-primary shadow-primary-glow'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                <Icon name={item.icon} size={20} filled={active} className={active ? 'text-on-primary' : 'text-on-surface-variant'} />
                <span className="font-headline font-bold text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  {item.label}
                </span>
              </button>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-surface-container">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container transition-all duration-150"
          >
            <Icon name="logout" size={20} className="text-on-surface-variant" />
            <span className="font-headline font-bold text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
