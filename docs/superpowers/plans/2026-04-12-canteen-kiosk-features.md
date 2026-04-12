# CanteenKiosk Feature Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-item check + strict mode, cancel/edit orders with audit log, best sellers widget, image upload fix, and print order slip to CanteenKiosk.

**Architecture:** Features are implemented in dependency order: image fix first (unblocks clean testing), then schema-free kitchen features, then the OrderLog schema change + edit drawer, then best sellers. All kitchen features (check, cancel, edit, print) modify `src/app/kitchen/page.tsx` sequentially.

**Tech Stack:** Next.js 14 App Router, Prisma + SQLite, Tailwind CSS, Material Symbols Outlined icons, TypeScript

---

## File Map

**New files:**
- `src/app/api/orders/best-sellers/route.ts` — best sellers query (rolling N days)
- `src/app/api/orders/logs/route.ts` — GET order audit logs by orderId
- `src/components/kitchen/EditOrderDrawer.tsx` — full edit drawer component

**Modified files:**
- `prisma/schema.prisma` — add `OrderLog` model + `Order.logs` relation
- `settings.json` — add `requireAllItemsChecked: false`
- `src/app/api/upload/route.ts` — add 5 MB size guard
- `src/app/api/orders/[id]/route.ts` — extend PATCH for item edit + cancel logging
- `src/app/admin/menu/page.tsx` — client-side upload size check + inline error
- `src/app/admin/settings/page.tsx` — add Operator Behavior toggle
- `src/app/admin/orders/page.tsx` — add View Logs button + logs modal
- `src/app/kitchen/page.tsx` — settings fetch, per-item check, cancel dialog, edit integration, print slip
- `src/app/(kiosk)/page.tsx` — best sellers pulsing pill + carousel overlay
- `src/app/(kiosk)/menu/page.tsx` — best sellers virtual category + preselect highlight
- `src/app/globals.css` — `@media print` styles + `#print-slot` base

---

## Task 1: Image Upload Fix

**Files:**
- Modify: `src/app/api/upload/route.ts`
- Modify: `src/app/admin/menu/page.tsx`

- [ ] **Step 1: Add server-side 5 MB guard to upload route**

Replace the entire `src/app/api/upload/route.ts` with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPG, PNG, WebP allowed' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: 'File too large. Max 5 MB.' }, { status: 400 })
    }

    const uploadDir = join(process.cwd(), 'public', 'images', 'menu')
    await mkdir(uploadDir, { recursive: true })

    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const filepath = join(uploadDir, filename)
    await writeFile(filepath, buffer)

    return NextResponse.json({ url: `/images/menu/${filename}` })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add client-side size check + error display in admin menu page**

Read `src/app/admin/menu/page.tsx` lines 32–91, then make two changes:

**2a.** Add an `uploadError` state after the existing state declarations (around line 34):
```tsx
const [uploadError, setUploadError] = useState('')
```

**2b.** Replace the `handleUpload` function (lines 83–91) with:
```tsx
const handleUpload = async (file: File) => {
  setUploadError('')
  if (file.size > 5 * 1024 * 1024) {
    setUploadError('Image too large. Max 5 MB.')
    return
  }
  setUploading(true)
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const data = await res.json()
  setUploading(false)
  if (data.url) {
    setItemForm(f => ({ ...f, image: data.url }))
  } else {
    setUploadError(data.error ?? 'Upload failed.')
  }
}
```

**2c.** Find the upload button area in the drawer (search for `fileRef`) and add error display directly below the file input trigger button:
```tsx
{uploadError && (
  <p className="text-xs text-error font-bold mt-1">{uploadError}</p>
)}
```

- [ ] **Step 3: Verify**

Start dev server (`npm run dev`). In admin → Menu, try uploading an image > 5 MB — should show inline error. Upload a normal image — should succeed and preview appear.

- [ ] **Step 4: Commit**
```bash
git add src/app/api/upload/route.ts src/app/admin/menu/page.tsx
git commit -m "add 5mb upload size limit with client and server validation"
```

---

## Task 2: Prisma Schema — Add OrderLog

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add OrderLog model to schema**

In `prisma/schema.prisma`, add `logs OrderLog[]` to the `Order` model and add the new model at the end of the file:

Add to `Order` model (after `updatedAt`):
```prisma
  logs            OrderLog[]
```

Add new model at end of file:
```prisma
model OrderLog {
  id        Int      @id @default(autoincrement())
  orderId   Int
  order     Order    @relation(fields: [orderId], references: [id])
  action    String
  snapshot  String   @default("")
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Run migration**
```bash
npx prisma migrate dev --name add_order_log
```
Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Commit**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "add OrderLog model for order audit trail"
```

---

## Task 3: Settings — requireAllItemsChecked Toggle

**Files:**
- Modify: `settings.json`
- Modify: `src/app/admin/settings/page.tsx`

- [ ] **Step 1: Add field to settings.json**

Add `"requireAllItemsChecked": false` to `settings.json`:
```json
{
  "storeName": "HyperBite",
  "idleTimeoutSeconds": 60,
  "gcashPaymentTimeoutMinutes": 5,
  "receiptFooterMessage": "Thank you for dining at HyperBite!",
  "alwaysOpen": true,
  "openTime": "07:00",
  "closeTime": "20:00",
  "requireAllItemsChecked": false
}
```

- [ ] **Step 2: Add field to Settings interface in admin settings page**

In `src/app/admin/settings/page.tsx`, update the `Settings` interface:
```tsx
interface Settings {
  storeName: string
  idleTimeoutSeconds: number
  gcashPaymentTimeoutMinutes: number
  receiptFooterMessage: string
  alwaysOpen: boolean
  openTime: string
  closeTime: string
  requireAllItemsChecked: boolean
}
```

- [ ] **Step 3: Add Operator Behavior section to settings UI**

In `src/app/admin/settings/page.tsx`, insert a new section after the Receipt section (before the Danger Zone section). Add this block after the closing `</section>` of the receipt section:

```tsx
{/* Operator Behavior */}
<section className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/10 p-8">
  <div className="flex items-center gap-3 mb-6">
    <div className="w-10 h-10 bg-surface-container flex justify-center items-center rounded-xl text-stone-500">
      <Icon name="rule" size={20} />
    </div>
    <h3 className="font-headline font-bold text-on-surface text-xl">Operator Behavior</h3>
  </div>
  <div className="flex items-center justify-between">
    <div className="flex-1 pr-8">
      <p className="font-bold text-sm text-on-surface">Require All Items Checked</p>
      <p className="text-xs text-stone-400 font-medium mt-1">
        When enabled, canteen staff must check off every item in an order before they can confirm it.
      </p>
    </div>
    <button
      onClick={() => setForm(f => f ? { ...f, requireAllItemsChecked: !f.requireAllItemsChecked } : f)}
      className={`w-14 h-8 rounded-full transition-colors relative shadow-inner shadow-black/10 flex items-center shrink-0 ${form.requireAllItemsChecked ? 'bg-tertiary' : 'bg-stone-300'}`}
    >
      <span className={`absolute left-0 w-6 h-6 rounded-full bg-white transition-transform shadow-md ${form.requireAllItemsChecked ? 'translate-x-7' : 'translate-x-1'}`} />
    </button>
  </div>
</section>
```

- [ ] **Step 4: Verify**

Visit `/admin/settings`. Confirm the new "Operator Behavior" section renders with a working toggle. Save settings and confirm the value persists on refresh.

- [ ] **Step 5: Commit**
```bash
git add settings.json src/app/admin/settings/page.tsx
git commit -m "add requireAllItemsChecked setting with admin toggle"
```

---

## Task 4: Print Order Slip — CSS + Print Function

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/kitchen/page.tsx`

- [ ] **Step 1: Add @media print styles to globals.css**

Append to the end of `src/app/globals.css`:
```css
/* ── Print slip ── */
#print-slot {
  display: none;
}

@media print {
  body > * {
    display: none !important;
  }
  #print-slot {
    display: block !important;
  }
  .print-slip {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt;
    width: 72mm;
    padding: 4mm 2mm;
  }
  .slip-brand {
    text-align: center;
    font-size: 15pt;
    font-weight: 900;
    margin-bottom: 2mm;
  }
  .slip-order {
    text-align: center;
    font-size: 32pt;
    font-weight: 900;
    letter-spacing: -1pt;
    margin: 1mm 0;
  }
  .slip-meta {
    font-size: 9pt;
    margin: 0.5mm 0;
  }
  .slip-rule {
    border: none;
    border-top: 1px dashed #000;
    margin: 3mm 0;
  }
  .slip-items {
    font-size: 11pt;
    white-space: pre;
    margin: 2mm 0;
    font-family: 'Courier New', Courier, monospace;
  }
  .slip-total {
    font-size: 13pt;
    font-weight: 900;
    margin-top: 2mm;
  }
  .slip-revised {
    text-align: center;
    font-weight: 900;
    font-size: 11pt;
    margin-top: 3mm;
    border: 2px solid #000;
    padding: 2mm;
    letter-spacing: 1pt;
  }
}
```

- [ ] **Step 2: Add print infrastructure to kitchen page**

In `src/app/kitchen/page.tsx`:

**2a.** Add `useRef` and `useCallback` to the existing import if not already imported. The current import is:
```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
```
Already there — no change needed.

**2b.** After the `useStoreName` line inside `KitchenPage`, add the `printOrder` function:
```tsx
const printOrder = useCallback((order: Order, isRevised = false) => {
  const time = new Date(order.createdAt).toLocaleString('en-PH', {
    hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric',
  })
  const itemLines = order.items
    .map(item => `  ${String(item.quantity).padEnd(3)} ${item.menuItem.name}`)
    .join('\n')

  const slot = document.getElementById('print-slot')
  if (!slot) return
  slot.innerHTML = `
    <div class="print-slip">
      <p class="slip-brand">${storeName}</p>
      <hr class="slip-rule" />
      <p class="slip-order">${order.orderNumber}</p>
      <p class="slip-meta">Time: ${time}</p>
      <p class="slip-meta">Payment: ${order.paymentMethod === 'gcash' ? 'GCash' : 'Cash'}</p>
      <hr class="slip-rule" />
      <pre class="slip-items">${itemLines}</pre>
      <hr class="slip-rule" />
      <p class="slip-total">TOTAL: &#8369; ${order.totalAmount.toFixed(2)}</p>
      ${isRevised ? '<p class="slip-revised">[ REVISED ORDER ]</p>' : ''}
    </div>
  `
  window.print()
  slot.innerHTML = ''
}, [storeName])
```

**2c.** Add the print button inside each order card's action area (inside the `{action && (...)}` block, after the main action button) and the `#print-slot` div outside the main grid. 

Find the closing `</div>` of the `{/* Actions Area */}` section in the map and add the print button after the main action button:
```tsx
<button
  onClick={() => printOrder(order)}
  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-headline font-bold text-xs text-stone-500 bg-surface-container hover:bg-stone-200 active:scale-95 transition-all"
>
  <Icon name="print" size={16} />
  Print Slip
</button>
```

**2d.** Add `<div id="print-slot" />` as the last child inside the outer `<div className="min-h-screen ...">` wrapper (just before the closing `</div>`).

- [ ] **Step 3: Extend OrderItem type to include id and unitPrice**

The kitchen page `OrderItem` interface currently is:
```tsx
interface OrderItem { quantity: number; menuItem: { name: string } }
```

Update it (needed now for print, and later for edit):
```tsx
interface OrderItem {
  id: number
  quantity: number
  unitPrice: number
  menuItem: { id: number; name: string }
}
```

- [ ] **Step 4: Verify**

Visit `/kitchen` with an active order. Click "Print Slip" — browser print dialog opens (or silent print in kiosk mode) with a thermal-style slip. Confirm `storeName`, order number, items, and total are correct.

- [ ] **Step 5: Commit**
```bash
git add src/app/globals.css src/app/kitchen/page.tsx
git commit -m "add print order slip to kitchen display"
```

---

## Task 5: Per-item Check in Kitchen Display

**Files:**
- Modify: `src/app/kitchen/page.tsx`

- [ ] **Step 1: Add settings fetch + requireAllChecked state**

Inside `KitchenPage`, after the existing state declarations, add:
```tsx
const [requireAllChecked, setRequireAllChecked] = useState(false)
```

Add a settings fetch effect after the existing `useEffect` that calls `load()`:
```tsx
useEffect(() => {
  const fetchSettings = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => setRequireAllChecked(s.requireAllItemsChecked ?? false))
      .catch(() => {})
  }
  fetchSettings()
  const poll = setInterval(fetchSettings, 30000)
  return () => clearInterval(poll)
}, [])
```

- [ ] **Step 2: Add checkedItems state + helper functions**

After the `requireAllChecked` state, add:
```tsx
const [checkedItems, setCheckedItems] = useState<Map<number, Set<number>>>(new Map())

const toggleItem = (orderId: number, idx: number) => {
  setCheckedItems(prev => {
    const next = new Map(prev)
    const set = new Set(next.get(orderId) ?? [])
    if (set.has(idx)) set.delete(idx); else set.add(idx)
    next.set(orderId, set)
    return next
  })
}

const allItemsChecked = (order: Order) =>
  order.items.every((_, i) => checkedItems.get(order.id)?.has(i))
```

- [ ] **Step 3: Update item rows to be tappable checkboxes**

Find the items section in the card (the `order.items.map` block). Replace it with:
```tsx
<div className="flex-1 space-y-2.5 py-4 border-y border-black/5">
  {order.items.map((item, i) => {
    const isChecked = checkedItems.get(order.id)?.has(i) ?? false
    return (
      <button
        key={i}
        onClick={() => toggleItem(order.id, i)}
        className="flex items-center gap-3 w-full text-left active:opacity-70 transition-opacity"
      >
        <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-black shadow-sm transition-colors ${isChecked ? 'bg-tertiary text-on-tertiary' : 'bg-on-surface text-surface'}`}>
          {isChecked ? <Icon name="check" size={16} /> : item.quantity}
        </span>
        <span className={`font-bold text-lg leading-tight transition-all ${isChecked ? 'line-through text-stone-400' : order.status === 'ready' ? 'line-through text-stone-400' : 'text-on-surface'}`}>
          {item.menuItem.name}
        </span>
      </button>
    )
  })}
</div>
```

- [ ] **Step 4: Gate the advance button on requireAllChecked**

Find the main action `<button onClick={() => advance(order)} disabled={acting === order.id}` and update the `disabled` prop:
```tsx
disabled={acting === order.id || (requireAllChecked && !allItemsChecked(order))}
```

Also update the button's className to reflect disabled state visually. Add this condition after the existing className logic — the `disabled:opacity-50` Tailwind class is already present in the existing className string, so the visual dim happens automatically.

Optionally, when `requireAllChecked && !allItemsChecked(order)`, show a small hint below the button:
```tsx
{requireAllChecked && !allItemsChecked(order) && (
  <p className="text-xs text-center text-stone-400 font-medium">
    Check all items first
  </p>
)}
```

- [ ] **Step 5: Clear checked state when order is completed or removed**

In the `advance` function, after the `setCompleting` call (in the `nextStatus === 'completed'` branch), clear the checked state for that order:
```tsx
setCheckedItems(prev => { const next = new Map(prev); next.delete(order.id); return next })
```

- [ ] **Step 6: Verify**

Toggle "Require All Items Checked" on in admin settings. Visit `/kitchen` with an active order. Confirm confirm button is disabled until all items are tapped. Tap each item — checkmark appears, quantity becomes a tick. When all checked, button enables.

- [ ] **Step 7: Commit**
```bash
git add src/app/kitchen/page.tsx
git commit -m "add per-item checklist with strict mode gating in kitchen display"
```

---

## Task 6: API — Extend PATCH for Edit + Cancel Logging

**Files:**
- Modify: `src/app/api/orders/[id]/route.ts`
- Create: `src/app/api/orders/logs/route.ts`

- [ ] **Step 1: Replace orders/[id]/route.ts with extended version**

Replace the entire file `src/app/api/orders/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const VALID_STATUSES = ['pending_verification', 'awaiting_payment', 'preparing', 'ready', 'completed', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded']

interface EditItem {
  menuItemId: number
  quantity: number
  unitPrice: number
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const orderId = parseInt(id)
    const body = await request.json()
    const { status, paymentStatus, items, totalAmount } = body

    // ── Edit items ──────────────────────────────────────────────
    if (items !== undefined) {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } },
      })
      if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const beforeSnapshot = {
        items: current.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: current.totalAmount,
      }
      const afterSnapshot = {
        items: (items as EditItem[]).map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, unitPrice: i.unitPrice })),
        total: totalAmount,
      }

      await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId } })
        await tx.orderItem.createMany({
          data: (items as EditItem[]).map(i => ({
            orderId,
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            subtotal: i.unitPrice * i.quantity,
          })),
        })
        await tx.order.update({ where: { id: orderId }, data: { totalAmount } })
        await tx.orderLog.create({
          data: {
            orderId,
            action: 'edited',
            snapshot: JSON.stringify({ before: beforeSnapshot, after: afterSnapshot }),
          },
        })
      })

      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } }, gcashAccount: true },
      })
      return NextResponse.json(updated)
    }

    // ── Cancel ──────────────────────────────────────────────────
    if (status === 'cancelled') {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } },
      })

      const order = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: { status: 'cancelled' },
          include: { items: { include: { menuItem: true } }, gcashAccount: true },
        })
        await tx.orderLog.create({
          data: {
            orderId,
            action: 'cancelled',
            snapshot: JSON.stringify({
              items: current?.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })) ?? [],
              total: current?.totalAmount ?? 0,
            }),
          },
        })
        return updated
      })
      return NextResponse.json(order)
    }

    // ── Standard status / payment update ────────────────────────
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid paymentStatus' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    console.error('Update order error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create order logs API route**

Create `src/app/api/orders/logs/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderId = parseInt(searchParams.get('orderId') ?? '')
  if (isNaN(orderId)) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 })
  }
  try {
    const logs = await prisma.orderLog.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(logs)
  } catch (error) {
    console.error('Order logs error:', error)
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify**

Using a REST client or browser: `PATCH /api/orders/1` with `{ "status": "cancelled" }`. Then `GET /api/orders/logs?orderId=1` — should return one log entry with `action: "cancelled"` and a snapshot JSON.

- [ ] **Step 4: Commit**
```bash
git add src/app/api/orders/[id]/route.ts src/app/api/orders/logs/route.ts
git commit -m "extend orders PATCH for item edit and cancel with audit logging"
```

---

## Task 7: EditOrderDrawer Component

**Files:**
- Create: `src/components/kitchen/EditOrderDrawer.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/kitchen/EditOrderDrawer.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Icon } from '@/components/shared/Icon'

interface MenuItemOption {
  id: number
  name: string
  price: number
  available: boolean
  stock: number
}

interface MenuCategory {
  id: number
  name: string
  icon: string
  items: MenuItemOption[]
}

export interface EditItem {
  menuItemId: number
  name: string
  quantity: number
  unitPrice: number
}

interface OrderItem {
  id: number
  quantity: number
  unitPrice: number
  menuItem: { id: number; name: string }
}

interface Order {
  id: number
  orderNumber: string
  totalAmount: number
  items: OrderItem[]
}

interface EditOrderDrawerProps {
  order: Order | null
  onClose: () => void
  onSaved: (updatedOrder: Order) => void
}

export function EditOrderDrawer({ order, onClose, onSaved }: EditOrderDrawerProps) {
  const [editItems, setEditItems] = useState<EditItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!order) return
    setEditItems(order.items.map(i => ({
      menuItemId: i.menuItem.id,
      name: i.menuItem.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })))
    setSaveError('')
    setShowPicker(false)
    fetch('/api/categories')
      .then(r => r.json())
      .then((data: MenuCategory[]) => {
        setCategories(data)
        if (data.length > 0) setActiveCategory(data[0].id)
        setLoadingMenu(false)
      })
      .catch(() => setLoadingMenu(false))
  }, [order])

  const total = editItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  const updateQty = (idx: number, qty: number) => {
    if (qty <= 0) {
      setEditItems(prev => prev.filter((_, i) => i !== idx))
    } else {
      setEditItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: qty } : item))
    }
  }

  const addMenuItem = (menuItem: MenuItemOption) => {
    setEditItems(prev => {
      const existing = prev.findIndex(i => i.menuItemId === menuItem.id)
      if (existing >= 0) {
        return prev.map((item, i) => i === existing ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { menuItemId: menuItem.id, name: menuItem.name, quantity: 1, unitPrice: menuItem.price }]
    })
  }

  const handleSave = async () => {
    if (!order || editItems.length === 0) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: editItems, totalAmount: total }),
      })
      if (!res.ok) throw new Error('Save failed')
      const updated = await res.json()
      onSaved(updated)
    } catch {
      setSaveError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  if (!order) return null

  const pickerItems = (categories.find(c => c.id === activeCategory)?.items ?? [])
    .filter(i => i.available && i.stock > 0)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-surface shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
          <div>
            <h2 className="font-headline font-black text-2xl text-on-surface">Edit Order</h2>
            <p className="text-stone-500 font-medium text-sm">{order.orderNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
            <Icon name="close" size={24} className="text-on-surface-variant" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Items</p>

          {editItems.length === 0 && (
            <p className="text-stone-400 font-medium text-sm text-center py-4">No items. Add some below.</p>
          )}

          {editItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-surface-container-low rounded-xl p-3">
              <span className="flex-1 font-bold text-on-surface text-sm">{item.name}</span>
              <span className="text-stone-500 text-sm font-medium">₱{item.unitPrice.toFixed(0)}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateQty(idx, item.quantity - 1)}
                  className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Icon name={item.quantity === 1 ? 'delete' : 'remove'} size={14} className="text-on-surface-variant" />
                </button>
                <span className="font-headline font-black text-on-surface w-6 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQty(idx, item.quantity + 1)}
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Icon name="add" size={14} className="text-on-primary" />
                </button>
              </div>
            </div>
          ))}

          {/* Add item picker */}
          <div className="pt-1">
            <button
              onClick={() => setShowPicker(p => !p)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-outline-variant/40 text-stone-500 hover:border-primary hover:text-primary transition-colors font-bold text-sm"
            >
              <Icon name={showPicker ? 'expand_less' : 'add'} size={18} />
              {showPicker ? 'Hide Menu' : 'Add Item'}
            </button>

            {showPicker && (
              <div className="mt-3 bg-surface-container-low rounded-xl overflow-hidden">
                {loadingMenu ? (
                  <div className="p-8 flex items-center justify-center">
                    <Icon name="hourglass_empty" size={24} className="text-primary animate-spin" />
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1 p-2 overflow-x-auto">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${activeCategory === cat.id ? 'bg-primary text-on-primary' : 'bg-surface-container text-stone-500 hover:text-on-surface'}`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                      {pickerItems.map(item => (
                        <button
                          key={item.id}
                          onClick={() => addMenuItem(item)}
                          className="text-left p-3 rounded-lg bg-surface-container-lowest hover:bg-primary/5 active:scale-95 transition-all border border-outline-variant/10"
                        >
                          <p className="font-bold text-on-surface text-xs leading-tight">{item.name}</p>
                          <p className="text-primary font-black text-sm mt-1">₱{item.price.toFixed(0)}</p>
                        </button>
                      ))}
                      {pickerItems.length === 0 && (
                        <p className="col-span-2 text-center text-stone-400 text-xs py-4">No available items in this category.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-outline-variant/20 px-6 py-4 bg-surface-container-lowest">
          {saveError && <p className="text-xs text-error font-bold mb-3 text-center">{saveError}</p>}
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium text-stone-500 text-sm">New Total</span>
            <span className="font-headline font-black text-2xl text-primary">₱{total.toFixed(2)}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3.5 rounded-xl font-bold text-sm bg-surface-container-low text-on-surface hover:bg-surface-container active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editItems.length === 0}
              className="flex-1 py-3.5 rounded-xl font-headline font-bold text-sm bg-secondary text-on-secondary shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**
```bash
git add src/components/kitchen/EditOrderDrawer.tsx
git commit -m "add EditOrderDrawer component for kitchen order editing"
```

---

## Task 8: Cancel + Edit in Kitchen Page

**Files:**
- Modify: `src/app/kitchen/page.tsx`

- [ ] **Step 1: Add import for EditOrderDrawer**

Add to the top of `src/app/kitchen/page.tsx`:
```tsx
import { EditOrderDrawer } from '@/components/kitchen/EditOrderDrawer'
import type { EditItem } from '@/components/kitchen/EditOrderDrawer'
```

- [ ] **Step 2: Add cancel and edit state**

Inside `KitchenPage`, add after existing state declarations:
```tsx
const [cancelTarget, setCancelTarget] = useState<Order | null>(null)
const [editingOrder, setEditingOrder] = useState<Order | null>(null)
```

- [ ] **Step 3: Add doCancel function**

After the `advance` function, add:
```tsx
const doCancel = async (order: Order) => {
  setCancelTarget(null)
  setCompleting(prev => new Set(prev).add(order.id))
  setTimeout(() => {
    setOrders(prev => prev.filter(o => o.id !== order.id))
    setCompleting(prev => { const s = new Set(prev); s.delete(order.id); return s })
    setCheckedItems(prev => { const next = new Map(prev); next.delete(order.id); return next })
  }, 600)
  await fetch(`/api/orders/${order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
}
```

- [ ] **Step 4: Add handleEditSaved function**

After `doCancel`, add:
```tsx
const handleEditSaved = (updatedOrder: Order) => {
  setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o))
  setEditingOrder(null)
  printOrder(updatedOrder, true)
}
```

- [ ] **Step 5: Add Cancel and Edit buttons to each card**

In the `{/* Actions Area */}` section, after the Print Slip button added in Task 4, add Cancel and Edit buttons:
```tsx
<div className="flex gap-2">
  <button
    onClick={() => setEditingOrder(order)}
    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-headline font-bold text-xs text-secondary bg-secondary-container/30 hover:bg-secondary-container/50 active:scale-95 transition-all"
  >
    <Icon name="edit" size={15} />
    Edit
  </button>
  <button
    onClick={() => setCancelTarget(order)}
    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-headline font-bold text-xs text-error bg-error-container/20 hover:bg-error-container/40 active:scale-95 transition-all"
  >
    <Icon name="cancel" size={15} />
    Cancel
  </button>
</div>
```

- [ ] **Step 6: Add cancel confirmation dialog**

Just before the closing `</div>` of the outermost wrapper (after `<div id="print-slot" />`), add:
```tsx
{/* Cancel confirmation dialog */}
{cancelTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
      <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mb-4 mx-auto">
        <Icon name="cancel" size={24} className="text-error" />
      </div>
      <h3 className="font-headline font-black text-2xl text-center text-on-surface mb-2 tracking-tight">Cancel Order?</h3>
      <p className="text-center text-on-surface-variant text-sm font-medium mb-6">
        Order <span className="font-black text-on-surface">{cancelTarget.orderNumber}</span> will be cancelled. This cannot be undone.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => setCancelTarget(null)}
          className="flex-1 py-3.5 rounded-xl font-headline font-bold text-sm bg-surface-container-low hover:bg-surface-container active:scale-95 transition-all"
        >
          Keep Order
        </button>
        <button
          onClick={() => doCancel(cancelTarget)}
          className="flex-1 py-3.5 rounded-xl font-headline font-bold text-sm bg-error text-white shadow-lg shadow-error/20 active:scale-95 transition-all"
        >
          Yes, Cancel
        </button>
      </div>
    </div>
  </div>
)}

{/* Edit order drawer */}
<EditOrderDrawer
  order={editingOrder}
  onClose={() => setEditingOrder(null)}
  onSaved={handleEditSaved}
/>
```

- [ ] **Step 7: Verify**

Visit `/kitchen` with active orders. Tap Cancel → dialog appears → confirm → card fades out. Tap Edit → drawer slides in → adjust items → Save → card updates, revised slip prints.

- [ ] **Step 8: Commit**
```bash
git add src/app/kitchen/page.tsx
git commit -m "add cancel and edit order actions to kitchen display"
```

---

## Task 9: Admin — View Order Logs

**Files:**
- Modify: `src/app/admin/orders/page.tsx`

- [ ] **Step 1: Add OrderLog type and logs state**

In `src/app/admin/orders/page.tsx`, add after the existing interfaces:
```tsx
interface OrderLog {
  id: number
  orderId: number
  action: string
  snapshot: string
  createdAt: string
}
```

Add new state inside `OrdersPage`:
```tsx
const [logsModal, setLogsModal] = useState<{ orderNumber: string; logs: OrderLog[] } | null>(null)
const [loadingLogs, setLoadingLogs] = useState(false)
```

- [ ] **Step 2: Add viewLogs function**

After the `cancelOrder` function, add:
```tsx
const viewLogs = async (order: Order) => {
  setLoadingLogs(true)
  const res = await fetch(`/api/orders/logs?orderId=${order.id}`)
  const logs = await res.json()
  setLoadingLogs(false)
  setLogsModal({ orderNumber: order.orderNumber, logs: Array.isArray(logs) ? logs : [] })
}
```

- [ ] **Step 3: Add logs button to each order row**

In the order row actions area (inside the `<div className="flex items-center gap-2 ...">` that contains the advance and cancel buttons), add a logs button:
```tsx
<button
  onClick={() => viewLogs(order)}
  title="View Order Logs"
  className="p-2.5 text-stone-400 hover:text-secondary hover:bg-secondary/10 rounded-xl transition-all"
>
  <Icon name="history" size={20} />
</button>
```

- [ ] **Step 4: Add logs modal**

Add the logs modal just before the component's closing `</div>`:
```tsx
{logsModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h3 className="font-headline font-black text-2xl text-on-surface tracking-tight">Order Logs</h3>
          <p className="text-stone-500 font-medium text-sm mt-0.5">{logsModal.orderNumber}</p>
        </div>
        <button
          onClick={() => setLogsModal(null)}
          className="p-2 rounded-xl hover:bg-surface-container transition-colors"
        >
          <Icon name="close" size={22} className="text-on-surface-variant" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {logsModal.logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-stone-400 gap-3">
            <Icon name="history" size={40} />
            <p className="font-medium text-sm">No logs for this order.</p>
          </div>
        ) : (
          logsModal.logs.map(log => {
            const snap = (() => { try { return JSON.parse(log.snapshot) } catch { return null } })()
            const isEdit = log.action === 'edited'
            return (
              <div key={log.id} className={`rounded-2xl p-5 border ${isEdit ? 'bg-secondary-container/10 border-secondary-container/30' : 'bg-error-container/10 border-error/20'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full ${isEdit ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-error'}`}>
                    {log.action}
                  </span>
                  <span className="text-xs text-stone-400 font-medium">
                    {new Date(log.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                {isEdit && snap?.before && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-surface-container-lowest rounded-xl p-3">
                      <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">Before</p>
                      {snap.before.items.map((i: { name: string; quantity: number }, idx: number) => (
                        <p key={idx} className="text-on-surface font-medium">{i.quantity}× {i.name}</p>
                      ))}
                      <p className="font-black text-primary mt-1.5">₱{Number(snap.before.total).toFixed(2)}</p>
                    </div>
                    <div className="bg-surface-container-lowest rounded-xl p-3">
                      <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">After</p>
                      {snap.after.items.map((i: { menuItemId: number; quantity: number; unitPrice: number }, idx: number) => (
                        <p key={idx} className="text-on-surface font-medium">{i.quantity}× item #{i.menuItemId}</p>
                      ))}
                      <p className="font-black text-primary mt-1.5">₱{Number(snap.after.total).toFixed(2)}</p>
                    </div>
                  </div>
                )}
                {!isEdit && snap?.items && (
                  <div className="text-xs bg-surface-container-lowest rounded-xl p-3">
                    <p className="font-bold text-stone-500 mb-1.5 uppercase tracking-wide text-[10px]">Order at cancellation</p>
                    {snap.items.map((i: { name: string; quantity: number }, idx: number) => (
                      <p key={idx} className="text-on-surface font-medium">{i.quantity}× {i.name}</p>
                    ))}
                    <p className="font-black text-primary mt-1.5">₱{Number(snap.total).toFixed(2)}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: Verify**

Cancel an order in the kitchen, then go to `/admin/orders`. Click the history icon on that order → logs modal shows the cancellation entry with items and total.

- [ ] **Step 6: Commit**
```bash
git add src/app/admin/orders/page.tsx
git commit -m "add order logs viewer to admin orders page"
```

---

## Task 10: Best Sellers API

**Files:**
- Create: `src/app/api/orders/best-sellers/route.ts`

- [ ] **Step 1: Create the endpoint**

Create `src/app/api/orders/best-sellers/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '7'), 1), 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    const topItems = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        order: {
          createdAt: { gte: since },
          status: { in: ['completed', 'preparing', 'ready'] },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
    })

    if (topItems.length === 0) return NextResponse.json([])

    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: topItems.map(i => i.menuItemId) },
        available: true,
        stock: { gt: 0 },
      },
    })

    const result = topItems
      .map(i => {
        const menuItem = menuItems.find(m => m.id === i.menuItemId)
        if (!menuItem) return null
        return { ...menuItem, totalSold: i._sum.quantity ?? 0 }
      })
      .filter(Boolean)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Best sellers error:', error)
    return NextResponse.json({ error: 'Failed to fetch best sellers' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify**

`GET /api/orders/best-sellers?days=7` — returns array of menu items with `totalSold` field (may be empty if no orders yet). With demo data loaded, should return top items.

- [ ] **Step 3: Commit**
```bash
git add src/app/api/orders/best-sellers/route.ts
git commit -m "add best sellers API endpoint with rolling window query"
```

---

## Task 11: Menu Page — Best Sellers Category + Preselect

**Files:**
- Modify: `src/app/(kiosk)/menu/page.tsx`

- [ ] **Step 1: Add BestSeller type and new state**

In `src/app/(kiosk)/menu/page.tsx`, add after the existing interfaces:
```tsx
interface BestSellerItem extends MenuItem {
  totalSold: number
}
```

Inside `MenuPage`, add after existing state:
```tsx
const [preselectId, setPreselectId] = useState<number | null>(null)
const [highlightId, setHighlightId] = useState<number | null>(null)

const BEST_SELLERS_ID = -1
```

- [ ] **Step 2: Replace the categories fetch useEffect**

Replace the existing `useEffect` that fetches `/api/categories` with:
```tsx
useEffect(() => {
  const rawPreselect = sessionStorage.getItem('kiosk_preselect_item')
  if (rawPreselect) {
    sessionStorage.removeItem('kiosk_preselect_item')
    setPreselectId(parseInt(rawPreselect))
  }
  const preselectItemId = rawPreselect ? parseInt(rawPreselect) : null

  Promise.all([
    fetch('/api/categories').then(r => r.json()),
    fetch('/api/orders/best-sellers?days=7').then(r => r.json()).catch(() => []),
  ]).then(([cats, sellers]: [Category[], BestSellerItem[]]) => {
    const sellerItems = Array.isArray(sellers) ? sellers : []
    let allCats: Category[] = cats

    if (sellerItems.length > 0) {
      const bsCat: Category = {
        id: BEST_SELLERS_ID,
        name: 'Best Sellers',
        icon: 'star',
        items: sellerItems,
      }
      allCats = [bsCat, ...cats]
    }

    setCategories(allCats)

    if (preselectItemId) {
      const catWithItem = allCats.find(c => c.items.some(i => i.id === preselectItemId))
      setActiveCategory(catWithItem?.id ?? allCats[0]?.id ?? null)
    } else {
      setActiveCategory(allCats[0]?.id ?? null)
    }
    setLoading(false)
  }).catch(() => setLoading(false))
}, [])
```

- [ ] **Step 3: Add highlight effect**

Add after the previous useEffect:
```tsx
useEffect(() => {
  if (!preselectId) return
  setHighlightId(preselectId)
  const timer = setTimeout(() => setHighlightId(null), 1500)
  return () => clearTimeout(timer)
}, [preselectId])
```

- [ ] **Step 4: Add highlight ring to item cards**

Find the item card element in the menu page (the tappable item card). Add a conditional ring class. Look for the item card's outer div — the class likely contains `rounded` and `bg-surface-container`. Add to its className:
```tsx
${item.id === highlightId ? 'ring-4 ring-primary ring-offset-2' : ''}
```

- [ ] **Step 5: Add star icon to Best Sellers category tab**

The category tabs map over `categories` and display `cat.name`. Find the category tab button and add an icon for the best sellers category:
```tsx
{cat.id === BEST_SELLERS_ID && (
  <Icon name="star" size={14} className="text-current" filled />
)}
{cat.name}
```

- [ ] **Step 6: Verify**

Load demo data via admin settings. Visit `/menu` — if there are completed orders in the last 7 days, a "Best Sellers" tab should appear first with a star icon. Click an item in Best Sellers — it should add to cart normally.

- [ ] **Step 7: Commit**
```bash
git add src/app/(kiosk)/menu/page.tsx
git commit -m "add best sellers virtual category and preselect highlight to menu"
```

---

## Task 12: Welcome Screen — Best Sellers Widget

**Files:**
- Modify: `src/app/(kiosk)/page.tsx`

- [ ] **Step 1: Add BestSellerItem type and state**

In `src/app/(kiosk)/page.tsx`, add after existing interfaces (there are none — add before `export default`):
```tsx
interface BestSellerItem {
  id: number
  name: string
  price: number
  image: string
  totalSold: number
}
```

Inside `WelcomePage`, add after existing state:
```tsx
const [bestSellers, setBestSellers] = useState<BestSellerItem[]>([])
const [showBestSellers, setShowBestSellers] = useState(false)
```

- [ ] **Step 2: Fetch best sellers on mount**

Add a new `useEffect` (separate from the existing clock/idle one) inside `WelcomePage`:
```tsx
useEffect(() => {
  fetch('/api/orders/best-sellers?days=7')
    .then(r => r.json())
    .then(data => setBestSellers(Array.isArray(data) ? data : []))
    .catch(() => {})
}, [])
```

- [ ] **Step 3: Add handleBestSellerItemTap**

Add inside `WelcomePage` before the return:
```tsx
const handleBestSellerItemTap = (itemId: number) => {
  sessionStorage.setItem('kiosk_preselect_item', String(itemId))
  router.push('/menu')
}
```

- [ ] **Step 4: Add the widget to the JSX**

In the footer section of the welcome page (the `<div className="absolute bottom-4 ...">` div), the current structure is a flex row with language buttons on the left and help button on the right. Add the best sellers pill as a centered absolute element above the footer, or as a center-justified middle child.

Replace the footer wrapper to add a centered middle slot:

Find: `<div className="absolute bottom-4 lg:bottom-8 left-0 right-0 z-10 px-4 lg:px-12 flex flex-col lg:flex-row gap-6 lg:gap-0 justify-between items-center lg:items-end">`

Keep the language buttons and help button as-is. Add the best sellers widget as an absolutely positioned element centered above the footer:

Insert just BEFORE the existing footer `<div>`:
```tsx
{/* Best Sellers Widget */}
{bestSellers.length > 0 && (
  <div className="absolute bottom-28 lg:bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
    {/* Collapsed pill */}
    {!showBestSellers && (
      <button
        onClick={() => setShowBestSellers(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm text-primary font-headline font-bold text-sm animate-pulse-ring hover:bg-primary/20 active:scale-95 transition-all"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        <Icon name="star" size={16} className="text-primary" filled />
        Best Sellers Right Now
        <Icon name="expand_less" size={16} className="text-primary rotate-180" />
      </button>
    )}

    {/* Expanded carousel */}
    {showBestSellers && (
      <>
        <div className="fixed inset-0 z-10" onClick={() => setShowBestSellers(false)} />
        <div className="relative z-20 flex flex-col items-center gap-3">
          <button
            onClick={() => setShowBestSellers(false)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-on-primary font-headline font-bold text-sm active:scale-95 transition-all"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            <Icon name="star" size={16} className="text-on-primary" filled />
            Best Sellers Right Now
            <Icon name="expand_less" size={16} className="text-on-primary" />
          </button>
          <div className="flex gap-3 overflow-x-auto pb-1 max-w-[90vw]">
            {bestSellers.map(item => (
              <button
                key={item.id}
                onClick={() => handleBestSellerItemTap(item.id)}
                className="shrink-0 w-36 bg-surface/90 backdrop-blur-sm rounded-2xl shadow-ambient border border-outline-variant/10 overflow-hidden active:scale-95 transition-transform text-left"
              >
                <div className="w-full h-24 bg-surface-container flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Icon name="restaurant" size={32} className="text-outline" />
                  )}
                </div>
                <div className="p-3">
                  <p className="font-headline font-bold text-on-surface text-xs leading-tight line-clamp-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    {item.name}
                  </p>
                  <p className="font-headline font-black text-primary text-sm mt-1" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                    ₱{item.price.toFixed(0)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 5: Verify**

With demo data + completed orders in last 7 days: visit welcome screen. A pulsing "Best Sellers Right Now" pill should appear above the footer. Tap it → carousel of item cards appears. Tap outside → collapses. Tap an item → navigates to menu with that item highlighted and its category pre-selected.

Without any qualifying orders (fresh DB): pill should not appear at all.

- [ ] **Step 6: Commit**
```bash
git add src/app/(kiosk)/page.tsx
git commit -m "add best sellers pulsing widget with carousel to welcome screen"
```

---

## Self-Review Checklist

- [x] **Image fix** — server + client guard, error display ✓
- [x] **OrderLog schema** — model added, migration step included ✓
- [x] **requireAllItemsChecked** — settings.json + admin toggle + kitchen poll ✓
- [x] **Print slip** — CSS `@media print`, `printOrder` fn, print button, `#print-slot` div ✓
- [x] **Per-item check** — toggle state, allItemsChecked gate, clear on complete ✓
- [x] **Cancel** — dialog, doCancel, animation, log written server-side ✓
- [x] **Edit** — EditOrderDrawer component, handleEditSaved, auto-print revised slip ✓
- [x] **Admin logs** — viewLogs fn, logs modal with before/after ✓
- [x] **Best sellers API** — groupBy query, filters unavailable/out-of-stock items ✓
- [x] **Menu preselect** — sessionStorage read on mount, highlight ring, Best Sellers tab ✓
- [x] **Welcome widget** — pill, carousel, tap-to-navigate, collapse on outside click ✓

**Type consistency check:**
- `EditItem` type exported from `EditOrderDrawer.tsx` and imported in `kitchen/page.tsx` ✓ (import declared in Task 8 Step 1, though `EditItem` is used inside the drawer component itself — the kitchen page doesn't need to import it directly since `handleEditSaved` just receives the updated `Order`)
- `OrderItem.id` and `OrderItem.unitPrice` added in Task 4 Step 3 before they're needed in EditOrderDrawer ✓
- `BEST_SELLERS_ID = -1` declared as a const in menu page and referenced consistently ✓
