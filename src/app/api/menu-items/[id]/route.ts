import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'

async function requireAdmin() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session.isLoggedIn && session.role === 'admin'
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()

    if (body.stock !== undefined && body.stock < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 })
    }
    if (body.price !== undefined && body.price < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 })
    }

    const { name, price, description, image, stock, available, categoryId } = body
    const item = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(price !== undefined ? { price: parseFloat(price) } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(stock !== undefined ? { stock: Number(stock) } : {}),
        ...(available !== undefined ? { available } : {}),
        ...(categoryId !== undefined ? { categoryId: parseInt(categoryId) } : {}),
      },
    })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const { id } = await params
    await prisma.menuItem.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
