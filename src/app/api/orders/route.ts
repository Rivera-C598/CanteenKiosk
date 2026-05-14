import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const dateFilter = searchParams.get('date') ?? 'today'
  const statusParam = searchParams.get('status')

  try {
    let dateWhere: Record<string, unknown> = {}
    const resolvedDate = ['today', 'week', 'all'].includes(dateFilter) ? dateFilter : 'today'
    if (resolvedDate === 'today') {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      dateWhere = { createdAt: { gte: start } }
    } else if (resolvedDate === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      dateWhere = { createdAt: { gte: weekAgo } }
    }
    // resolvedDate === 'all': no date filter

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
    const { items, paymentMethod } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 })
    }
    const VALID_METHODS = ['cash', 'gcash', 'cashless']
    if (!VALID_METHODS.includes(paymentMethod)) {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
    }

    // Fetch real prices from DB — never trust client-supplied prices
    const itemIds = items.map((i: { id: number }) => i.id)
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds }, available: true },
    })
    if (menuItems.length !== itemIds.length) {
      return NextResponse.json({ error: 'One or more items unavailable' }, { status: 400 })
    }

    const priceMap = new Map(menuItems.map(m => [m.id, m.price]))
    let computedTotal = 0
    const orderItems = items.map((item: { id: number; quantity: number }) => {
      const unitPrice = priceMap.get(item.id)!
      const qty = Math.max(1, Math.floor(item.quantity))
      const subtotal = unitPrice * qty
      computedTotal += subtotal
      return { menuItemId: item.id, quantity: qty, unitPrice, subtotal }
    })

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayOrderCount = await prisma.order.count({
      where: { createdAt: { gte: todayStart } }
    })
    let seq = todayOrderCount + 1
    let orderNumber = `A-${String(seq).padStart(3, '0')}`
    while (await prisma.order.findUnique({ where: { orderNumber } })) {
      seq++
      orderNumber = `A-${String(seq).padStart(3, '0')}`
    }

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
        totalAmount: computedTotal,
        gcashAccountId,
        items: { create: orderItems },
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
