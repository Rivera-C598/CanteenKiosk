import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPin, deriveTempPin } from '@/lib/pin-utils'
import { generateQrToken } from '@/lib/qr-utils'

export async function POST(request: NextRequest) {
  const { studentIdNumber, fullName, course, year } = await request.json()

  if (!studentIdNumber || !fullName || !course || !year) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  }

  const existing = await prisma.studentAccount.findUnique({ where: { studentIdNumber } })
  if (existing) {
    return NextResponse.json({ error: 'ID already registered' }, { status: 409 })
  }

  const tempPin = deriveTempPin(studentIdNumber)
  const pinHash = await hashPin(tempPin)
  const qrToken = generateQrToken()
  const accountType = studentIdNumber.length === 7 ? 'student' : 'faculty'

  await prisma.studentAccount.create({
    data: { studentIdNumber, fullName, course, year, accountType, pinHash, qrToken, status: 'pending', isTemporaryPin: true },
  })

  return NextResponse.json({ ok: true })
}
