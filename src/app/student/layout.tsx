'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'

const INACTIVITY_MS = 3 * 60 * 1000

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (pathname === '/student' || pathname === '/student/register') return
    timer.current = setTimeout(async () => {
      await fetch('/api/student/logout', { method: 'POST' })
      router.push('/student?reason=inactive')
    }, INACTIVITY_MS)
  }, [pathname, router])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [resetTimer])

  return <div className="min-h-screen bg-background">{children}</div>
}
