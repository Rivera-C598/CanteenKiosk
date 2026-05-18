import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

export async function GET() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Count all active orders that are taking up kitchen bandwidth
    const activeCount = await prisma.order.count({
      where: {
        createdAt: { gte: today },
        status: { in: ['pending_verification', 'awaiting_payment', 'preparing'] },
      },
    })

    return NextResponse.json({ activeOrders: activeCount })
  } catch {
    return NextResponse.json({ error: 'Failed to metrics' }, { status: 500 })
  }
}
