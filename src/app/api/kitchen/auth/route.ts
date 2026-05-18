import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { sessionOptions, SessionData } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (session.isLoggedIn && session.role === 'kitchen') {
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ ok: false }, { status: 401 })
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const check = rateLimit(`kitchen-auth:${ip}`, 10, 60 * 1000)
  if (!check.ok) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  const { pin } = await request.json()
  const kitchenPin = process.env.KITCHEN_PIN

  if (!kitchenPin) {
    return NextResponse.json({ error: 'Kitchen PIN not configured' }, { status: 500 })
  }
  if (!pin || pin !== kitchenPin) {
    return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  session.isLoggedIn = true
  session.role = 'kitchen'
  await session.save()

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  session.destroy()
  return NextResponse.json({ ok: true })
}
