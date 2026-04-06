# Remaining Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the CanteenKiosk app by building all remaining admin pages, the Kitchen Display System, and the Order Queue display.

**Architecture:** All features are Next.js App Router pages + API routes backed by the existing SQLite/Prisma setup. Admin pages slot into the existing sidebar layout. KDS and Queue are standalone fullscreen pages with no auth. All live updates use polling (no SSE/websockets needed on LAN).

**Tech Stack:** Next.js 14 App Router, Prisma + SQLite, Tailwind CSS, Material Symbols Outlined icons, Plus Jakarta Sans / Be Vietnam Pro fonts.

---

## File Map

**New files:**
- `src/app/api/orders/[id]/route.ts` — PATCH order status/payment
- `src/app/api/gcash/route.ts` — GET list + POST create GCash account
- `src/app/api/gcash/[id]/route.ts` — PATCH + DELETE GCash account
- `src/app/api/settings/route.ts` — GET + PATCH app settings
- `src/components/admin/DrawerPanel.tsx` — reusable slide-in drawer shell
- `src/app/admin/menu/page.tsx` — categories + menu items CRUD
- `src/app/admin/orders/page.tsx` — order list + payment confirmation
- `src/app/admin/gcash/page.tsx` — GCash account management
- `src/app/admin/settings/page.tsx` — app settings form
- `src/app/kitchen/page.tsx` — Kitchen Display System
- `src/app/queue/page.tsx` — Student-facing order queue
- `settings.json` — persisted app settings (project root)

**Modified files:**
- `src/app/api/categories/route.ts` — add POST + `?all=true` query param
- `src/app/api/menu-items/route.ts` — add POST + `?all=true` query param
- `src/app/api/orders/route.ts` — add GET with `?date=` and `?status=` filters

---

## Task 1: Commit untracked API routes

**Files:**
- `src/app/api/categories/[id]/route.ts` (already exists, untracked)
- `src/app/api/menu-items/[id]/route.ts` (already exists, untracked)
- `src/app/api/upload/route.ts` (already exists, untracked)

- [ ] **Step 1: Stage and commit**

```bash
git add src/app/api/categories/[id]/route.ts src/app/api/menu-items/[id]/route.ts src/app/api/upload/route.ts
git commit -m "add categories/[id], menu-items/[id], and upload API routes"
```

---

## Task 2: Extend categories and menu-items API routes

**Files:**
- Modify: `src/app/api/categories/route.ts`
- Modify: `src/app/api/menu-items/route.ts`

- [ ] **Step 1: Replace `src/app/api/categories/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const all = searchParams.get('all') === 'true'
  try {
    const categories = await prisma.category.findMany({
      where: all ? {} : { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: all ? {} : { available: true },
          orderBy: { name: 'asc' },
        },
      },
    })
    return NextResponse.json(categories)
  } catch (error) {
    console.error('Categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, icon = 'restaurant', sortOrder = 0 } = body
    const category = await prisma.category.create({
      data: { name, icon, sortOrder },
    })
    return NextResponse.json(category)
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Replace `src/app/api/menu-items/route.ts`**

```typescript
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
```

- [ ] **Step 3: Verify**

Start dev server (`npm run dev`), then open browser to:
- `http://localhost:3000/api/categories?all=true` — should return all categories including inactive
- `http://localhost:3000/api/menu-items?all=true` — should return all items

- [ ] **Step 4: Commit**

```bash
git add src/app/api/categories/route.ts src/app/api/menu-items/route.ts
git commit -m "add POST and admin all=true param to categories and menu-items routes"
```

---

## Task 3: Add orders GET and orders/[id] PATCH routes

**Files:**
- Modify: `src/app/api/orders/route.ts`
- Create: `src/app/api/orders/[id]/route.ts`

- [ ] **Step 1: Replace `src/app/api/orders/route.ts`** (keep existing POST, add GET)

```typescript
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
```

- [ ] **Step 2: Create `src/app/api/orders/[id]/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, paymentStatus } = body

    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        updatedAt: new Date(),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
  } catch (error) {
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify**

In browser: `http://localhost:3000/api/orders?date=today` — should return today's orders as an array (may be empty).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/route.ts src/app/api/orders/[id]/route.ts
git commit -m "add orders GET with filters and orders/[id] PATCH route"
```

---

## Task 4: Add GCash CRUD routes

**Files:**
- Create: `src/app/api/gcash/route.ts`
- Create: `src/app/api/gcash/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/gcash/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const accounts = await prisma.gCashAccount.findMany({
      orderBy: { id: 'asc' },
    })
    return NextResponse.json(accounts)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch GCash accounts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { accountName, accountNumber, qrCodeImage = '', monthlyLimit = 100000 } = body
    const account = await prisma.gCashAccount.create({
      data: { accountName, accountNumber, qrCodeImage, monthlyLimit, isActive: false },
    })
    return NextResponse.json(account)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create GCash account' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/gcash/[id]/route.ts`**

```typescript
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update GCash account' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.gCashAccount.delete({ where: { id: parseInt(id) } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete GCash account' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gcash/route.ts src/app/api/gcash/[id]/route.ts
git commit -m "add GCash account CRUD routes"
```

---

## Task 5: Add settings file and API route

**Files:**
- Create: `settings.json` (project root)
- Create: `src/app/api/settings/route.ts`

- [ ] **Step 1: Create `settings.json` in project root**

```json
{
  "idleTimeoutSeconds": 60,
  "gcashPaymentTimeoutMinutes": 5,
  "receiptFooterMessage": "Thank you for dining at HyperBite!",
  "alwaysOpen": true,
  "openTime": "07:00",
  "closeTime": "20:00"
}
```

- [ ] **Step 2: Create `src/app/api/settings/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

const SETTINGS_PATH = join(process.cwd(), 'settings.json')

export async function GET() {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
    return NextResponse.json(JSON.parse(raw))
  } catch {
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8')
    const current = JSON.parse(raw)
    const updates = await request.json()
    const merged = { ...current, ...updates }
    await writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2))
    return NextResponse.json(merged)
  } catch {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add settings.json src/app/api/settings/route.ts
git commit -m "add settings.json and settings API route"
```

---

## Task 6: Shared DrawerPanel component

**Files:**
- Create: `src/components/admin/DrawerPanel.tsx`

- [ ] **Step 1: Create `src/components/admin/DrawerPanel.tsx`**

```typescript
'use client'

import { useEffect } from 'react'
import { Icon } from '@/components/shared/Icon'

interface DrawerPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function DrawerPanel({ open, onClose, title, children }: DrawerPanelProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-on-surface/20 z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 h-full w-[480px] bg-surface-container-lowest shadow-2xl z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-container shrink-0">
          <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container text-on-surface-variant transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {children}
        </div>
      </aside>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/DrawerPanel.tsx
git commit -m "add shared DrawerPanel component for admin"
```

---

## Task 7: Admin Menu Management page

**Files:**
- Create: `src/app/admin/menu/page.tsx`

- [ ] **Step 1: Create `src/app/admin/menu/page.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { DrawerPanel } from '@/components/admin/DrawerPanel'

interface Category { id: number; name: string; icon: string; sortOrder: number; active: boolean; items: MenuItem[] }
interface MenuItem { id: number; name: string; categoryId: number; price: number; description: string; image: string; stock: number; available: boolean }

type Tab = 'items' | 'categories'

const EMPTY_ITEM = { name: '', categoryId: 0, price: '', description: '', image: '', stock: '999', available: true }
const EMPTY_CAT = { name: '', icon: 'restaurant', sortOrder: 0 }

export default function MenuPage() {
  const [tab, setTab] = useState<Tab>('items')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number | 'all'>('all')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [catForm, setCatForm] = useState(EMPTY_CAT)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch('/api/categories?all=true')
      .then(r => r.json())
      .then(data => { setCategories(data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const allItems = categories.flatMap(c => c.items.map(i => ({ ...i, categoryName: c.name })))

  const filteredItems = allItems.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || i.categoryId === filterCat
    return matchSearch && matchCat
  })

  const totalItems = allItems.length
  const lowStock = allItems.filter(i => i.stock > 0 && i.stock <= 5).length
  const outOfStock = allItems.filter(i => i.stock === 0).length

  const openAddItem = () => {
    setEditingItem(null)
    setItemForm({ ...EMPTY_ITEM, categoryId: categories[0]?.id ?? 0 })
    setDrawerOpen(true)
  }

  const openEditItem = (item: MenuItem & { categoryName?: string }) => {
    setEditingItem(item)
    setItemForm({ name: item.name, categoryId: item.categoryId, price: String(item.price), description: item.description, image: item.image, stock: String(item.stock), available: item.available })
    setDrawerOpen(true)
  }

  const openAddCat = () => {
    setEditingCat(null)
    setCatForm(EMPTY_CAT)
    setDrawerOpen(true)
  }

  const openEditCat = (cat: Category) => {
    setEditingCat(cat)
    setCatForm({ name: cat.name, icon: cat.icon, sortOrder: cat.sortOrder })
    setDrawerOpen(true)
  }

  const closeDrawer = () => { setDrawerOpen(false); setEditingItem(null); setEditingCat(null) }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (data.url) setItemForm(f => ({ ...f, image: data.url }))
  }

  const saveItem = async () => {
    setSaving(true)
    const body = { ...itemForm, categoryId: Number(itemForm.categoryId), price: parseFloat(itemForm.price), stock: parseInt(itemForm.stock) }
    if (editingItem) {
      await fetch(`/api/menu-items/${editingItem.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/menu-items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const deleteItem = async (id: number) => {
    if (!confirm('Delete this item?')) return
    await fetch(`/api/menu-items/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleItemAvailable = async (item: MenuItem) => {
    await fetch(`/api/menu-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ available: !item.available }) })
    load()
  }

  const saveCat = async () => {
    setSaving(true)
    if (editingCat) {
      await fetch(`/api/categories/${editingCat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    } else {
      await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const deleteCat = async (id: number) => {
    if (!confirm('Delete this category? All its items will be deleted too.')) return
    await fetch(`/api/categories/${id}`, { method: 'DELETE' })
    load()
  }

  const toggleCatActive = async (cat: Category) => {
    await fetch(`/api/categories/${cat.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !cat.active }) })
    load()
  }

  const stockColor = (stock: number) => {
    if (stock === 0) return 'text-on-surface-variant'
    if (stock <= 5) return 'text-primary'
    return 'text-tertiary'
  }

  const stockBarWidth = (stock: number) => {
    if (stock === 0) return '0%'
    if (stock >= 100) return '100%'
    return `${stock}%`
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  const isItemTab = tab === 'items'

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-headline font-black text-3xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Menu Management</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manage food items, categories, and availability.</p>
        </div>
        <button
          onClick={isItemTab ? openAddItem : openAddCat}
          className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold shadow-primary-glow active:scale-95 transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="add" size={20} />
          {isItemTab ? 'Add Item' : 'Add Category'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-surface-container rounded-xl w-fit mb-6">
        {(['items', 'categories'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg font-headline font-bold text-sm transition-all ${tab === t ? 'bg-surface-container-lowest text-on-surface shadow-ambient' : 'text-on-surface-variant'}`}
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {t === 'items' ? 'Menu Items' : 'Categories'}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Items', value: totalItems, icon: 'restaurant_menu', color: 'text-on-surface' },
              { label: 'Low Stock', value: lowStock, icon: 'warning', color: 'text-primary' },
              { label: 'Out of Stock', value: outOfStock, icon: 'remove_shopping_cart', color: 'text-on-surface-variant' },
            ].map(s => (
              <div key={s.label} className="bg-surface-container-lowest rounded-xl p-5 shadow-ambient">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name={s.icon} size={18} className={s.color} />
                  <p className="text-on-surface-variant text-sm">{s.label}</p>
                </div>
                <p className={`font-headline font-black text-3xl ${s.color}`} style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full bg-surface-container-low rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="bg-surface-container-low rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50">
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Available</th>
                  <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-surface-container/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-surface-container overflow-hidden shrink-0 flex items-center justify-center">
                          {item.image ? <img src={item.image} alt={item.name} className="w-full h-full object-cover" /> : <Icon name="restaurant" size={20} className="text-outline" />}
                        </div>
                        <span className="font-bold text-on-surface text-sm">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full">
                        {(item as any).categoryName}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-headline font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      ₱{item.price.toFixed(0)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 bg-surface-container rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.stock === 0 ? 'bg-outline' : item.stock <= 5 ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: stockBarWidth(item.stock) }} />
                        </div>
                        <span className={`text-xs font-bold ${stockColor(item.stock)}`}>{item.stock === 0 ? 'Out' : item.stock}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleItemAvailable(item)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${item.available ? 'bg-tertiary' : 'bg-surface-container'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${item.available ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditItem(item)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                          <Icon name="edit" size={18} />
                        </button>
                        <button onClick={() => deleteItem(item.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-on-surface-variant">No items found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Categories tab */}
      {tab === 'categories' && (
        <div className="bg-surface-container-lowest rounded-xl shadow-ambient overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Icon</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Items</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider">Active</th>
                <th className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-surface-container/30 transition-colors group">
                  <td className="px-6 py-4 font-bold text-on-surface">{cat.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-on-surface-variant">
                      <Icon name={cat.icon} size={20} />
                      <span className="text-xs">{cat.icon}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant text-sm">{cat.items.length} items</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleCatActive(cat)}
                      className={`w-10 h-6 rounded-full transition-colors relative ${cat.active ? 'bg-tertiary' : 'bg-surface-container'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${cat.active ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditCat(cat)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                        <Icon name="edit" size={18} />
                      </button>
                      <button onClick={() => deleteCat(cat.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                        <Icon name="delete" size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      <DrawerPanel
        open={drawerOpen}
        onClose={closeDrawer}
        title={isItemTab ? (editingItem ? 'Edit Item' : 'Add Item') : (editingCat ? 'Edit Category' : 'Add Category')}
      >
        {tab === 'items' && (
          <div className="flex flex-col gap-5">
            {/* Image upload */}
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-2 block">Image</label>
              <div
                onClick={() => fileRef.current?.click()}
                className="w-full h-40 bg-surface-container rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors overflow-hidden relative"
              >
                {itemForm.image ? (
                  <img src={itemForm.image} alt="preview" className="w-full h-full object-cover" />
                ) : uploading ? (
                  <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
                ) : (
                  <>
                    <Icon name="upload" size={32} className="text-on-surface-variant" />
                    <span className="text-xs text-on-surface-variant mt-2">Click to upload JPG / PNG / WebP</span>
                  </>
                )}
                {itemForm.image && (
                  <button
                    onClick={e => { e.stopPropagation(); setItemForm(f => ({ ...f, image: '' })) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-surface/80 rounded-full flex items-center justify-center"
                  >
                    <Icon name="close" size={16} className="text-on-surface" />
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </div>

            {[
              { label: 'Name', key: 'name', type: 'text', placeholder: 'e.g. Chicken Adobo' },
              { label: 'Price (₱)', key: 'price', type: 'number', placeholder: '0' },
              { label: 'Stock', key: 'stock', type: 'number', placeholder: '999' },
            ].map(field => (
              <div key={field.key}>
                <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(itemForm as any)[field.key]}
                  onChange={e => setItemForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            ))}

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Category</label>
              <select
                value={itemForm.categoryId}
                onChange={e => setItemForm(f => ({ ...f, categoryId: Number(e.target.value) }))}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Description</label>
              <textarea
                rows={3}
                placeholder="Short description…"
                value={itemForm.description}
                onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-on-surface-variant">Available on menu</span>
              <button
                onClick={() => setItemForm(f => ({ ...f, available: !f.available }))}
                className={`w-12 h-7 rounded-full transition-colors relative ${itemForm.available ? 'bg-tertiary' : 'bg-surface-container'}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${itemForm.available ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <button
              onClick={saveItem}
              disabled={saving || !itemForm.name || !itemForm.price}
              className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        )}

        {tab === 'categories' && (
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Name</label>
              <input
                type="text"
                placeholder="e.g. Rice Meals"
                value={catForm.name}
                onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Icon (Material Symbol name)</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="e.g. rice_bowl"
                  value={catForm.icon}
                  onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                  className="flex-1 bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="w-11 h-11 bg-surface-container rounded-xl flex items-center justify-center shrink-0">
                  <Icon name={catForm.icon || 'restaurant'} size={24} className="text-on-surface-variant" />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Sort Order</label>
              <input
                type="number"
                value={catForm.sortOrder}
                onChange={e => setCatForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={saveCat}
              disabled={saving || !catForm.name}
              className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {saving ? 'Saving…' : editingCat ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        )}
      </DrawerPanel>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/admin/menu`. You should see:
- Stats row with item counts
- Table of seeded menu items
- "+ Add Item" button opens drawer
- Edit/delete icons appear on row hover
- Available toggle updates immediately

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/menu/page.tsx
git commit -m "add admin menu management page with categories and items CRUD"
```

---

## Task 8: Admin Orders page

**Files:**
- Create: `src/app/admin/orders/page.tsx`

- [ ] **Step 1: Create `src/app/admin/orders/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface OrderItem { quantity: number; menuItem: { name: string } }
interface Order {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  totalAmount: number
  createdAt: string
  items: OrderItem[]
}

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending_verification', label: 'Pending GCash' },
  { key: 'awaiting_payment', label: 'Awaiting Cash' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

const DATE_OPTS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
]

const STATUS_BADGE: Record<string, string> = {
  pending_verification: 'bg-secondary-container text-on-secondary-container',
  awaiting_payment: 'bg-surface-container text-on-surface-variant',
  preparing: 'bg-tertiary-container text-on-tertiary-container',
  ready: 'bg-tertiary text-on-tertiary',
  completed: 'bg-surface-container text-on-surface-variant',
  cancelled: 'bg-error-container text-on-error-container',
}

const STATUS_LABEL: Record<string, string> = {
  pending_verification: 'Pending GCash',
  awaiting_payment: 'Awaiting Cash',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const NEXT_ACTION: Record<string, { label: string; nextStatus: string; nextPayment?: string }> = {
  pending_verification: { label: 'Confirm GCash', nextStatus: 'preparing', nextPayment: 'paid' },
  awaiting_payment: { label: 'Confirm Cash', nextStatus: 'preparing', nextPayment: 'paid' },
  preparing: { label: 'Mark Ready', nextStatus: 'ready' },
  ready: { label: 'Complete', nextStatus: 'completed' },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState('all')
  const [dateFilter, setDateFilter] = useState('today')
  const [acting, setActing] = useState<number | null>(null)

  const load = () => {
    const params = new URLSearchParams({ date: dateFilter })
    if (statusTab !== 'all') params.set('status', statusTab)
    fetch(`/api/orders?${params}`)
      .then(r => r.json())
      .then(data => { setOrders(data); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { setLoading(true); load() }, [statusTab, dateFilter])

  const advanceOrder = async (order: Order) => {
    const action = NEXT_ACTION[order.status]
    if (!action) return
    setActing(order.id)
    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: action.nextStatus,
        ...(action.nextPayment ? { paymentStatus: action.nextPayment } : {}),
      }),
    })
    setActing(null)
    load()
  }

  const cancelOrder = async (id: number) => {
    if (!confirm('Cancel this order?')) return
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    load()
  }

  const timeAgo = (iso: string) => {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (diff < 1) return 'just now'
    if (diff < 60) return `${diff}m ago`
    return `${Math.floor(diff / 60)}h ago`
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="font-headline font-black text-3xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Orders</h2>
        <p className="text-on-surface-variant text-sm mt-1">View and manage all customer orders.</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {STATUS_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setStatusTab(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${statusTab === t.key ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Date filter */}
        <div className="flex gap-1">
          {DATE_OPTS.map(d => (
            <button
              key={d.key}
              onClick={() => setDateFilter(d.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${dateFilter === d.key ? 'bg-surface-container-highest text-on-surface' : 'text-on-surface-variant hover:bg-surface-container'}`}
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-3">
          <Icon name="receipt_long" size={48} />
          <p className="font-bold">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const action = NEXT_ACTION[order.status]
            return (
              <div key={order.id} className="bg-surface-container-lowest rounded-xl shadow-ambient px-6 py-4 flex items-center gap-4">
                {/* Payment icon */}
                <div className="w-12 h-12 bg-surface-container rounded-xl flex items-center justify-center shrink-0">
                  <Icon name={order.paymentMethod === 'gcash' ? 'qr_code' : 'payments'} size={22} className="text-on-surface-variant" />
                </div>
                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-headline font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      {order.orderNumber}
                    </p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status] ?? 'bg-surface-container text-on-surface-variant'}`}>
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <span className="text-xs text-on-surface-variant">{timeAgo(order.createdAt)}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                    {order.items.map(i => `${i.quantity}× ${i.menuItem.name}`).join(', ')}
                  </p>
                </div>
                {/* Total */}
                <p className="font-headline font-black text-primary shrink-0" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  ₱{order.totalAmount.toFixed(0)}
                </p>
                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {action && (
                    <button
                      onClick={() => advanceOrder(order)}
                      disabled={acting === order.id}
                      className="bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      {acting === order.id ? '…' : action.label}
                    </button>
                  )}
                  {!['completed', 'cancelled'].includes(order.status) && (
                    <button
                      onClick={() => cancelOrder(order.id)}
                      className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all"
                    >
                      <Icon name="cancel" size={18} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/admin/orders`. Place a test order on the kiosk first, then confirm that:
- The order appears in the list
- "Confirm GCash" / "Confirm Cash" button is visible for pending orders
- Clicking the action button updates the status

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/orders/page.tsx
git commit -m "add admin orders page with status management and payment confirmation"
```

---

## Task 9: Admin GCash page

**Files:**
- Create: `src/app/admin/gcash/page.tsx`

- [ ] **Step 1: Create `src/app/admin/gcash/page.tsx`**

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'
import { DrawerPanel } from '@/components/admin/DrawerPanel'

interface GCashAccount {
  id: number
  accountName: string
  accountNumber: string
  qrCodeImage: string
  isActive: boolean
  monthlyReceived: number
  monthlyLimit: number
  lastReset: string
}

const EMPTY_FORM = { accountName: '', accountNumber: '', qrCodeImage: '', monthlyLimit: '100000' }

export default function GCashPage() {
  const [accounts, setAccounts] = useState<GCashAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<GCashAccount | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => {
    fetch('/api/gcash')
      .then(r => r.json())
      .then(data => { setAccounts(data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setDrawerOpen(true) }
  const openEdit = (acc: GCashAccount) => {
    setEditing(acc)
    setForm({ accountName: acc.accountName, accountNumber: acc.accountNumber, qrCodeImage: acc.qrCodeImage, monthlyLimit: String(acc.monthlyLimit) })
    setDrawerOpen(true)
  }
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null) }

  const handleUpload = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (data.url) setForm(f => ({ ...f, qrCodeImage: data.url }))
  }

  const save = async () => {
    setSaving(true)
    const body = { ...form, monthlyLimit: parseFloat(form.monthlyLimit) }
    if (editing) {
      await fetch(`/api/gcash/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } else {
      await fetch('/api/gcash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false)
    closeDrawer()
    load()
  }

  const setActive = async (id: number) => {
    await fetch(`/api/gcash/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: true }) })
    load()
  }

  const deleteAccount = async (id: number) => {
    if (!confirm('Delete this GCash account?')) return
    await fetch(`/api/gcash/${id}`, { method: 'DELETE' })
    load()
  }

  const usagePct = (acc: GCashAccount) => Math.min(100, Math.round((acc.monthlyReceived / acc.monthlyLimit) * 100))

  if (loading) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  const active = accounts.find(a => a.isActive)
  const inactive = accounts.filter(a => !a.isActive)

  return (
    <div className="p-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h2 className="font-headline font-black text-3xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>GCash Settings</h2>
          <p className="text-on-surface-variant text-sm mt-1">Manage GCash accounts for payment QR codes.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-headline font-bold shadow-primary-glow active:scale-95 transition-transform"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          <Icon name="add" size={20} />
          Add Account
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant gap-3">
          <Icon name="qr_code" size={48} />
          <p className="font-bold">No GCash accounts yet</p>
          <button onClick={openAdd} className="text-primary font-bold text-sm">Add your first account</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active account */}
          {active && (
            <div className="bg-primary rounded-2xl p-6 text-on-primary">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">ACTIVE</span>
                  </div>
                  <h3 className="font-headline font-black text-2xl mt-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{active.accountName}</h3>
                  <p className="text-on-primary/80 text-sm mt-0.5">{active.accountNumber}</p>
                  {/* Usage bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-on-primary/70">Monthly Usage</span>
                      <span className="text-xs font-bold">₱{active.monthlyReceived.toFixed(0)} / ₱{active.monthlyLimit.toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white rounded-full transition-all" style={{ width: `${usagePct(active)}%` }} />
                    </div>
                  </div>
                </div>
                {active.qrCodeImage && (
                  <div className="w-24 h-24 bg-white rounded-xl overflow-hidden shrink-0 ml-4">
                    <img src={active.qrCodeImage} alt="QR" className="w-full h-full object-contain p-1" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => openEdit(active)} className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                  <Icon name="edit" size={16} /> Edit
                </button>
              </div>
            </div>
          )}

          {/* Inactive accounts */}
          {inactive.map(acc => (
            <div key={acc.id} className="bg-surface-container-lowest rounded-xl shadow-ambient p-5 flex items-center gap-4">
              <div className="w-16 h-16 bg-surface-container rounded-xl overflow-hidden flex items-center justify-center shrink-0">
                {acc.qrCodeImage ? (
                  <img src={acc.qrCodeImage} alt="QR" className="w-full h-full object-contain p-1" />
                ) : (
                  <Icon name="qr_code" size={28} className="text-on-surface-variant" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-headline font-black text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{acc.accountName}</p>
                <p className="text-xs text-on-surface-variant">{acc.accountNumber}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="h-1.5 w-24 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-tertiary rounded-full" style={{ width: `${usagePct(acc)}%` }} />
                  </div>
                  <span className="text-xs text-on-surface-variant">{usagePct(acc)}% used</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setActive(acc.id)} className="text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-4 py-2 rounded-xl transition-colors">
                  Set Active
                </button>
                <button onClick={() => openEdit(acc)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all">
                  <Icon name="edit" size={18} />
                </button>
                <button onClick={() => deleteAccount(acc.id)} className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                  <Icon name="delete" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DrawerPanel open={drawerOpen} onClose={closeDrawer} title={editing ? 'Edit Account' : 'Add GCash Account'}>
        <div className="flex flex-col gap-5">
          {/* QR upload */}
          <div>
            <label className="text-sm font-bold text-on-surface-variant mb-2 block">QR Code Image</label>
            <div
              onClick={() => fileRef.current?.click()}
              className="w-full h-48 bg-surface-container rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-surface-container-high transition-colors overflow-hidden relative"
            >
              {form.qrCodeImage ? (
                <img src={form.qrCodeImage} alt="QR preview" className="w-full h-full object-contain p-4" />
              ) : uploading ? (
                <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
              ) : (
                <>
                  <Icon name="qr_code" size={40} className="text-on-surface-variant" />
                  <span className="text-xs text-on-surface-variant mt-2">Upload QR code image</span>
                </>
              )}
              {form.qrCodeImage && (
                <button onClick={e => { e.stopPropagation(); setForm(f => ({ ...f, qrCodeImage: '' })) }} className="absolute top-2 right-2 w-7 h-7 bg-surface/80 rounded-full flex items-center justify-center">
                  <Icon name="close" size={16} className="text-on-surface" />
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          </div>

          {[
            { label: 'Account Name', key: 'accountName', placeholder: 'e.g. Juan dela Cruz' },
            { label: 'GCash Number', key: 'accountNumber', placeholder: '09XXXXXXXXX' },
            { label: 'Monthly Limit (₱)', key: 'monthlyLimit', placeholder: '100000' },
          ].map(field => (
            <div key={field.key}>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">{field.label}</label>
              <input
                type={field.key === 'monthlyLimit' ? 'number' : 'text'}
                placeholder={field.placeholder}
                value={(form as any)[field.key]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}

          <button
            onClick={save}
            disabled={saving || !form.accountName || !form.accountNumber}
            className="w-full bg-primary text-on-primary py-3.5 rounded-xl font-headline font-bold disabled:opacity-50 active:scale-95 transition-transform mt-2"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Account'}
          </button>
        </div>
      </DrawerPanel>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/admin/gcash`. Add a GCash account, upload a QR image, and set it as active.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/gcash/page.tsx
git commit -m "add admin GCash account management page"
```

---

## Task 10: Admin Settings page

**Files:**
- Create: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Create `src/app/admin/settings/page.tsx`**

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Settings {
  idleTimeoutSeconds: number
  gcashPaymentTimeoutMinutes: number
  receiptFooterMessage: string
  alwaysOpen: boolean
  openTime: string
  closeTime: string
}

export default function SettingsPage() {
  const [form, setForm] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setForm)
  }, [])

  const save = async () => {
    if (!form) return
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!form) return (
    <div className="flex items-center justify-center h-full p-8">
      <Icon name="hourglass_empty" size={32} className="text-primary animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h2 className="font-headline font-black text-3xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Settings</h2>
        <p className="text-on-surface-variant text-sm mt-1">Kiosk behaviour and display configuration.</p>
      </div>

      <div className="space-y-6">
        {/* Kiosk timings */}
        <section className="bg-surface-container-lowest rounded-xl shadow-ambient p-6">
          <h3 className="font-headline font-bold text-on-surface mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Kiosk Timings</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Idle Timeout (seconds)</label>
              <p className="text-xs text-on-surface-variant mb-2">How long before the screensaver activates on the kiosk.</p>
              <input
                type="number"
                value={form.idleTimeoutSeconds}
                onChange={e => setForm(f => f ? { ...f, idleTimeoutSeconds: Number(e.target.value) } : f)}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">GCash Payment Timeout (minutes)</label>
              <p className="text-xs text-on-surface-variant mb-2">Time before an unconfirmed GCash order is auto-cancelled.</p>
              <input
                type="number"
                value={form.gcashPaymentTimeoutMinutes}
                onChange={e => setForm(f => f ? { ...f, gcashPaymentTimeoutMinutes: Number(e.target.value) } : f)}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </section>

        {/* Operating hours */}
        <section className="bg-surface-container-lowest rounded-xl shadow-ambient p-6">
          <h3 className="font-headline font-bold text-on-surface mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Operating Hours</h3>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-on-surface-variant">Always Open</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Disable time-based ordering restrictions.</p>
            </div>
            <button
              onClick={() => setForm(f => f ? { ...f, alwaysOpen: !f.alwaysOpen } : f)}
              className={`w-12 h-7 rounded-full transition-colors relative ${form.alwaysOpen ? 'bg-tertiary' : 'bg-surface-container'}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform shadow ${form.alwaysOpen ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {!form.alwaysOpen && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Open Time</label>
                <input type="time" value={form.openTime} onChange={e => setForm(f => f ? { ...f, openTime: e.target.value } : f)} className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Close Time</label>
                <input type="time" value={form.closeTime} onChange={e => setForm(f => f ? { ...f, closeTime: e.target.value } : f)} className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          )}
        </section>

        {/* Receipt */}
        <section className="bg-surface-container-lowest rounded-xl shadow-ambient p-6">
          <h3 className="font-headline font-bold text-on-surface mb-4" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Receipt</h3>
          <div>
            <label className="text-sm font-bold text-on-surface-variant mb-1.5 block">Footer Message</label>
            <input
              type="text"
              value={form.receiptFooterMessage}
              onChange={e => setForm(f => f ? { ...f, receiptFooterMessage: e.target.value } : f)}
              className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </section>

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-on-primary px-8 py-3.5 rounded-xl font-headline font-bold shadow-primary-glow active:scale-95 transition-transform disabled:opacity-50"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          {saved ? <><Icon name="check" size={18} /> Saved!</> : saving ? 'Saving…' : <><Icon name="save" size={18} /> Save Settings</>}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/admin/settings`. Change idle timeout and save. Confirm `settings.json` at project root was updated.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/settings/page.tsx
git commit -m "add admin settings page"
```

---

## Task 11: Kitchen Display System

**Files:**
- Create: `src/app/kitchen/page.tsx`

- [ ] **Step 1: Create `src/app/kitchen/page.tsx`**

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface OrderItem { quantity: number; menuItem: { name: string } }
interface Order {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  totalAmount: number
  createdAt: string
  items: OrderItem[]
}

const ACTIVE_STATUSES = 'pending_verification,awaiting_payment,preparing,ready'

const STATUS_CONFIG: Record<string, { label: string; color: string; cardBg: string }> = {
  pending_verification: { label: 'Pending GCash', color: 'text-on-secondary-container', cardBg: 'bg-secondary-container' },
  awaiting_payment: { label: 'Awaiting Cash', color: 'text-on-surface-variant', cardBg: 'bg-surface-container' },
  preparing: { label: 'Preparing', color: 'text-on-tertiary-container', cardBg: 'bg-tertiary-container' },
  ready: { label: 'Ready!', color: 'text-on-tertiary', cardBg: 'bg-tertiary' },
}

const NEXT_ACTION: Record<string, { label: string; icon: string; nextStatus: string; nextPayment?: string }> = {
  pending_verification: { label: 'Confirm Payment', icon: 'check_circle', nextStatus: 'preparing', nextPayment: 'paid' },
  awaiting_payment: { label: 'Confirm Cash', icon: 'payments', nextStatus: 'preparing', nextPayment: 'paid' },
  preparing: { label: 'Mark Ready', icon: 'done_all', nextStatus: 'ready' },
  ready: { label: 'Complete', icon: 'task_alt', nextStatus: 'completed' },
}

function playBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch {}
}

function elapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

function elapsedColor(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins >= 10) return 'text-primary'
  if (mins >= 5) return 'text-secondary'
  return 'text-on-surface-variant'
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [time, setTime] = useState(new Date())
  const [acting, setActing] = useState<number | null>(null)
  const prevIdsRef = useRef<Set<number>>(new Set())
  const [completing, setCompleting] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?date=today&status=${ACTIVE_STATUSES}`)
      const data: Order[] = await res.json()
      const newIds = new Set(data.map(o => o.id))

      // Detect new orders and beep
      const isFirstLoad = prevIdsRef.current.size === 0 && data.length > 0
      if (!isFirstLoad) {
        for (const id of newIds) {
          if (!prevIdsRef.current.has(id)) { playBeep(); break }
        }
      }
      prevIdsRef.current = newIds

      // Sort: oldest first, ready last
      const sorted = [...data].sort((a, b) => {
        if (a.status === 'ready' && b.status !== 'ready') return 1
        if (b.status === 'ready' && a.status !== 'ready') return -1
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })
      setOrders(sorted)
    } catch {}
  }, [])

  useEffect(() => {
    load()
    const poll = setInterval(load, 3000)
    const tick = setInterval(() => setTime(new Date()), 10000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  const advance = async (order: Order) => {
    const action = NEXT_ACTION[order.status]
    if (!action) return
    setActing(order.id)

    if (action.nextStatus === 'completed') {
      setCompleting(prev => new Set(prev).add(order.id))
      setTimeout(() => {
        setOrders(prev => prev.filter(o => o.id !== order.id))
        setCompleting(prev => { const s = new Set(prev); s.delete(order.id); return s })
      }, 1000)
    }

    await fetch(`/api/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: action.nextStatus,
        ...(action.nextPayment ? { paymentStatus: action.nextPayment } : {}),
      }),
    })
    setActing(null)
    if (action.nextStatus !== 'completed') load()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface-container-lowest px-8 py-4 flex items-center justify-between border-b border-surface-container">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Icon name="kitchen" size={22} className="text-on-primary" />
          </div>
          <div>
            <h1 className="font-headline font-black text-on-surface text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Kitchen Display</h1>
            <p className="text-on-surface-variant text-xs">HyperBite</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2">
            <Icon name="receipt_long" size={16} className="text-on-surface-variant" />
            <span className="font-headline font-black text-on-surface text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              {orders.length} active
            </span>
          </div>
          <p className="font-headline font-black text-on-surface text-lg" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Grid */}
      <main className="p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-on-surface-variant gap-4">
            <Icon name="check_circle" size={64} className="text-tertiary" />
            <p className="font-headline font-bold text-xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>All clear!</p>
            <p className="text-sm">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map(order => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.preparing
              const action = NEXT_ACTION[order.status]
              const isCompleting = completing.has(order.id)

              return (
                <div
                  key={order.id}
                  className={`${cfg.cardBg} rounded-2xl p-5 flex flex-col gap-3 transition-all duration-500 ${isCompleting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
                >
                  {/* Order number + status */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-headline font-black text-3xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        {order.orderNumber}
                      </p>
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name={order.paymentMethod === 'gcash' ? 'qr_code' : 'payments'} size={16} className="text-on-surface-variant" />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="flex-1 space-y-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-surface-container-lowest/60 rounded-full flex items-center justify-center text-xs font-black text-on-surface shrink-0">
                          {item.quantity}
                        </span>
                        <span className="text-sm font-medium text-on-surface">{item.menuItem.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Elapsed */}
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" size={14} className={elapsedColor(order.createdAt)} />
                    <span className={`text-xs font-bold ${elapsedColor(order.createdAt)}`}>{elapsed(order.createdAt)}</span>
                  </div>

                  {/* Action */}
                  {action && (
                    <button
                      onClick={() => advance(order)}
                      disabled={acting === order.id}
                      className="w-full flex items-center justify-center gap-2 bg-surface-container-lowest/80 hover:bg-surface-container-lowest text-on-surface py-3 rounded-xl font-headline font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                    >
                      <Icon name={action.icon} size={18} />
                      {acting === order.id ? '…' : action.label}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/kitchen`. Place an order from the kiosk. The order card should appear within 3 seconds. Click the action button to advance status.

- [ ] **Step 3: Commit**

```bash
git add src/app/kitchen/page.tsx
git commit -m "add kitchen display system with polling and status advancement"
```

---

## Task 12: Order Queue Display

**Files:**
- Create: `src/app/queue/page.tsx`

- [ ] **Step 1: Create `src/app/queue/page.tsx`**

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface Order {
  id: number
  orderNumber: string
  status: string
  createdAt: string
}

export default function QueuePage() {
  const [preparing, setPreparing] = useState<Order[]>([])
  const [ready, setReady] = useState<Order[]>([])
  const [time, setTime] = useState(new Date())
  const [prevReadyIds, setPrevReadyIds] = useState<Set<number>>(new Set())
  const [newlyReady, setNewlyReady] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?date=today&status=preparing,ready')
      const data: Order[] = await res.json()
      const prep = data.filter(o => o.status === 'preparing').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      const rdy = data.filter(o => o.status === 'ready').sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

      // Detect newly ready orders for animation
      const rdyIds = new Set(rdy.map(o => o.id))
      const newIds = new Set([...rdyIds].filter(id => !prevReadyIds.has(id)))
      if (newIds.size > 0) {
        setNewlyReady(newIds)
        setTimeout(() => setNewlyReady(new Set()), 3000)
      }
      setPrevReadyIds(rdyIds)
      setPreparing(prep)
      setReady(rdy)
    } catch {}
  }, [prevReadyIds])

  useEffect(() => {
    load()
    const poll = setInterval(load, 5000)
    const tick = setInterval(() => setTime(new Date()), 30000)
    return () => { clearInterval(poll); clearInterval(tick) }
  }, [load])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-surface-container-lowest px-10 py-5 flex items-center justify-between border-b border-surface-container shrink-0">
        <h1 className="font-headline font-black text-3xl text-primary" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          HyperBite
        </h1>
        <p className="font-headline font-black text-on-surface text-2xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
          {time.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </header>

      {/* Two columns */}
      <main className="flex-1 grid grid-cols-2 gap-0 overflow-hidden">
        {/* Preparing */}
        <div className="flex flex-col border-r border-surface-container p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-tertiary-container rounded-xl flex items-center justify-center">
              <Icon name="cooking" size={22} className="text-on-tertiary-container" />
            </div>
            <div>
              <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Now Preparing</h2>
              <p className="text-xs text-on-surface-variant">Your order is being made</p>
            </div>
            {preparing.length > 0 && (
              <span className="ml-auto w-8 h-8 bg-tertiary-container rounded-full flex items-center justify-center font-headline font-black text-on-tertiary-container text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {preparing.length}
              </span>
            )}
          </div>

          {preparing.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-on-surface-variant gap-3">
              <Icon name="restaurant" size={48} className="opacity-30" />
              <p className="text-sm">No orders being prepared</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 content-start">
              {preparing.map(order => (
                <div
                  key={order.id}
                  className="bg-tertiary-container rounded-2xl px-6 py-4 flex items-center justify-center"
                >
                  <span className="font-headline font-black text-4xl text-on-tertiary-container" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ready */}
        <div className="flex flex-col p-8 bg-tertiary/5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-tertiary rounded-xl flex items-center justify-center">
              <Icon name="check_circle" size={22} className="text-on-tertiary" />
            </div>
            <div>
              <h2 className="font-headline font-black text-xl text-on-surface" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Ready for Pickup</h2>
              <p className="text-xs text-on-surface-variant">Please proceed to the counter</p>
            </div>
            {ready.length > 0 && (
              <span className="ml-auto w-8 h-8 bg-tertiary rounded-full flex items-center justify-center font-headline font-black text-on-tertiary text-sm" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {ready.length}
              </span>
            )}
          </div>

          {ready.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-on-surface-variant gap-3">
              <Icon name="check_circle" size={48} className="opacity-30" />
              <p className="text-sm">No orders ready yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3 content-start">
              {ready.map(order => (
                <div
                  key={order.id}
                  className={`rounded-2xl px-6 py-4 flex items-center justify-center transition-all duration-700 ${newlyReady.has(order.id) ? 'bg-primary scale-110 shadow-primary-glow' : 'bg-tertiary'}`}
                >
                  <span
                    className={`font-headline font-black text-4xl transition-colors ${newlyReady.has(order.id) ? 'text-on-primary' : 'text-on-tertiary'}`}
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    {order.orderNumber}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-surface-container-lowest border-t border-surface-container px-10 py-4 text-center shrink-0">
        <p className="text-on-surface-variant text-sm">
          When your number is called, please proceed to the counter to collect your order.
        </p>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Navigate to `http://localhost:3000/queue`. Place an order and have the KDS advance it to "preparing" — it should appear in the left column. Advance to "ready" — it should move to the right column with a green pulse animation.

- [ ] **Step 3: Commit**

```bash
git add src/app/queue/page.tsx
git commit -m "add student-facing order queue display with preparing and ready columns"
```

---

## Self-Review Checklist

| Spec requirement | Covered by |
|---|---|
| Commit untracked routes | Task 1 |
| Admin menu: categories CRUD | Tasks 2, 7 |
| Admin menu: items CRUD with image upload | Tasks 2, 7 |
| Admin menu: all=true for inactive/unavailable | Task 2 |
| Admin orders: list with filters | Tasks 3, 8 |
| Admin orders: confirm GCash/cash payment | Tasks 3, 8 |
| Admin orders: status advancement | Tasks 3, 8 |
| Admin GCash: list/create/update/delete | Tasks 4, 9 |
| Admin GCash: set active (deactivate others) | Tasks 4, 9 |
| Admin settings: idle timeout, gcash timeout, receipt footer, hours | Tasks 5, 10 |
| KDS: active orders, card UI, status advancement | Tasks 3, 11 |
| KDS: sound on new order (Web Audio) | Task 11 |
| KDS: elapsed time coloring | Task 11 |
| KDS: completed orders fade out | Task 11 |
| Queue: preparing column | Task 12 |
| Queue: ready column with pulse animation | Task 12 |
| Polling: 3s KDS, 5s queue | Tasks 11, 12 |
| No auth on KDS / queue | Tasks 11, 12 |
