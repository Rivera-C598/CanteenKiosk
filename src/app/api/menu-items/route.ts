import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const categoryId = searchParams.get('categoryId')

  try {
    const items = await prisma.menuItem.findMany({
      where: {
        available: true,
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      },
      include: { category: true, addons: { where: { available: true } } },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    console.error('Menu items error:', error)
    return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
  }
}
