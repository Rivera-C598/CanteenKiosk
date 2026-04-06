import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateFilter = searchParams.get('date') ?? 'today'
  const statusParam = searchParams.get('status')

  try {
    let dateWhere = {}
    if (dateFilter === 'today') {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      dateWhere = { createdAt: { gte: start } }
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      dateWhere = { createdAt: { gte: weekAgo } }
    }

    const statusWhere = statusParam
      ? { status: { in: statusParam.split(',') } }
      : {}

    const orders = await prisma.order.findMany({
      where: { ...dateWhere, ...statusWhere },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Orders GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { items, paymentMethod, totalAmount } = body

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayOrderCount = await prisma.order.count({
      where: { createdAt: { gte: todayStart } }
    })
    const orderNumber = `A-${String(todayOrderCount + 1).padStart(3, '0')}`

    let gcashAccountId: number | undefined
    if (paymentMethod === 'gcash') {
      const gcashAccount = await prisma.gCashAccount.findFirst({
        where: { isActive: true }
      })
      gcashAccountId = gcashAccount?.id
    }

    const order = await prisma.order.create({
      data: {
        orderNumber,
        paymentMethod,
        paymentStatus: 'unpaid',
        status: paymentMethod === 'cash' ? 'awaiting_payment' : 'pending_verification',
        totalAmount,
        gcashAccountId,
        items: {
          create: items.map((item: { id: number; quantity: number; price: number }) => ({
            menuItemId: item.id,
            quantity: item.quantity,
            unitPrice: item.price,
            subtotal: item.price * item.quantity,
          }))
        }
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      }
    })

    return NextResponse.json(order)
  } catch (error) {
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
