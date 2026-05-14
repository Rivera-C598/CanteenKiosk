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

  const transactions = await prisma.studentTransaction.findMany({
    where: { studentAccountId: session.studentId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      admin: { select: { username: true } },
    },
  })
  return NextResponse.json(transactions)
}
