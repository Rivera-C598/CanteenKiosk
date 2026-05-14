# Stock Enforcement Design

**Date:** 2026-05-14  
**Status:** Approved

## Problem

Users can order more items than available stock. The `+` button on the kiosk menu only disables at `stock === 0`, not at `stock < cartQuantity`. Order creation does not validate stock at all. Stock only decrements on order completion, so concurrent orders can over-reserve the same items.

## Goal

- Kiosk UI prevents adding more items to cart than available stock
- Order creation atomically checks and reserves stock — concurrent orders cannot oversell
- Cancellation at any stage restores reserved stock

## Out of Scope

- Cart page re-validation
- Stock badge / "only N left" UI label
- Admin stock replenishment flow changes

---

## Design

### 1. UI — Menu Page

**File:** `src/app/(kiosk)/menu/page.tsx`

Destructure `items` from `useCart` (already imports `addItem` from the same hook).

In `handleAdd`:
```ts
const cartQty = items.find(i => i.id === item.id)?.quantity ?? 0
if (cartQty >= item.stock) return
addItem(...)
```

On the `+` button `disabled` prop, add:
```ts
|| (items.find(i => i.id === item.id)?.quantity ?? 0) >= item.stock
```

No new UI elements. Button silently disables when cart quantity reaches stock limit.

---

### 2. Server — Order Creation

**File:** `src/app/api/orders/route.ts`

Replace non-transactional `prisma.order.create` with `prisma.$transaction`. Inside the transaction, before creating the order, for each item:

1. Read current stock
2. If `stock < requestedQuantity` → throw a structured error with item name and available count
3. Decrement stock

Error format thrown: `STOCK_INSUFFICIENT:<itemName>:<availableStock>`

Catch block: if error message starts with `STOCK_INSUFFICIENT`, return `409` with human-readable message (e.g. `"Only 3 hotdogs available"`). All other errors return `500`.

SQLite serializes writes, so the check + decrement inside a single transaction is race-condition safe.

**File:** `src/app/(kiosk)/payment/page.tsx`

Line 34 currently throws generically on `!res.ok`. Change to read `data.error` from the response body and set it in the existing `error` state — no new UI needed, error message already renders.

---

### 3. Server — Cancellation Stock Restore

**File:** `src/app/api/orders/[id]/route.ts`

Current behavior:
- `isCompleting` → decrements stock (remove this — stock now reserved at creation)
- `isCancellingAfterComplete` → restores stock (too narrow)

New behavior:
- Remove `isCompleting` stock decrement block entirely
- Replace `isCancellingAfterComplete` with `isCancelling`:
  ```ts
  const isCancelling = status === 'cancelled' && current?.status !== 'cancelled'
  ```
- Restore stock on `isCancelling` for all order items

---

## Data Flow Summary

| Stage | Stock change |
|-------|-------------|
| Add to cart (UI) | None — button disabled if `cartQty >= stock` |
| Order creation (POST /api/orders) | **Decrement** (atomic, inside transaction) |
| Order → preparing / ready | None |
| Order → completed | None (already decremented) |
| Order cancelled (any stage) | **Restore** |
| Admin edits stock directly | Direct update via PATCH (unchanged) |
