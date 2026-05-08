'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const INACTIVITY_MS = 3 * 60 * 1000 // 3 minutes

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    // Only auto-logout on protected pages
    if (pathname === '/student' || pathname === '/student/register') return
    timer.current = setTimeout(async () => {
      await fetch('/api/student/logout', { method: 'POST' })
      router.push('/student')
    }, INACTIVITY_MS)
  }

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pathname])

  return <div className="min-h-screen bg-background">{children}</div>
}
