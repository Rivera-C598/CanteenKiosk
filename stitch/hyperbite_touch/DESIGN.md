# Design System Strategy: The Culinary Stage

## 1. Overview & Creative North Star

This design system is built on the Creative North Star of **"The Culinary Stage."** In a fast-food kiosk environment, the UI should never compete with the food; it should serve as a pristine, high-energy stage that spotlights photography. Moving away from the "industrial utility" of traditional kiosks, this system uses **Dynamic Asymmetry** and **Tonal Depth** to create a premium, editorial feel. 

We break the "template" look by overlapping high-fidelity food assets across container boundaries, creating a sense of physical abundance. This isn't just a menu; it’s a tactile, immersive invitation to eat.

---

## 2. Colors: Vibrancy without Friction

Our palette leverages high-energy reds and yellows, balanced by a sophisticated "Off-White" foundation to prevent ocular fatigue on large touchscreens.

### The Color Logic
- **Primary (`#b90905`)**: The "Pulse." Used for the most critical actions (e.g., "Add to Bag"). 
- **Secondary (`#745700`) & Secondary Container (`#ffca42`)**: The "Accent." Used for secondary promotions and category highlights to create warmth.
- **Surface (`#fff4f4`)**: A tinted off-white that feels more organic and "appetizing" than a clinical hex white.

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries must be defined solely through background color shifts. To separate a navigation rail from a product grid, place a `surface-container-low` section against the `background`. This creates a soft, modern transition that feels like high-end furniture rather than a spreadsheet.

### The "Glass & Gradient" Rule
To elevate the experience, use **Glassmorphism** for floating cart summaries or "View Order" bars. Apply `surface-container-highest` at 80% opacity with a `24px` backdrop blur. 
- **Signature Texture:** Primary buttons should use a subtle linear gradient from `primary` to `primary-container` at a 45-degree angle. This adds a "weighted" feel that makes the button look pressable on a physical screen.

---

## 3. Typography: Editorial Authority

We use a dual-font strategy to balance character with extreme legibility.

- **Display & Headlines (Plus Jakarta Sans):** A bold, geometric sans-serif that screams "Modern." Use `display-lg` for hero promotions. The generous x-height ensures readability from 3 feet away.
- **Body & Titles (Be Vietnam Pro):** A slightly more functional sans-serif designed for high-density information. It handles complex customization options (e.g., "No onions, extra pickles") with clarity.

**Hierarchy Note:** Always lead with size. A `display-md` price point next to a `body-lg` description creates the "Editorial Contrast" necessary to guide a hungry user's eye instantly to what matters.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are forbidden. We define hierarchy through the **Layering Principle**.

### Layering Levels
- **Base:** `surface` (The kiosk background).
- **Secondary Areas:** `surface-container-low` (Category sidebars).
- **Interactive Cards:** `surface-container-lowest` (The brightest white) to make food items "pop" off the screen.

### Ambient Shadows & Ghost Borders
- **Ambient Shadows:** For "floating" elements like a checkout modal, use an extra-diffused shadow: `offset-y: 20px, blur: 40px, color: rgba(77, 33, 38, 0.08)`. This uses the `on-surface` red-tinted dark color instead of grey, maintaining color harmony.
- **The "Ghost Border":** If a button requires more definition on a complex background, use the `outline-variant` token at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components: Tactile & Inviting

All components utilize the **Roundedness Scale**, specifically `xl (3rem)` and `full`, to mimic the soft, friendly shapes of the brand identity.

### Buttons
- **Primary:** `xl` rounding, `primary` background, `on-primary` text. Sizing is oversized for "fat-finger" touchscreen accuracy.
- **Secondary:** `xl` rounding, `secondary-container` background. Used for "Customize" or "Add More."
- **Tertiary:** No background. Use `primary` text with an `xl` ghost-border (15% opacity) for "Cancel" or "Go Back."

### Cards & Lists
- **Food Cards:** Use `surface-container-lowest` with `xl` rounding. **Forbid divider lines.** Use vertical white space (32px or 48px) to separate items.
- **Hero Image Overhang:** Product imagery should exceed the card’s top boundary by `1rem` to create a 3D effect.

### Input Fields (Quantity/Search)
- Use `surface-container` as the background. Avoid a bottom-line-only style.
- Active states should transition to a `primary` ghost-border.

### Additional Kiosk Components
- **Progress Stepper:** A series of `full` rounded pills. The active step uses `primary`, while inactive steps use `surface-dim`.
- **Order Pulse:** A subtle glow using the `primary-container` token behind the "Order Ready" number.

---

## 6. Do's and Don'ts

### Do
- **DO** use high-contrast imagery where the background is removed, allowing the food to sit directly on the `surface` colors.
- **DO** use the `lg` and `xl` corner radii. Sharp corners feel clinical; rounded corners feel "delicious."
- **DO** maximize "Negative Space." On a large kiosk, empty space is a luxury that prevents user anxiety.

### Don't
- **DON'T** use black (`#000000`). Use `on-surface` (`#4d2126`) for text; it is a deep, warm burgundy that feels more premium.
- **DON'T** use 1px dividers. If you need to separate content, use a `12px` height block of `surface-container-low`.
- **DON'T** place small buttons in the corners. Keep primary navigation in the "Thumb Zone" (lower 2/3 of the screen).

---

## 7. Technical Tokens Reference

| Token | Value | Usage |
| :--- | :--- | :--- |
| **Background** | `#fff4f4` | Main kiosk backdrop |
| **Primary** | `#b90905` | "Add to Bag" / Essential CTAs |
| **Secondary Container** | `#ffca42` | Nutritional info / Promotions |
| **Surface Lowest** | `#ffffff` | Product card background |
| **Corner Radius XL** | `3rem` | Standard card and button rounding |
| **Typography Display** | `plusJakartaSans` | Headlines and Prices |