# Order Recovery & Accountability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cancel reason prompts, a kiosk order status lookup, admin-only hard delete, and GCash refund tracking to protect against accidental kitchen cancellations.

**Architecture:** Two new string fields on `Order` (`cancelReason`, `refundStatus`), one new public API route for status lookup, one new kiosk page, and UI changes in kitchen and admin panels. No new tables.

**Tech Stack:** Next.js 14 App Router, Prisma + SQLite, iron-session, Tailwind CSS, TypeScript

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `cancelReason`, `refundStatus` to `Order` |
| `src/app/api/orders/[id]/route.ts` | Cancel branch: store reason + flag refund; add `refundStatus` to standard PATCH; add `DELETE` handler |
| `src/app/api/orders/status/route.ts` | **New** — public order status lookup |
| `src/app/(kiosk)/status/page.tsx` | **New** — order status lookup kiosk screen |
| `src/app/(kiosk)/page.tsx` | Add "Check Order Status" button |
| `src/app/kitchen/page.tsx` | Replace cancel dialog with reason-picker |
| `src/app/admin/orders/page.tsx` | Add delete button, refund banner, refund badge + action |

---

## Task 1: Schema — Add cancelReason and refundStatus

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add two fields to the Order model**

Open `prisma/schema.prisma`. Find the `Order` model (line 44). Add the two new fields after `notes`:

```prisma
model Order {
  id              Int           @id @default(autoincrement())
  orderNumber     String        @unique
  status          String        @default("pending")
  paymentMethod   String
  paymentStatus   String        @default("unpaid")
  totalAmount     Float
  gcashAccountId  Int?
  gcashAccount    GCashAccount? @relation(fields: [gcashAccountId], references: [id])
  confirmedById   Int?
  confirmedBy     AdminUser?    @relation(fields: [confirmedById], references: [id])
  notes           String        @default("")
  cancelReason    String        @default("")
  refundStatus    String        @default("")
  items           OrderItem[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  logs            OrderLog[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_cancel_reason_refund_status
```

Expected output: `The following migration(s) have been created and applied from new schema changes: migrations/..._add_cancel_reason_refund_status`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "add cancelReason and refundStatus fields to Order"
```

---

## Task 2: API — Update PATCH cancel branch + add refundStatus + add DELETE

**Files:**
- Modify: `src/app/api/orders/[id]/route.ts`

**Context:** The file currently has a `PATCH` handler with three branches: edit items, cancel, and standard status update. We are:
1. Making the cancel branch accept `cancelReason` and auto-set `refundStatus: 'pending'` for paid GCash orders
2. Making the standard update branch support `refundStatus` changes (for admin "Mark Refunded")
3. Adding a new `DELETE` handler that requires admin session

- [ ] **Step 1: Add imports for iron-session at the top of the file**

Current top of `src/app/api/orders/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
```

Replace with:
```ts
import { NextResponse } from 'next/server'
import { getIronSession } from 'iron-session'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { sessionOptions, SessionData } from '@/lib/session'
```

- [ ] **Step 2: Update constants and body destructuring**

Current constants and interface:
```ts
const VALID_STATUSES = ['pending_verification', 'awaiting_payment', 'preparing', 'ready', 'completed', 'cancelled']
const VALID_PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded']
```

Add after them:
```ts
const VALID_REFUND_STATUSES = ['', 'pending', 'completed']
```

Current body destructuring (line ~19):
```ts
const { status, paymentStatus, items, totalAmount } = body
```

Replace with:
```ts
const { status, paymentStatus, items, totalAmount, cancelReason, refundStatus } = body
```

- [ ] **Step 3: Replace the cancel branch**

Find the cancel branch (starts at `if (status === 'cancelled') {`). Replace the entire block with:

```ts
    // ── Cancel ──────────────────────────────────────────────────
    if (status === 'cancelled') {
      const current = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { menuItem: true } } },
      })
      if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

      const shouldFlagRefund =
        current.paymentMethod === 'gcash' && current.paymentStatus === 'paid'

      const order = await prisma.$transaction(async (tx) => {
        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'cancelled',
            cancelReason: cancelReason ?? '',
            ...(shouldFlagRefund ? { refundStatus: 'pending' } : {}),
          },
          include: { items: { include: { menuItem: true } }, gcashAccount: true },
        })
        await tx.orderLog.create({
          data: {
            orderId,
            action: 'cancelled',
            snapshot: JSON.stringify({
              items: current.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })),
              total: current.totalAmount,
              cancelReason: cancelReason ?? '',
            }),
          },
        })
        return updated
      })
      return NextResponse.json(order)
    }
```

- [ ] **Step 4: Update the standard status/payment update branch to support refundStatus**

Find the standard update section (near the bottom of PATCH). Replace the validation and `prisma.order.update` call:

```ts
    // ── Standard status / payment / refund update ──────────────
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return NextResponse.json({ error: 'Invalid paymentStatus' }, { status: 400 })
    }
    if (refundStatus !== undefined && !VALID_REFUND_STATUSES.includes(refundStatus)) {
      return NextResponse.json({ error: 'Invalid refundStatus' }, { status: 400 })
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(refundStatus !== undefined ? { refundStatus } : {}),
      },
      include: {
        items: { include: { menuItem: true } },
        gcashAccount: true,
      },
    })
    return NextResponse.json(order)
```

- [ ] **Step 5: Add the DELETE handler after the closing brace of the PATCH function**

```ts
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies()
    const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
    if (!session.isLoggedIn || session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const orderId = parseInt(id)

    await prisma.$transaction(async (tx) => {
      const orderItems = await tx.orderItem.findMany({ where: { orderId } })
      const orderItemIds = orderItems.map(i => i.id)
      await tx.orderItemAddon.deleteMany({ where: { orderItemId: { in: orderItemIds } } })
      await tx.orderItem.deleteMany({ where: { orderId } })
      await tx.orderLog.deleteMany({ where: { orderId } })
      await tx.order.delete({ where: { id: orderId } })
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2025') {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    console.error('Delete order error:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
```

- [ ] **Step 6: Verify the app builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/orders/[id]/route.ts
git commit -m "update cancel API to store reason and flag GCash refunds, add admin-only DELETE"
```

---

## Task 3: Kitchen UI — Cancel reason picker

**Files:**
- Modify: `src/app/kitchen/page.tsx`

**Context:** The kitchen page has a `doCancel(order: Order)` function and a `{cancelTarget && ...}` dialog block rendered near the bottom of the JSX. We need to change `doCancel` to accept a `reason` string and replace the dialog with a reason-picker.

- [ ] **Step 1: Update the doCancel function signature to accept a reason**

Find `doCancel` (around line 193):
```ts
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

Replace with:
```ts
  const doCancel = async (order: Order, reason: string) => {
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
      body: JSON.stringify({ status: 'cancelled', cancelReason: reason }),
    })
  }
```

- [ ] **Step 2: Replace the cancel confirmation dialog with the reason-picker**

Find the `{cancelTarget && (...)}` block (around line 371). Replace the entire block:

```tsx
      {/* Cancel reason picker */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-3xl p-8 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Icon name="cancel" size={24} className="text-error" />
            </div>
            <h3 className="font-headline font-black text-2xl text-center text-on-surface mb-1 tracking-tight">
              Cancel Order?
            </h3>
            <p className="text-center text-on-surface-variant text-sm font-medium mb-6">
              Order <span className="font-black text-on-surface">{cancelTarget.orderNumber}</span> — why are you cancelling?
            </p>
            <div className="flex flex-col gap-2 mb-3">
              {[
                { key: 'customer_request', label: 'Customer Request' },
                { key: 'out_of_stock', label: 'Out of Stock' },
                { key: 'duplicate', label: 'Duplicate Order' },
              ].map(reason => (
                <button
                  key={reason.key}
                  onClick={() => doCancel(cancelTarget, reason.key)}
                  className="w-full py-3.5 rounded-xl font-headline font-bold text-sm bg-error/10 text-error hover:bg-error hover:text-white active:scale-95 transition-all"
                >
                  {reason.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCancelTarget(null)}
              className="w-full py-3.5 rounded-xl font-headline font-bold text-sm bg-surface-container-low hover:bg-surface-container active:scale-95 transition-all text-on-surface"
            >
              Oops, go back
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Verify in browser**

Start the dev server (`npm run dev`). Open `/kitchen`. Place a test order via the kiosk. In the kitchen, click Cancel on the order. Verify:
- The reason-picker appears with three red buttons + one grey "go back" button
- Clicking "Oops, go back" closes the dialog without cancelling
- Clicking a reason (e.g. "Out of Stock") cancels the order and it disappears from the board

- [ ] **Step 4: Commit**

```bash
git add src/app/kitchen/page.tsx
git commit -m "replace kitchen cancel dialog with cancel reason picker"
```

---

## Task 4: New API — Public order status lookup

**Files:**
- Create: `src/app/api/orders/status/route.ts`

**Context:** This is a new public GET endpoint (no auth). It returns a safe subset of order data for the kiosk status page.

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const CANCEL_REASON_LABELS: Record<string, string> = {
  customer_request: 'Cancelled by customer request',
  out_of_stock: 'Item was out of stock',
  duplicate: 'Duplicate order',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orderNumber = searchParams.get('order')?.toUpperCase().trim()

  if (!orderNumber) {
    return NextResponse.json({ error: 'Order number required' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: { include: { menuItem: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    cancelReason: order.cancelReason ? (CANCEL_REASON_LABELS[order.cancelReason] ?? '') : '',
    refundStatus: order.refundStatus,
    items: order.items.map(i => ({ name: i.menuItem.name, quantity: i.quantity })),
    createdAt: order.createdAt,
  })
}
```

- [ ] **Step 2: Verify in browser**

With dev server running, open: `http://localhost:3000/api/orders/status?order=A-001` (use a real order number from your DB).

Expected: JSON with `orderNumber`, `status`, `cancelReason`, `refundStatus`, `items`, `createdAt`. No `paymentMethod`, `totalAmount`, or account data.

Try a fake order number. Expected: `{ "error": "Order not found" }` with 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/status/route.ts
git commit -m "add public order status lookup API"
```

---

## Task 5: New kiosk page — /status

**Files:**
- Create: `src/app/(kiosk)/status/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/shared/Icon'

interface StatusResult {
  orderNumber: string
  status: string
  cancelReason: string
  refundStatus: string
  items: { name: string; quantity: number }[]
  createdAt: string
}

const STATUS_DISPLAY: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  pending_verification: { label: 'Awaiting GCash Confirmation', icon: 'qr_code_scanner', color: 'text-stone-600', bg: 'bg-stone-100' },
  awaiting_payment: { label: 'Awaiting Cash Payment', icon: 'payments', color: 'text-stone-600', bg: 'bg-stone-100' },
  preparing: { label: 'Being Prepared', icon: 'soup_kitchen', color: 'text-secondary', bg: 'bg-secondary-container' },
  ready: { label: 'Ready for Pickup!', icon: 'done_all', color: 'text-tertiary', bg: 'bg-tertiary-container' },
  completed: { label: 'Order Completed', icon: 'task_alt', color: 'text-stone-500', bg: 'bg-stone-100' },
  cancelled: { label: 'Order Cancelled', icon: 'cancel', color: 'text-error', bg: 'bg-error-container' },
}

export default function StatusPage() {
  const router = useRouter()
  const [input, setInput] = useState('')
  const [result, setResult] = useState<StatusResult | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(false)

  const lookup = async () => {
    const q = input.trim().toUpperCase()
    if (!q) return
    setLoading(true)
    setResult(null)
    setNotFound(false)
    try {
      const res = await fetch(`/api/orders/status?order=${encodeURIComponent(q)}`)
      if (res.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setResult(await res.json())
    } catch {
      setNotFound(true)
    }
    setLoading(false)
  }

  const cfg = result ? (STATUS_DISPLAY[result.status] ?? STATUS_DISPLAY.preparing) : null

  return (
    <div className="h-screen w-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-8 py-4 bg-surface-container-low shrink-0">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-on-surface-variant active:scale-95 transition-transform"
        >
          <Icon name="arrow_back" size={24} />
        </button>
        <h1 className="font-headline font-black text-xl text-on-surface">Check Order Status</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
        {/* Input row */}
        <div className="w-full max-w-sm flex flex-col gap-3">
          <p className="text-on-surface-variant font-medium text-center text-sm">
            Enter your order number from your receipt
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="A-001"
              className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-5 py-4 text-2xl font-headline font-black text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary/30 uppercase"
              autoFocus
            />
            <button
              onClick={lookup}
              disabled={loading || !input.trim()}
              className="bg-primary text-on-primary px-6 py-4 rounded-xl font-headline font-bold text-lg shadow-primary-glow active:scale-95 transition-all disabled:opacity-40"
            >
              {loading
                ? <Icon name="hourglass_empty" size={24} className="animate-spin" />
                : <Icon name="search" size={24} />
              }
            </button>
          </div>
        </div>

        {/* Not found */}
        {notFound && (
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl p-6 text-center shadow-ambient">
            <Icon name="search_off" size={40} className="text-stone-400 mb-2" />
            <p className="font-headline font-bold text-on-surface mb-1">Order Not Found</p>
            <p className="text-sm text-on-surface-variant">Check your receipt and try again.</p>
          </div>
        )}

        {/* Result card */}
        {result && cfg && (
          <div className="w-full max-w-sm bg-surface-container-lowest rounded-2xl shadow-ambient overflow-hidden">
            {/* Status header */}
            <div className={`${cfg.bg} px-6 py-5 flex items-center gap-4`}>
              <Icon name={cfg.icon} size={32} className={cfg.color} />
              <div>
                <p className="font-headline font-black text-3xl text-on-surface tracking-tight">{result.orderNumber}</p>
                <p className={`font-bold text-sm ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>

            {/* Items */}
            <div className="px-6 py-4 space-y-2">
              {result.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-surface-container flex items-center justify-center text-xs font-black text-on-surface shrink-0">
                    {item.quantity}
                  </span>
                  <span className="text-on-surface font-medium">{item.name}</span>
                </div>
              ))}
            </div>

            {/* Cancel reason */}
            {result.cancelReason && (
              <div className="px-6 pb-4">
                <p className="text-sm text-on-surface-variant">{result.cancelReason}</p>
              </div>
            )}

            {/* GCash refund notice */}
            {result.status === 'cancelled' && result.refundStatus === 'pending' && (
              <div className="mx-6 mb-5 bg-error-container/30 rounded-xl p-3 flex items-start gap-2">
                <Icon name="info" size={18} className="text-error shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-error">
                  GCash refund pending — please see the cashier.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `http://localhost:3000/status`. Verify:
- Input field is focused, pressing Enter triggers lookup
- Valid order number shows the status card with items
- Invalid order number shows "Order Not Found"
- A cancelled GCash-paid order shows the refund notice

- [ ] **Step 3: Commit**

```bash
git add src/app/(kiosk)/status/page.tsx
git commit -m "add kiosk order status lookup page"
```

---

## Task 6: Kiosk welcome screen — "Check Order Status" button

**Files:**
- Modify: `src/app/(kiosk)/page.tsx`

**Context:** The welcome page has a main layout with hero text and a "Tap to Order" button. The best sellers widget sits at `absolute bottom-28 lg:bottom-24`. We add a small secondary button at the very bottom of the screen.

- [ ] **Step 1: Add the button**

In `src/app/(kiosk)/page.tsx`, find the closing `</div>` of the root `<div className="relative h-screen w-screen overflow-hidden bg-surface select-none">`. Just before that closing tag, add:

```tsx
      {/* Order status check link */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
        <button
          onClick={() => router.push('/status')}
          className="flex items-center gap-2 px-5 py-2 rounded-full text-on-surface-variant/60 hover:text-on-surface-variant text-xs font-bold transition-colors active:scale-95"
        >
          <Icon name="search" size={14} />
          Check Order Status
        </button>
      </div>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000`. Verify:
- "Check Order Status" link is visible at the very bottom of the screen
- Tapping it navigates to `/status`
- It doesn't interfere with the best sellers widget (which sits at bottom-28)

- [ ] **Step 3: Commit**

```bash
git add src/app/(kiosk)/page.tsx
git commit -m "add check order status button to kiosk welcome screen"
```

---

## Task 7: Admin orders page — delete button + refund banner + refund actions

**Files:**
- Modify: `src/app/admin/orders/page.tsx`

**Context:** The page has an `Order` interface, a `cancelOrder` function, and renders order rows. We need to: (1) add `cancelReason` and `refundStatus` to the interface, (2) add `deleteOrder` and `markRefunded` functions, (3) add a pending refunds banner, (4) add per-order delete button and refund badge/action.

- [ ] **Step 1: Update the Order interface**

Find the `Order` interface at the top of the file:
```ts
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
```

Replace with:
```ts
interface Order {
  id: number
  orderNumber: string
  status: string
  paymentMethod: string
  paymentStatus: string
  totalAmount: number
  createdAt: string
  cancelReason: string
  refundStatus: string
  items: OrderItem[]
}
```

- [ ] **Step 2: Add deleteOrder and markRefunded functions**

Find the `cancelOrder` function:
```ts
  const cancelOrder = async (id: number) => {
    if (!confirm('Cancel this order?')) return
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    load()
  }
```

After it, add:
```ts
  const deleteOrder = async (id: number, orderNumber: string) => {
    if (!confirm(`Permanently delete order ${orderNumber} and all its records? This cannot be undone.`)) return
    await fetch(`/api/orders/${id}`, { method: 'DELETE' })
    load()
  }

  const markRefunded = async (id: number) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refundStatus: 'completed' }),
    })
    load()
  }
```

- [ ] **Step 3: Add pending refunds banner**

Find the orders list section — the `{loading ? (` block. Just before it, add:

```tsx
      {/* Pending refunds banner */}
      {orders.some(o => o.refundStatus === 'pending') && (
        <div className="mb-6 bg-error-container/30 border border-error/20 rounded-xl px-5 py-3 flex items-center gap-3">
          <Icon name="warning" size={20} className="text-error shrink-0" />
          <p className="text-sm font-bold text-error flex-1">
            {orders.filter(o => o.refundStatus === 'pending').length} GCash refund{orders.filter(o => o.refundStatus === 'pending').length > 1 ? 's' : ''} pending — students are waiting for their money back.
          </p>
        </div>
      )}
```

- [ ] **Step 4: Add refund badges to the order number line**

Find the block that renders the order number and status badge (around line 190):
```tsx
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-headline font-extrabold text-lg text-on-surface tracking-tight">
                        {order.orderNumber}
                      </p>
                      <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full tracking-wider ${STATUS_BADGE[order.status] ?? 'bg-surface-container text-stone-500'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      <span className="text-xs font-medium text-stone-400 flex items-center gap-1">
                        <Icon name="schedule" size={14} />
                        {timeAgo(order.createdAt)}
                      </span>
                    </div>
```

Replace with:
```tsx
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-headline font-extrabold text-lg text-on-surface tracking-tight">
                        {order.orderNumber}
                      </p>
                      <span className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full tracking-wider ${STATUS_BADGE[order.status] ?? 'bg-surface-container text-stone-500'}`}>
                        {STATUS_LABEL[order.status] ?? order.status}
                      </span>
                      {order.refundStatus === 'pending' && (
                        <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-error/10 text-error tracking-wider">
                          Refund Pending
                        </span>
                      )}
                      {order.refundStatus === 'completed' && (
                        <span className="text-[10px] uppercase font-bold px-3 py-1 rounded-full bg-surface-container text-stone-400 tracking-wider">
                          Refunded
                        </span>
                      )}
                      <span className="text-xs font-medium text-stone-400 flex items-center gap-1">
                        <Icon name="schedule" size={14} />
                        {timeAgo(order.createdAt)}
                      </span>
                    </div>
```

- [ ] **Step 5: Add Mark Refunded and Delete buttons to the actions area**

Find the actions area (around line 217):
```tsx
                  <div className="flex items-center gap-2 ml-auto sm:ml-0">
                    {action && (
                      <button ...>
                        {acting === order.id ? 'Updating…' : action.label}
                      </button>
                    )}
                    {!['completed', 'cancelled'].includes(order.status) && (
                      <button onClick={() => cancelOrder(order.id)} ...>
                        <Icon name="cancel" size={20} />
                      </button>
                    )}
                    <button onClick={() => viewLogs(order)} ...>
                      <Icon name="history" size={20} />
                    </button>
                  </div>
```

Replace with:
```tsx
                  <div className="flex items-center gap-2 ml-auto sm:ml-0 flex-wrap justify-end">
                    {order.refundStatus === 'pending' && (
                      <button
                        onClick={() => markRefunded(order.id)}
                        className="px-4 py-2 text-xs font-bold bg-tertiary text-on-tertiary rounded-xl active:scale-95 transition-transform shadow-sm"
                      >
                        Mark Refunded
                      </button>
                    )}
                    {action && (
                      <button
                        onClick={() => advanceOrder(order)}
                        disabled={acting === order.id}
                        className="bg-primary text-on-primary text-sm font-headline font-bold px-5 py-2.5 rounded-xl shadow-md shadow-primary/20 active:scale-95 transition-transform disabled:opacity-50 min-w-[120px] text-center"
                      >
                        {acting === order.id ? 'Updating…' : action.label}
                      </button>
                    )}
                    {!['completed', 'cancelled'].includes(order.status) && (
                      <button
                        onClick={() => cancelOrder(order.id)}
                        title="Cancel Order"
                        className="p-2.5 text-stone-400 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                      >
                        <Icon name="cancel" size={20} />
                      </button>
                    )}
                    {['completed', 'cancelled'].includes(order.status) && (
                      <button
                        onClick={() => deleteOrder(order.id, order.orderNumber)}
                        title="Permanently Delete"
                        className="p-2.5 text-stone-400 hover:text-error hover:bg-error/10 rounded-xl transition-all"
                      >
                        <Icon name="delete_forever" size={20} />
                      </button>
                    )}
                    <button
                      onClick={() => viewLogs(order)}
                      title="View Order Logs"
                      className="p-2.5 text-stone-400 hover:text-secondary hover:bg-secondary/10 rounded-xl transition-all"
                    >
                      <Icon name="history" size={20} />
                    </button>
                  </div>
```

- [ ] **Step 6: Verify in browser**

Open `/admin/orders`. Verify:
- If any GCash orders with `refundStatus: 'pending'` exist, the red banner appears at the top
- Cancelled GCash paid orders show "Refund Pending" badge + "Mark Refunded" button
- Clicking "Mark Refunded" refreshes the list and the badge changes to "Refunded"
- Completed/cancelled orders show a `delete_forever` trash icon
- Clicking trash icon shows the confirm dialog, then removes the order on confirm
- Non-admin session: DELETE returns 403 (test by logging out and calling API directly)

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/orders/page.tsx
git commit -m "add delete button and GCash refund tracking to admin orders page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Feature 3: Cancel reason prompt — Task 3 (kitchen UI) + Task 2 (API stores reason)
- ✅ Feature 4: Order status lookup on kiosk — Task 4 (API) + Task 5 (page) + Task 6 (welcome button)
- ✅ Feature 5: Admin-only hard delete — Task 2 (DELETE handler with role check) + Task 7 (delete button)
- ✅ Feature 6: GCash refund flag — Task 2 (auto-flag on cancel) + Task 7 (banner + mark refunded)
- ✅ Schema — Task 1

**Type consistency:**
- `cancelReason` field name is consistent across schema, API, interface, and UI
- `refundStatus` values `''`, `'pending'`, `'completed'` are consistent across all tasks
- `CANCEL_REASON_LABELS` keys match the reason keys used in Task 3 (`customer_request`, `out_of_stock`, `duplicate`)

**No placeholders found.**
