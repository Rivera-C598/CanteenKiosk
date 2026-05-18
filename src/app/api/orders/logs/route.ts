import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const orderId = parseInt(searchParams.get('orderId') ?? '')
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }
  try {
    const logs = await prisma.orderLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Order logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
