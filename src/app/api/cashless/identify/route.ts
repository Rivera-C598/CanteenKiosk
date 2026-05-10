import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const check = rateLimit(`identify:${ip}`, 30, 60 * 1000) // 30 per minute per IP
  if (!check.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { qrToken } = await request.json()
  if (!qrToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const student = await prisma.studentAccount.findUnique({
    where: { qrToken },
    select: {
      id: true, fullName: true, studentIdNumber: true, accountType: true,
      photoUrl: true, balance: true, status: true,
      pinLockedUntil: true,
    },
  })

  if (!student) return NextResponse.json({ error: 'Invalid QR code' }, { status: 404 })
  if (student.status === 'frozen') return NextResponse.json({ error: 'Account frozen' }, { status: 403 })
  if (student.status === 'pending') return NextResponse.json({ error: 'Account not activated' }, { status: 403 })

  if (student.pinLockedUntil && new Date() < student.pinLockedUntil) {
    const secondsLeft = Math.ceil((student.pinLockedUntil.getTime() - Date.now()) / 1000)
    return NextResponse.json({ error: `PIN locked. Try again in ${secondsLeft}s` }, { status: 429 })
  }

  return NextResponse.json({
    id: student.id,
    fullName: student.fullName,
    studentIdNumber: student.studentIdNumber,
    accountType: student.accountType,
    photoUrl: student.photoUrl,
    balance: student.balance,
  })
}
