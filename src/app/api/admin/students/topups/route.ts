import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getIronSession } from 'iron-session'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const entries = await prisma.studentTransaction.findMany({
    where: { type: { in: ['topup', 'adjustment'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      studentAccount: {
        select: { id: true, fullName: true, studentIdNumber: true },
      },
      admin: {
        select: { username: true },
      },
    },
  })

  return NextResponse.json(entries)
}
