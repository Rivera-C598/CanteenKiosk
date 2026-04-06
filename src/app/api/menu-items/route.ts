import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')
  const all = searchParams.get('all') === 'true'

  try {
    const items = await prisma.menuItem.findMany({
      where: {
        ...(all ? {} : { available: true }),
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      },
      include: { category: true, addons: { where: all ? {} : { available: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Menu items error:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, categoryId, price, description = '', image = '', stock = 999, available = true } = body
    const item = await prisma.menuItem.create({
      data: { name, categoryId: parseInt(categoryId), price: parseFloat(price), description, image, stock: parseInt(stock), available },
    })
    return NextResponse.json(item)
  } catch (error) {
    console.error('Create menu item error:', error)
    return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
  }
}
