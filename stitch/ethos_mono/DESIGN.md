```markdown
# Design System: The Quiet Intelligence

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Curator"**

This design system is not a utility; it is a sanctuary. In a world of loud, cluttered task managers, we move toward "The Digital Curator"—a philosophy that treats every task like a gallery piece and every screen like a curated editorial layout. We break the "template" look by eschewing rigid boxes and 1px borders in favor of **Tonal Architecture**. 

The goal is to create an experience that feels intelligent and calm. We achieve this through intentional asymmetry (e.g., larger left-hand margins for headlines), overlapping glass layers, and a typography scale that prioritizes "breathing room" over information density. The interface should feel like it was designed for a high-end physical planner made of fine paper and frosted glass.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a sophisticated, neutral foundation, using tonal shifts to imply structure rather than hard lines.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts.
- Use `surface-container-low` for a section sitting on a `surface` background.
- Use `surface-container-highest` for momentary focus states.
- Separation is achieved through white space (refer to the Spacing Scale) and value shifts.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the `surface-container` tiers to create "nested" depth:
1.  **Base Layer:** `surface` (#faf9fc) – The canvas.
2.  **Section Layer:** `surface-container-low` (#f4f3f8) – For grouping related tasks.
3.  **Floating Element:** `surface-container-lowest` (#ffffff) – Used for individual task cards to create a "lifted" feel against the slightly darker base.

### The "Glass & Gradient" Rule
To elevate the experience beyond "standard" flat design, floating action elements (like a "New Task" button or a navigation bar) should utilize **Glassmorphism**.
- **Style:** `surface` at 70% opacity with a `backdrop-filter: blur(20px)`.
- **Signature Texture:** For primary CTAs, use a subtle linear gradient from `primary` (#5d5e61) to `primary-container` (#e2e2e5) at a 135-degree angle. This adds "soul" and a tactile, metallic sheen.

---

## 3. Typography
We use a dual-typeface system to balance editorial authority with functional clarity.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision and modern "tech-editorial" feel. 
    *   *Role:* Large, airy headers that establish the mood. Use `display-sm` for "Today's Focus" to create a sense of importance.
*   **Body & Labels (Inter):** Chosen for its unparalleled legibility at small sizes. 
    *   *Role:* Task descriptions, metadata, and timestamps. Use `body-md` for standard tasks and `label-sm` for tags.

**Visual Hierarchy:** Establish a "High-Contrast" scale. If a headline is `headline-lg`, the supporting text should jump down to `body-md`. This gap creates the "luxury" feel of an art book.

---

## 4. Elevation & Depth
In this system, depth is felt, not seen.

*   **The Layering Principle:** Place a `surface-container-lowest` card on top of a `surface-container-low` background. The subtle 2% difference in hex value provides enough contrast for the human eye to perceive a "step" without needing a shadow.
*   **Ambient Shadows:** For elevated modals, use a "Cloud Shadow":
    *   `box-shadow: 0 24px 48px -12px rgba(47, 50, 58, 0.06);`
    *   The shadow color is derived from `on-surface` (#2f323a) at a very low opacity to ensure it feels like natural light.
*   **The "Ghost Border" Fallback:** If accessibility requirements demand a container edge, use a "Ghost Border": `outline-variant` (#afb1bc) at 15% opacity. Never use 100% opaque borders.

---

## 5. Components

### Cards & Task Lists
*   **The Standard:** No dividers. Use `2.5 (0.85rem)` or `3 (1rem)` spacing to separate tasks.
*   **States:** A "Completed" task should transition to 40% opacity rather than getting a strike-through, maintaining the visual "calm."

### Buttons
*   **Primary:** A gradient of `primary` to `primary_dim` with `xl` (0.75rem) roundedness.
*   **Secondary:** Ghost style using `surface-container-high` background. No border.
*   **Tertiary:** Text only, using `primary` color in `label-md` uppercase for a sophisticated "navigational" feel.

### Priority Accents (The "Subtle Signal")
Use our tertiary and semantic tokens for priority, but keep them desaturated to maintain the "calm" aesthetic:
*   **Urgent:** `tertiary_container` (#fb4b41) with `on_tertiary_container` text.
*   **Consulting:** `secondary_container` (#dfe2eb) with `on_secondary_container` text.
*   **Personal:** `primary_fixed` (#e2e2e5) with `on_primary_fixed` text.

### Interactive Inputs
*   **Text Fields:** Use `surface-container-low` as the fill. Upon focus, transition the background to `surface-container-lowest` and add a "Ghost Border." The label should use `label-sm` and sit exactly `0.5 (0.175rem)` above the input area.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins. For example, give a list a 10% larger margin on the left than the right to mimic a high-end magazine layout.
*   **Do** use "soft transitions." All hover/active states should have a minimum `300ms cubic-bezier(0.4, 0, 0.2, 1)` transition.
*   **Do** embrace whitespace. If you think there is enough space, add 20% more.

### Don't
*   **Don't** use pure black (#000000) for text. Use `on_surface` (#2f323a) to keep the contrast "gentle" on the eyes.
*   **Don't** use "Card-in-Card" layouts with borders. Use tonal shifts (e.g., `surface-container-high` inside `surface-container-low`).
*   **Don't** use standard Material Design icons at full weight. Use "Light" or "Thin" stroke weights (1px or 1.5px) to match the Inter/Manrope aesthetic.

---

## 7. Signature Interaction: The "Ethereal Swipe"
When a task is swiped for completion or deletion, don't just slide the card. Fade the `surface-container` color into the `background` color (`#faf9fc`) while the text slightly "blurs" out. This reinforces the "Intelligent and Calm" North Star, making the act of clearing tasks feel like a moment of Zen.