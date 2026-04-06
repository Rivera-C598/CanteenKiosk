import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    // If setting this account as active, deactivate all others first
    if (body.isActive === true) {
      await prisma.gCashAccount.updateMany({ data: { isActive: false } })
    }

    const account = await prisma.gCashAccount.update({
      where: { id: parseInt(id) },
      data: body,
    })
    return NextResponse.json(account)
  } catch (error: unknown) {
    if (
      typeof error === 'object' && error !== null &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to update GCash account' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.gCashAccount.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    if (
      typeof error === 'object' && error !== null &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to delete GCash account' }, { status: 500 })
  }
}
