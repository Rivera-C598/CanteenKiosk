import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7'), 1), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    const topItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          createdAt: { gte: since },
          status: { in: ['completed', 'preparing', 'ready'] },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    })

    if (topItems.length === 0) return NextResponse.json([])

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: topItems.map(i => i.menuItemId) },
        available: true,
        stock: { gt: 0 },
      },
    })

    const result = topItems
      .map(i => {
        const menuItem = menuItems.find(m => m.id === i.menuItemId)
        if (!menuItem) return null
        return { ...menuItem, totalSold: i._sum.quantity ?? 0 }
      })
      .filter(Boolean)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Best sellers error:', error)
    return NextResponse.json({ error: 'Failed to fetch best sellers' }, { status: 500 })
  }
}
