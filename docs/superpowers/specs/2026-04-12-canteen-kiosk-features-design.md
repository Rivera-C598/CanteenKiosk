# CanteenKiosk — Feature Batch Design Spec
**Date:** 2026-04-12  
**Scope:** 5 features + image fix for the CanteenKiosk Next.js PWA (SQLite + Prisma, runs locally, thermal printing via browser print API)

---

## 1. Per-Item Check in Kitchen Display + "Require All Items Checked" Setting

### What
Each order card in the kitchen display (`/kitchen`) gets a per-item checklist. Operators tap individual item rows to mark them as prepared. A new admin setting controls whether the main confirm button is gated on all items being checked.

### Behavior
- Each item row in a card shows a tap target on the left (circle → checkmark icon on checked state) with strikethrough text when checked.
- Checked state is **local React state only** — ephemeral, resets on page refresh. No DB changes needed. Kitchen display polls every 3s anyway, so this is acceptable.
- The confirm button ("Confirm Cash", "Confirm GCash", "Mark Ready") checks the setting:
  - `requireAllItemsChecked: true` → button is disabled with a tooltip/visual indicator until every item is checked
  - `requireAllItemsChecked: false` → button is always enabled; checklist is a visual aid only

### Settings Change
`settings.json` gains one new field:
```json
"requireAllItemsChecked": false
```
The admin Settings page (`/admin/settings`) gets a new **"Operator Behavior"** section with a toggle labelled **"Require All Items Checked"** and a description: *"When enabled, canteen staff must check off every item in an order before they can confirm it."*

The kitchen page fetches settings on load (one `GET /api/settings` call) and re-reads it on each poll cycle to stay in sync with admin changes without a refresh.

---

## 2. Cancel & Edit Order in Kitchen + Audit Log

### What
Two new action buttons on each kitchen order card:
- **Cancel** — marks the order cancelled after confirmation
- **Edit** — opens a full-edit drawer to adjust items/quantities, then saves and auto-prints a revised slip

### Button Visibility Rules
- **Cancel** and **Edit** buttons are shown on all **active** statuses: `pending_verification`, `awaiting_payment`, `preparing`, `ready`.
- Neither button is shown on `completed` or `cancelled` orders (those cards are not rendered in the kitchen display anyway).

### Cancel Flow
1. Operator taps "Cancel" (red/error-colored button, icon: `cancel`).
2. A confirmation dialog appears: *"Cancel order [A-001]? This cannot be undone."*
3. On confirm: `PATCH /api/orders/[id]` with `{ status: 'cancelled' }` + writes an `OrderLog` entry.
4. Card animates out (same fade-scale as complete).

### Edit Flow
1. Operator taps "Edit" (secondary-colored button, icon: `edit`).
2. A drawer slides in showing:
   - Current items: each has a quantity stepper (– / qty / +) and a remove button.
   - An "Add Item" section: category tabs → item grid (same items as kiosk menu, available & in-stock only).
   - Total recalculates live as items change.
3. Operator taps **Save Changes**:
   - Captures a "before" snapshot of current order items + total.
   - `PATCH /api/orders/[id]` with `{ items: [...], totalAmount }` — the API deletes existing `OrderItem` rows and recreates them in a transaction.
   - Writes an `OrderLog` entry with `action: 'edited'`, `snapshot: { before, after }`.
   - Auto-triggers print slip for the revised order (same mechanism as Feature 5).
4. Drawer closes, card refreshes.

### Schema Addition
```prisma
model OrderLog {
  id          Int      @id @default(autoincrement())
  orderId     Int
  order       Order    @relation(fields: [orderId], references: [id])
  action      String   // 'edited' | 'cancelled'
  snapshot    String   // JSON string: { before, after } for edits; { items, total } for cancels
  createdAt   DateTime @default(now())
}
```
`Order` model gains `logs OrderLog[]`.

### API Changes
- `PATCH /api/orders/[id]` extended to accept `{ items, totalAmount }` for edit (in addition to existing `status`/`paymentStatus`). Item replacement done in a Prisma `$transaction`.
- New `GET /api/orders/logs?orderId=X` for admin log viewing.

### Admin Side — Audit Log
The admin **Orders** page (`/admin/orders`) gets a "View Logs" button per order that opens a drawer/modal showing the `OrderLog` entries for that order: action, timestamp, items before/after.

---

## 3. Best Sellers — Welcome Screen Widget + Menu Category

### What
Two surfaces:
1. **Welcome Screen** — a collapsible pulsing widget showing a carousel of top-5 best-selling items (rolling 7 days). Tapping an item navigates to the menu with that item pre-selected.
2. **Menu Page** — a virtual "Best Sellers" category tab injected at the front of the category list. Only shown if ≥ 1 qualifying item exists.

### Best Sellers API
New endpoint: `GET /api/orders/best-sellers?days=7`  
Queries `OrderItem` joined to `Order` (only `completed` + `preparing` + `ready` statuses count — exclude cancelled) within the rolling window, groups by `menuItemId`, sums `quantity`, returns top 5 with full `MenuItem` data (id, name, price, image, available, stock).  
Only includes items that are currently `available = true` and `stock > 0`.

### Welcome Screen Widget
- A small animated pill anchored at the **bottom-center** of the welcome screen, between the language row and help button.
- Label: "Best Sellers Right Now" with a `star` icon.
- Animation: subtle CSS pulse (opacity + scale loop, ~2s cycle) to draw attention without being distracting.
- On tap: expands into an overlay carousel of up to 5 item cards (image, name, price). Backdrop/outside tap collapses it.
- Item card tap: stores the selected item ID in `sessionStorage` (key: `kiosk_preselect_item`), then `router.push('/menu')`.
- Menu page reads `sessionStorage` on mount: if present, auto-scrolls to the item and briefly highlights it (ring/glow for ~1.5s), then clears the key.
- If the API returns 0 items (e.g. first day of operation), the widget is not rendered.

### Menu Page — Best Sellers Category
- On `GET /api/categories`, the best-sellers virtual category is **not** returned from the server — it stays server-side-free.
- The menu page makes a parallel call to `GET /api/orders/best-sellers?days=7`.
- If results exist, a virtual category object `{ id: -1, name: 'Best Sellers', icon: 'star', items: [...] }` is prepended to the categories array.
- Selecting this tab shows the best-seller items in the normal item grid (same add-to-cart behavior).
- If 0 results, category is not shown. No empty tab.

---

## 4. Image Upload — Size Limit + Crash Fix

### Root Cause
The upload API (`/api/upload/route.ts`) has no file size check. Next.js App Router has a default body parse limit. Large images may be rejected mid-request or cause slow uploads that time out. The crash during order processing is likely unrelated to the upload itself — the cart stores only a URL path string, not binary data. Root cause investigation will audit the cart-to-order flow explicitly.

### Fixes
**Server (`/api/upload/route.ts`):**
- After reading `file.arrayBuffer()`, check `buffer.length > 5 * 1024 * 1024` and return `400` with `{ error: 'File too large. Max 5 MB.' }`.
- Add `export const config = { api: { bodyParser: false } }` is not needed in App Router — but add `export const maxDuration = 30` for safety on slow writes.

**Client (admin menu page):**
- Before calling `fetch('/api/upload', ...)`, check `file.size > 5 * 1024 * 1024` and show an inline error: *"Image too large. Max 5 MB."* — no upload attempt made.

**Next.js body limit:** The `serverActions.bodySizeLimit` config only applies to Server Actions, not App Router route handlers. No `next.config.mjs` change needed — `request.formData()` in App Router route handlers reads directly from the Node.js HTTP stream without a Next.js-imposed limit. The 5 MB guard on the server (buffer length check) is sufficient.

**Cart-to-order audit:** Read `cart-context.tsx` and `orders/route.ts` to confirm image data is not being serialized into the order POST body. If the `image` field is in the cart item and getting sent to the server, strip it from the POST payload.

---

## 5. Print Order Slip — Kitchen Display

### What
A print button on each kitchen order card. Tapping it generates a thermal-style slip for that order and calls `window.print()`. Works silently with Chrome's `--kiosk-printing` flag. Also auto-fires after a successful Edit save (Feature 2).

### Print Mechanism
- A hidden `<div id="print-slot">` is always rendered in the kitchen page DOM, outside the main grid.
- On print: populate `#print-slot` with the slip HTML for the target order, then call `window.print()`, then clear `#print-slot`.
- CSS `@media print { body > * { display: none } #print-slot { display: block } }` ensures only the slip prints.

### Slip Layout (thermal-friendly, ~58mm or 80mm wide)
```
================================
        HyperBite
================================
ORDER:  A-001
Time:   10:34 AM  Apr 12 2026
Payment: Cash
--------------------------------
  2x  Adobo Rice
  1x  Pork Sisig
  1x  Bottled Water
================================
TOTAL:  ₱ 145.00
================================
[REVISED] ← shown only on edits
================================
```
- Monospace font, large order number, no images (thermal printers don't do well with images).
- `[REVISED]` label appended on edit auto-print.

### Button placement
- Small button at the bottom of the card's action area, below the main confirm button.
- Icon: `print`, label: "Print Slip". Neutral/muted style so it doesn't compete with the primary action.

### Kitchen deployment note
Use: `"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing http://localhost:3000/kitchen`  
This enables silent printing — `window.print()` fires without any dialog.

---

## 6. Known Issues & Suggestions (non-blocking)

| Issue | Severity | Recommendation |
|---|---|---|
| Order number race condition — two simultaneous orders could get the same number | Low (single terminal) | Acceptable for now; add a DB unique constraint on `orderNumber` (already exists) as safety net |
| Orphaned image files — replacing an item image leaves the old file on disk | Low | Acceptable for now; add a cleanup utility later |
| No image served for items with empty `image` field — UI should show a placeholder | Low | Add a fallback placeholder in menu + kitchen item display |
| `cancelled` status not shown anywhere in kitchen — good, cards just vanish | OK | Ensure queue display (`/queue`) also filters cancelled out |
| Settings not re-read by kitchen on each poll — operators changing strict mode mid-shift won't apply until refresh | Fix in Feature 1 | Poll settings every ~30s alongside orders |

---

## Implementation Order (suggested)

1. **Feature 4** — Image fix first (unblocks clean testing of everything else)
2. **Feature 1** — Per-item check + settings toggle (schema-free, fast)
3. **Feature 5** — Print slip (standalone, no dependencies)
4. **Feature 2** — Cancel/Edit + OrderLog (schema change, most complex)
5. **Feature 3** — Best sellers widget + menu category (depends on order data being populated)
