import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import * as bcrypt from 'bcryptjs'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // Clear existing data
  await prisma.orderItemAddon.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.menuItemAddon.deleteMany()
  await prisma.menuItem.deleteMany()
  await prisma.category.deleteMany()
  await prisma.gCashAccount.deleteMany()
  await prisma.adminUser.deleteMany()

  // Categories
  const riceMeals = await prisma.category.create({ data: { name: 'Rice Meals', icon: 'rice_bowl', sortOrder: 1 } })
  const snacks = await prisma.category.create({ data: { name: 'Snacks', icon: 'lunch_dining', sortOrder: 2 } })
  const drinks = await prisma.category.create({ data: { name: 'Drinks', icon: 'local_cafe', sortOrder: 3 } })
  const merienda = await prisma.category.create({ data: { name: 'Merienda', icon: 'bakery_dining', sortOrder: 4 } })

  // Rice Meals
  await prisma.menuItem.create({ data: { categoryId: riceMeals.id, name: 'Pork Adobo Rice', description: 'Classic Filipino adobo with steamed rice', price: 65, stock: 50 } })
  await prisma.menuItem.create({ data: { categoryId: riceMeals.id, name: 'Chicken Inasal Rice', description: 'Grilled chicken with garlic rice', price: 75, stock: 40 } })
  await prisma.menuItem.create({ data: { categoryId: riceMeals.id, name: 'Beef Steak Rice', description: 'Filipino bistek with onions and rice', price: 85, stock: 30 } })
  await prisma.menuItem.create({ data: { categoryId: riceMeals.id, name: 'Pork Sisig Rice', description: 'Sizzling sisig on garlic rice', price: 80, stock: 35 } })
  await prisma.menuItem.create({ data: { categoryId: riceMeals.id, name: 'Fried Chicken Rice', description: 'Crispy fried chicken with java rice', price: 70, stock: 45 } })

  // Snacks
  await prisma.menuItem.create({ data: { categoryId: snacks.id, name: 'Burger', description: 'Juicy beef patty with lettuce and tomato', price: 45, stock: 60 } })
  await prisma.menuItem.create({ data: { categoryId: snacks.id, name: 'Hotdog Sandwich', description: 'Grilled hotdog in a toasted bun', price: 35, stock: 50 } })
  await prisma.menuItem.create({ data: { categoryId: snacks.id, name: 'French Fries', description: 'Crispy golden fries with ketchup', price: 40, stock: 70 } })
  await prisma.menuItem.create({ data: { categoryId: snacks.id, name: 'Cheese Sticks', description: '6 pcs crispy cheese sticks', price: 30, stock: 80 } })

  // Drinks
  await prisma.menuItem.create({ data: { categoryId: drinks.id, name: 'Iced Coffee', description: 'Cold brew coffee with milk', price: 45, stock: 100 } })
  await prisma.menuItem.create({ data: { categoryId: drinks.id, name: 'Bottled Water', description: '500ml mineral water', price: 15, stock: 200 } })
  await prisma.menuItem.create({ data: { categoryId: drinks.id, name: 'Soft Drink (Can)', description: 'Cola, sprite, or orange', price: 25, stock: 150 } })
  await prisma.menuItem.create({ data: { categoryId: drinks.id, name: 'Fresh Buko Juice', description: 'Fresh coconut water', price: 35, stock: 60 } })
  await prisma.menuItem.create({ data: { categoryId: drinks.id, name: 'Iced Tea', description: 'Sweetened iced tea in a cup', price: 20, stock: 120 } })

  // Merienda
  await prisma.menuItem.create({ data: { categoryId: merienda.id, name: 'Spaghetti', description: 'Sweet style Filipino spaghetti', price: 45, stock: 40 } })
  await prisma.menuItem.create({ data: { categoryId: merienda.id, name: 'Palabok', description: 'Traditional Filipino noodle dish', price: 50, stock: 35 } })
  await prisma.menuItem.create({ data: { categoryId: merienda.id, name: 'Champorado', description: 'Chocolate rice porridge', price: 30, stock: 30 } })

  // GCash account
  await prisma.gCashAccount.create({
    data: {
      accountName: 'Canteen Main',
      accountNumber: '09XX-XXX-XXXX',
      isActive: true,
      monthlyLimit: 100000,
    }
  })

  // Admin user (password: admin123)
  const hash = await bcrypt.hash('admin123', 10)
  await prisma.adminUser.create({
    data: {
      username: 'admin',
      passwordHash: hash,
      role: 'admin',
    }
  })

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
