import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { sessionOptions, SessionData } from '@/lib/session'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const kioskIp = process.env.KIOSK_IP

  // IP-lock kiosk routes — only kiosk device can access them
  const isKioskRoute = ['/', '/menu', '/cart', '/payment', '/confirmed', '/status'].some(
    p => pathname === p || pathname.startsWith(p + '/')
  )
  if (isKioskRoute && kioskIp && clientIp !== kioskIp) {
    return NextResponse.json({ error: 'Access restricted to kiosk device' }, { status: 403 })
  }

  // Block kiosk device from student portal
  if (pathname.startsWith('/student') && kioskIp && clientIp === kioskIp) {
    return NextResponse.json({ error: 'Student portal not available on kiosk' }, { status: 403 })
  }

  // Protect /admin/* routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const response = NextResponse.next()
    const session = await getIronSession<SessionData>(request, response, sessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }

  // Protect /student/* routes (except login and register)
  const studentPublic = ['/student', '/student/register']
  if (pathname.startsWith('/student') && !studentPublic.includes(pathname)) {
    const response = NextResponse.next()
    const session = await getIronSession<StudentSessionData>(request, response, studentSessionOptions)
    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL('/student', request.url))
    }
    // Force PIN change if still on temp PIN
    if (session.isTemporaryPin && pathname !== '/student/change-pin') {
      return NextResponse.redirect(new URL('/student/change-pin', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/student/:path*', '/', '/menu/:path*', '/cart/:path*', '/payment/:path*', '/confirmed/:path*', '/status/:path*'],
}
