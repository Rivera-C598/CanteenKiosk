import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const student = await prisma.studentAccount.findUnique({
    where: { id: session.studentId },
    select: { id: true, fullName: true, studentIdNumber: true, accountType: true, balance: true, status: true, isTemporaryPin: true },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(student)
}
