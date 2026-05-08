import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { studentSessionOptions, StudentSessionData } from '@/lib/student-session'
import { generateQrSvg } from '@/lib/qr-utils'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<StudentSessionData>(cookieStore, studentSessionOptions)
  if (!session.isLoggedIn || !session.studentId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const student = await prisma.studentAccount.findUnique({
    where: { id: session.studentId },
    select: { qrToken: true, fullName: true, studentIdNumber: true, accountType: true, status: true },
  })
  if (!student) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (student.status !== 'active') {
    return NextResponse.json({ error: 'Account not active' }, { status: 403 })
  }

  const svg = await generateQrSvg(student.qrToken)
  return NextResponse.json({ svg, fullName: student.fullName, studentIdNumber: student.studentIdNumber, accountType: student.accountType })
}
