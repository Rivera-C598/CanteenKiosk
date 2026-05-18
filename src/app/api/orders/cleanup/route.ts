import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'
import { readFile } from 'fs/promises'
import { join } from 'path'

export async function POST() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  if (!session.isLoggedIn || (session.role !== 'kitchen' && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const raw = await readFile(join(process.cwd(), 'settings.json'), 'utf-8')
    const settings = JSON.parse(raw)
    const timeoutMinutes: number = settings.gcashPaymentTimeoutMinutes ?? 10

    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000)

    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'pending_verification',
        paymentStatus: 'unpaid',
        createdAt: { lt: cutoff },
      },
      include: { items: { include: { menuItem: true } } },
    })

    if (staleOrders.length === 0) return NextResponse.json({ cancelled: 0 })

    await Promise.all(staleOrders.map(order =>
      prisma.$transaction(async (tx) => {
        for (const item of order.items) {
          await tx.menuItem.update({
            where: { id: item.menuItem.id },
            data: { stock: { increment: item.quantity } },
          })
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'cancelled', cancelReason: 'auto_timeout' },
        })
        await tx.orderLog.create({
          data: {
            orderId: order.id,
            action: 'auto_cancelled',
            snapshot: JSON.stringify({
              reason: `No payment received within ${timeoutMinutes} minutes`,
              paymentMethod: order.paymentMethod,
              total: order.totalAmount,
            }),
          },
        })
      })
    ))

    return NextResponse.json({ cancelled: staleOrders.length })
  } catch {
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
