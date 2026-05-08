import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { hashPin, verifyPin } from '@/lib/pin-utils'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { currentPin, newPin } = await request.json()
  if (!currentPin || !newPin || newPin.length !== 4) {
    return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
  }

  const student = await prisma.studentAccount.findUnique({ where: { id: session.studentId } })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await verifyPin(currentPin, student.pinHash)
  if (!valid) return NextResponse.json({ error: 'Current PIN incorrect' }, { status: 401 })

  const newPinHash = await hashPin(newPin)
  await prisma.studentAccount.update({
    where: { id: session.studentId },
    data: { pinHash: newPinHash, isTemporaryPin: false },
  })

  session.isTemporaryPin = false
  await session.save()

  return NextResponse.json({ ok: true })
}
