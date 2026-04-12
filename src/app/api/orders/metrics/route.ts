import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
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
