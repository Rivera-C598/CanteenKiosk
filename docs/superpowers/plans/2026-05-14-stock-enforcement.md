# Stock Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent ordering more than available stock — enforced in the kiosk UI and atomically on the server.

**Architecture:** UI disables the `+` button once cart quantity reaches item stock. Order creation wraps stock-check + decrement in a `prisma.$transaction` (SQLite serializes writes, making it race-safe). Cancellation restores stock at any stage; completion no longer decrements (already reserved at creation).

**Tech Stack:** Next.js App Router, Prisma, SQLite

---

## File Map

| File | Change |
|------|--------|
| `src/app/(kiosk)/menu/page.tsx` | Destructure `items` from `useCart`; guard `handleAdd`; extend `disabled` prop |
| `src/app/(kiosk)/payment/page.tsx` | Read `data.error` from response body; show specific stock error to user |
| `src/app/api/orders/route.ts` | Wrap order create in `prisma.$transaction`; check + decrement stock per item |
| `src/app/api/orders/[id]/route.ts` | Remove `isCompleting` stock decrement; restore stock on ANY cancellation |

---

### Task 1: UI — Disable `+` button when cart quantity reaches stock

**Files:**
- Modify: `src/app/(kiosk)/menu/page.tsx:35` (useCart destructure)
- Modify: `src/app/(kiosk)/menu/page.tsx:91-95` (handleAdd)
- Modify: `src/app/(kiosk)/menu/page.tsx:188` (button disabled prop)

- [ ] **Step 1: Destructure `items` from `useCart`**

Line 35 currently reads:
```tsx
const { addItem, totalItems, totalAmount } = useCart()
```
Change to:
```tsx
const { addItem, items, totalItems, totalAmount } = useCart()
```

- [ ] **Step 2: Guard `handleAdd` against exceeding stock**

Lines 91-95 currently read:
```tsx
const handleAdd = (item: MenuItem) => {
  addItem({ id: item.id, name: item.name, price: item.price, image: item.image })
  setAddedId(item.id)
  setTimeout(() => setAddedId(null), 600)
}
```
Replace with:
```tsx
const handleAdd = (item: MenuItem) => {
  const cartQty = items.find(i => i.id === item.id)?.quantity ?? 0
  if (cartQty >= item.stock) return
  addItem({ id: item.id, name: item.name, price: item.price, image: item.image })
  setAddedId(item.id)
  setTimeout(() => setAddedId(null), 600)
}
```

- [ ] **Step 3: Extend button `disabled` prop**

Line 188 currently reads:
```tsx
disabled={!item.available || item.stock === 0}
```
Replace with:
```tsx
disabled={!item.available || item.stock === 0 || (items.find(i => i.id === item.id)?.quantity ?? 0) >= item.stock}
```

- [ ] **Step 4: Manual verify**

Start dev server. Add an item to cart up to its stock limit. Confirm `+` button becomes disabled. Confirm you cannot bypass via rapid tapping.

- [ ] **Step 5: Commit**

```bash
git add src/app/(kiosk)/menu/page.tsx
git commit -m "disable + button when cart quantity reaches stock limit"
```

---

### Task 2: Payment page — Show specific stock error from server

**Files:**
- Modify: `src/app/(kiosk)/payment/page.tsx:34-48`

- [ ] **Step 1: Replace generic error throw with specific error display**

Lines 34-48 currently read:
```tsx
      if (!res.ok) throw new Error('Order failed')
      const order = await res.json()
      if (selected === 'gcash') {
        router.push(`/payment/gcash?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
      } else if (selected === 'cashless') {
        router.push(`/payment/cashless?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
      } else {
        clearCart()
        router.push(`/confirmed?order=${order.orderNumber}&method=${selected}&amount=${totalAmount}`)
      }
    } catch {
      setError(t('payment.error'))
      setLoading(false)
    }
```
Replace with:
```tsx
      const order = await res.json()
      if (!res.ok) {
        setError(order.error ?? t('payment.error'))
        setLoading(false)
        return
      }
      if (selected === 'gcash') {
        router.push(`/payment/gcash?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
      } else if (selected === 'cashless') {
        router.push(`/payment/cashless?order=${order.orderNumber}&amount=${totalAmount}&orderId=${order.id}`)
      } else {
        clearCart()
        router.push(`/confirmed?order=${order.orderNumber}&method=${selected}&amount=${totalAmount}`)
      }
    } catch {
      setError(t('payment.error'))
      setLoading(false)
    }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(kiosk)/payment/page.tsx
git commit -m "show server stock error message on payment page"
```

---

### Task 3: Server — Atomic stock check + decrement on order creation

**Files:**
- Modify: `src/app/api/orders/route.ts:93-113`

- [ ] **Step 1: Replace `prisma.order.create` with a `prisma.$transaction`**

Lines 93-113 currently read:
```ts
    const order = await prisma.order.create({
      data: {
        orderNumber,
        paymentMethod,
        paymentStatus: 'unpaid',
        status: paymentMethod === 'cash' ? 'awaiting_payment' : 'pending_verification',
        totalAmount: computedTotal,
        gcashAccountId,
        items: { create: orderItems },
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
```
Replace with:
```ts
    const order = await prisma.$transaction(async (tx) => {
      for (const orderItem of orderItems) {
        const menuItem = await tx.menuItem.findUnique({ where: { id: orderItem.menuItemId } })
        if (!menuItem || menuItem.stock < orderItem.quantity) {
          const name = menuItem?.name ?? 'Item'
          const avail = menuItem?.stock ?? 0
          throw new Error(`STOCK_INSUFFICIENT:${name}:${avail}`)
        }
        await tx.menuItem.update({
          where: { id: orderItem.menuItemId },
          data: { stock: { decrement: orderItem.quantity } },
        })
      }
      return tx.order.create({
        data: {
          orderNumber,
          paymentMethod,
          paymentStatus: 'unpaid',
          status: paymentMethod === 'cash' ? 'awaiting_payment' : 'pending_verification',
          totalAmount: computedTotal,
          gcashAccountId,
          items: { create: orderItems },
        },
        include: {
          items: { include: { menuItem: true } },
          gcashAccount: true,
        },
      })
    })

    return NextResponse.json(order)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('STOCK_INSUFFICIENT:')) {
      const parts = error.message.split(':')
      const name = parts[1]
      const avail = parts[2]
      return NextResponse.json(
        { error: `Only ${avail} ${name} available` },
        { status: 409 }
      )
    }
    console.error('Create order error:', error)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
```

- [ ] **Step 2: Manual verify — success path**

Place an order with quantities within stock. Confirm order creates and stock decrements in admin menu page.

- [ ] **Step 3: Manual verify — rejection path**

Temporarily set a menu item's stock to 2 in admin. Try ordering 3 of it. Confirm payment page shows `"Only 2 [item name] available"` and order is not created.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "atomically check and reserve stock on order creation"
```

---

### Task 4: Server — Fix stock restore on cancellation, remove completion decrement

**Files:**
- Modify: `src/app/api/orders/[id]/route.ts:158-187`

- [ ] **Step 1: Update stock logic**

Lines 158-187 currently read:
```ts
    const isCompleting = status === 'completed' && current?.status !== 'completed'
    const isCancellingAfterComplete = status === 'cancelled' && current?.status === 'completed'

    const order = await prisma.$transaction(async (tx) => {
      if (isGCashConfirm && current?.gcashAccountId) {
        await tx.gCashAccount.update({
          where: { id: current.gcashAccountId },
          data: { monthlyReceived: { increment: current.totalAmount } },
        })
      }

      // Deduct stock when order completes
      if (isCompleting && current?.items) {
        for (const item of current.items) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { stock: { decrement: item.quantity } },
          })
        }
      }

      // Restore stock if a completed order is somehow cancelled
      if (isCancellingAfterComplete && current?.items) {
        for (const item of current.items) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }
```
Replace with:
```ts
    const isCancelling = status === 'cancelled' && current?.status !== 'cancelled'

    const order = await prisma.$transaction(async (tx) => {
      if (isGCashConfirm && current?.gcashAccountId) {
        await tx.gCashAccount.update({
          where: { id: current.gcashAccountId },
          data: { monthlyReceived: { increment: current.totalAmount } },
        })
      }

      // Restore stock when order is cancelled at any stage
      if (isCancelling && current?.items) {
        for (const item of current.items) {
          await tx.menuItem.update({
            where: { id: item.menuItemId },
            data: { stock: { increment: item.quantity } },
          })
        }
      }
```

- [ ] **Step 2: Manual verify — cancellation restores stock**

Place an order, note stock count in admin. Cancel the order (any stage — awaiting_payment, preparing, etc). Confirm stock is restored to its pre-order value.

- [ ] **Step 3: Manual verify — completion does NOT double-decrement**

Place and complete an order. Confirm stock decremented exactly once (at creation), not twice.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/[id]/route.ts
git commit -m "restore stock on any cancellation; remove double-decrement on completion"
```
