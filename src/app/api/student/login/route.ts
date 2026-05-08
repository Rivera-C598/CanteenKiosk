import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { verifyPin } from '@/lib/pin-utils'

export async function POST(request: NextRequest) {
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

  const valid = await verifyPin(pin, student.pinHash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  session.studentId = student.id
  session.studentIdNumber = student.studentIdNumber
  session.isLoggedIn = true
  session.isTemporaryPin = student.isTemporaryPin
  await session.save()

  return NextResponse.json({ ok: true, isTemporaryPin: student.isTemporaryPin })
}
