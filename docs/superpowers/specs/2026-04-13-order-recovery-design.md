# Order Recovery & Accountability Design

**Goal:** Protect against accidental kitchen cancellations by adding cancel reasons, a kiosk order status lookup, admin-only hard delete, and GCash refund tracking.

**Architecture:** Minimal schema additions (two fields on `Order`), one new API route, one new kiosk page, and UI changes across kitchen and admin panels. No new tables or services.

**Tech Stack:** Next.js 14 App Router, Prisma + SQLite, iron-session for role checks, Tailwind CSS

---

## Schema Changes

Two new fields on the `Order` model in `prisma/schema.prisma`:

```prisma
cancelReason  String  @default("")
refundStatus  String  @default("")
```

`cancelReason` values: `"customer_request"`, `"out_of_stock"`, `"duplicate"`, or `""` (not cancelled).

`refundStatus` values: `""` (not applicable), `"pending"`, `"completed"`.

No new models or tables.

---

## Feature 3: Cancel Reason Prompt (Kitchen Page)

### Trigger
Kitchen operator clicks "Cancel" on an active order card.

### Current behavior
A confirmation dialog with "Keep Order" / "Yes, Cancel" appears. Clicking confirm calls `PATCH /api/orders/:id` with `{ status: 'cancelled' }`.

### New behavior
Replace the confirmation dialog body with four reason buttons:

| Button | Style | Action |
|---|---|---|
| Customer Request | Destructive (red) | Cancel with `cancelReason: "customer_request"` |
| Out of Stock | Destructive (red) | Cancel with `cancelReason: "out_of_stock"` |
| Duplicate Order | Destructive (red) | Cancel with `cancelReason: "duplicate"` |
| Oops, go back | Secondary (grey) | Close modal, do nothing |

Selecting a destructive reason calls `PATCH /api/orders/:id` with `{ status: 'cancelled', cancelReason: '<reason>' }`. The cancel animation and state cleanup remain identical.

### API change
`PATCH /api/orders/:id` cancel branch: accept optional `cancelReason` from request body, include it in the `order.update()` data. Also set `refundStatus: "pending"` if `paymentMethod === 'gcash'` AND `paymentStatus === 'paid'` on the current order at time of cancellation (feature 6 logic lives here).

---

## Feature 4: Order Status Lookup (Kiosk)

### Welcome screen addition
A small secondary "Check Order Status" button added to the bottom of the welcome screen (`/`), below the main "Start Order" CTA. Tapping navigates to `/status`.

### New page: `/status`

Route: `src/app/(kiosk)/status/page.tsx`

**UI layout:**
- Header with back arrow → home
- Large title: "Order Status"
- Order number input field (text, uppercase, placeholder "e.g. A-001")
- "Look Up" button
- Result card (shown after lookup):
  - Order number (large)
  - Status badge with label
  - Items list (name + quantity)
  - If `preparing`: estimated wait time (reuses same logic as confirmed page)
  - If `cancelled`: cancel reason label (human-readable)
  - If `cancelled` + `refundStatus === 'pending'`: note "GCash refund pending — please see the cashier"
- Error state if order number not found

### New API route: `GET /api/orders/status?order=A-001`

File: `src/app/api/orders/status/route.ts`

No auth required (public endpoint). Returns a safe subset:
```json
{
  "orderNumber": "A-001",
  "status": "preparing",
  "cancelReason": "",
  "refundStatus": "",
  "items": [{ "name": "Fried Rice", "quantity": 2 }],
  "createdAt": "2026-04-13T10:00:00Z"
}
```

Returns `404` if order number not found. Does not expose `paymentMethod`, `totalAmount`, `paymentStatus`, or any user/account data.

Cancel reason is returned as a human-readable label (not the raw key):
- `"customer_request"` → `"Cancelled by customer request"`
- `"out_of_stock"` → `"Item was out of stock"`
- `"duplicate"` → `"Duplicate order"`
- `""` → `""`

---

## Feature 5: Admin-Only Hard Delete

### Principle
Kitchen operators can only soft-cancel (already the case — cancel sets `status: 'cancelled'`). Permanent deletion is admin-only.

### Admin orders page change
Add a trash icon button to each order row for orders with `status === 'cancelled'` or `status === 'completed'`. Clicking shows an inline confirmation: "Permanently delete order A-001 and all its records? This cannot be undone." Two buttons: "Delete Forever" (red) / "Cancel".

Confirmed delete calls `DELETE /api/orders/:id`.

### New API route: `DELETE /api/orders/:id`

File: append to `src/app/api/orders/[id]/route.ts`.

Checks session role:
```ts
const session = await getIronSession<SessionData>(request, response, sessionOptions)
if (!session.isLoggedIn || session.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

Deletes in a transaction: `OrderLog`, `OrderItemAddon`, `OrderItem`, then `Order` (cascade order respects FK constraints in SQLite).

Returns `{ success: true }`.

---

## Feature 6: GCash Refund Flag

### When a refund is flagged
At cancellation time in `PATCH /api/orders/:id` (cancel branch):
- Fetch the current order's `paymentMethod` and `paymentStatus`
- If `paymentMethod === 'gcash'` AND `paymentStatus === 'paid'`: set `refundStatus: 'pending'` in the same update
- All other cases: `refundStatus` remains `""`

### Admin visibility

**Pending refunds banner:** At the top of the admin orders page, if any orders have `refundStatus === 'pending'`, show a red banner: "X GCash refund(s) pending — students are waiting." Clicking scrolls to or filters to those orders.

**Per-order badge:** Cancelled GCash orders with `refundStatus: 'pending'` show a red "Refund Pending" chip next to the order number. A "Mark Refunded" button appears in the order row. Clicking calls `PATCH /api/orders/:id` with `{ refundStatus: 'completed' }`.

**Completed refunds:** Show a muted "Refunded" chip. No further action needed.

### API change
`PATCH /api/orders/:id` standard branch: allow `refundStatus` in the body (already passes through via the general update path). Validate that value is one of `""`, `"pending"`, `"completed"`.

---

## Files Touched

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `cancelReason`, `refundStatus` to `Order` |
| `src/app/api/orders/[id]/route.ts` | Cancel branch: accept `cancelReason`, set `refundStatus`; add `DELETE` handler |
| `src/app/api/orders/status/route.ts` | New — public order status lookup |
| `src/app/(kiosk)/status/page.tsx` | New — order status lookup kiosk screen |
| `src/app/(kiosk)/page.tsx` | Add "Check Order Status" button |
| `src/app/kitchen/page.tsx` | Replace cancel dialog with reason-picker |
| `src/app/admin/orders/page.tsx` | Add delete button, refund banner, refund badge + action |
