import { NextRequest, NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { sessionOptions, SessionData } from '@/lib/session'

const MAX_ITEMS_PER_ORDER = 10
const MAX_QTY_PER_ITEM = 20

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || (session.role !== 'kitchen' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const check = rateLimit(`orders:${ip}`, 5, 60 * 1000)
  if (!check.ok) {
    return NextResponse.json({ error: 'Too many orders. Please wait a moment.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const { items, paymentMethod } = body

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items' }, { status: 400 })
    }
    if (items.length > MAX_ITEMS_PER_ORDER) {
      return NextResponse.json({ error: `Order cannot exceed ${MAX_ITEMS_PER_ORDER} different items` }, { status: 400 })
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

    const nameMap = new Map(menuItems.map(m => [m.id, m.name]))
    const priceMap = new Map(menuItems.map(m => [m.id, m.price]))

    for (const item of items as { id: number; quantity: number }[]) {
      const qty = Math.max(1, Math.floor(item.quantity))
      if (qty > MAX_QTY_PER_ITEM) {
        const name = nameMap.get(item.id) ?? 'Item'
        return NextResponse.json(
          { error: `${name}: max ${MAX_QTY_PER_ITEM} per order. Please reduce quantity.` },
          { status: 400 }
        )
      }
    }

    let computedTotal = 0
    const orderItems = (items as { id: number; quantity: number }[]).map(item => {
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

    const order = await prisma.$transaction(async (tx) => {
      for (const orderItem of orderItems) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: orderItem.menuItemId } })
        if (!menuItem || menuItem.stock < orderItem.quantity) {
          const name = menuItem?.name ?? 'Item'
          const avail = menuItem?.stock ?? 0
          throw new Error(`STOCK_INSUFFICIENT:${name}:${avail}`)
        }
        await tx.menuItem.update({
          where: { id: orderItem.menuItemId },
          data: { stock: { decrement: orderItem.quantity } },
        })
        // Floor guard — prevent stock going below 0 due to any edge case
        await tx.menuItem.updateMany({
          where: { id: orderItem.menuItemId, stock: { lt: 0 } },
          data: { stock: 0 },
        })
      }
      return tx.order.create({
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
        },
      })
    })

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STOCK_INSUFFICIENT:')) {
      const parts = error.message.split(':')
      const name = parts[1]
      const avail = parts[2]
      return NextResponse.json(
        { error: `Only ${avail} ${name} available` },
        { status: 409 }
      )
    }
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
