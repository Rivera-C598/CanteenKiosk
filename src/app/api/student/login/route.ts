import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { verifyPin } from '@/lib/pin-utils'
import { rateLimit } from '@/lib/rate-limit'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes

export async function POST(request: NextRequest) {
  // IP-level rate limit: 10 login attempts per minute per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const ipCheck = rateLimit(`login:ip:${ip}`, 10, 60 * 1000)
  if (!ipCheck.ok) {
    const secs = Math.ceil(ipCheck.retryAfterMs / 1000)
    return NextResponse.json({ error: `Too many attempts. Try again in ${secs}s` }, { status: 429 })
  }

  const { studentIdNumber, pin } = await request.json()

  if (!studentIdNumber || !pin) {
    return NextResponse.json({ error: 'ID and PIN required' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
  if (!student) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  if (student.status === 'frozen') {
    return NextResponse.json({ error: 'Account frozen. Contact admin.' }, { status: 403 })
  }
  if (student.status === 'pending') {
    return NextResponse.json({ error: 'Account pending activation.' }, { status: 403 })
  }
  if (student.status === 'deleted') {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Account-level lockout
  if (student.pinLockedUntil && new Date() < student.pinLockedUntil) {
    const secs = Math.ceil((student.pinLockedUntil.getTime() - Date.now()) / 1000)
    return NextResponse.json({ error: `Account locked. Try again in ${secs}s` }, { status: 429 })
  }

  const valid = await verifyPin(pin, student.pinHash)

  if (!valid) {
    const newAttempts = student.pinAttempts + 1
    const locked = newAttempts >= MAX_ATTEMPTS
    await prisma.studentAccount.update({
      where: { id: student.id },
      data: {
        pinAttempts: locked ? MAX_ATTEMPTS : newAttempts,
        pinLockedUntil: locked ? new Date(Date.now() + LOCKOUT_MS) : null,
      },
    })
    if (locked) {
      return NextResponse.json({ error: `Too many failed attempts. Account locked for 15 minutes.` }, { status: 429 })
    }
    return NextResponse.json({ error: `Invalid credentials. ${MAX_ATTEMPTS - newAttempts} attempt(s) left.` }, { status: 401 })
  }

  // Success — reset lockout
  await prisma.studentAccount.update({
    where: { id: student.id },
    data: { pinAttempts: 0, pinLockedUntil: null },
  })

  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  session.studentId = student.id
  session.studentIdNumber = student.studentIdNumber
  session.isLoggedIn = true
  session.isTemporaryPin = student.isTemporaryPin
  await session.save()

  return NextResponse.json({ ok: true, isTemporaryPin: student.isTemporaryPin })
}
