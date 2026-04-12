import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    const [todayOrders, todayRevenue, pendingVerification, recentOrders, allItemsToday] = await Promise.all([
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
      prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: todayStart } } },
        include: { menuItem: true }
      })
    ])

    const counts: Record<string, number> = {}
    for (const item of allItemsToday) {
      counts[item.menuItem.name] = (counts[item.menuItem.name] || 0) + item.quantity
    }
    const popularItems = Object.entries(counts)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5)

    return NextResponse.json({
      todayOrders,
      todayRevenue: todayRevenue._sum.totalAmount ?? 0,
      pendingVerification,
      recentOrders,
      popularItems
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
