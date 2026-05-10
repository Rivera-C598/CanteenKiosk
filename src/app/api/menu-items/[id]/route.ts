import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.stock !== undefined && body.stock < 0) {
      return NextResponse.json({ error: 'Stock cannot be negative' }, { status: 400 })
    }
    if (body.price !== undefined && body.price < 0) {
      return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 })
    }

    const item = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: body,
    })
    return NextResponse.json(item)
  } catch {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.menuItem.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
