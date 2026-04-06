import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const [todayOrders, todayRevenue, pendingVerification, recentOrders] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { createdAt: { gte: todayStart }, paymentStatus: 'paid' },
        _sum: { totalAmount: true },
      }),
      prisma.order.count({ where: { status: 'pending_verification' } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { menuItem: true } } },
      }),
    ])

    return NextResponse.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.totalAmount ?? 0,
      pendingVerification,
      recentOrders,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
