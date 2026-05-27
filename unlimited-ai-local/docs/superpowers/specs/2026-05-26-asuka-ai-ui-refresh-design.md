# Asuka AI UI Refresh Design

## Goal

Refresh the `Asuka AI` local chat UI so it feels more polished, coherent, and intentional without changing the core product structure. The chosen direction is `B: Velvet Control`:

- dark, refined, product-like
- expressive enough to preserve Asuka's personality
- cleaner hierarchy and calmer surfaces than the current build

The refresh should make the app feel like a finished chat product rather than a functional prototype with good colors.

## Current Problems

From reviewing the live app and the current frontend files, the UI issues are mostly about hierarchy and consistency rather than raw functionality:

1. The visual language is fragmented.
   Top bar, sidebar, message bubbles, composer, and modal surfaces do not feel like they belong to the same control system.

2. The information hierarchy is weak.
   Important areas such as the active chat, model controls, message stream, and composer do not establish a strong enough visual priority.

3. The interface feels slightly crowded in dense areas.
   The top bar and sidebar controls sit close together and rely on similar emphasis, which flattens the layout.

4. The empty/new-chat state feels unfinished.
   A new conversation opens onto a large quiet space with little framing or guidance.

5. Some controls rely on emoji or inconsistent icon treatment.
   This gives the interface a less professional feel and makes the product language wobble between playful and unfinished.

## Chosen Direction

We will implement `B: Velvet Control`.

This direction keeps the current dark rose/gold identity, but makes it more restrained and product-grade:

- more stable surface hierarchy
- tighter spacing rhythm
- cleaner control styling
- better separation between chrome and content
- softer but more intentional emphasis on the primary action areas

This is the best fit for the current app because it improves quality without turning the product into a generic enterprise tool or an over-styled character showcase.

## Scope

### In scope

- Refresh the sidebar layout and active chat styling
- Refresh the top bar layout and controls
- Refresh message row presentation and bubble hierarchy
- Refresh the composer and attachment presentation
- Refresh the password gate and settings modal
- Add a tasteful empty state for new chats
- Improve light/dark token consistency where necessary
- Replace the most visibly weak icon/label treatments with a more coherent system

### Out of scope

- Backend changes
- API contract changes
- Multi-page navigation changes
- New chat features beyond minimal empty-state polish
- Large-scale refactors of data storage or message rendering logic

## Files Expected To Change

- `public/index.html`
  Adjust structural markup where needed for stronger top-bar, sidebar, composer, and empty-state presentation.

- `public/styles.css`
  Primary implementation surface for the design refresh. This file will receive the token cleanup, component styling, layout rhythm updates, and responsive polish.

- `public/app.js`
  Minimal behavior changes to support the new empty state, refined labels/icons, and any small DOM additions required by the visual refresh.

## Design System Changes

### 1. Surface Hierarchy

We will define a clearer layered system:

- background plane: low-contrast ambient backdrop
- chrome surfaces: sidebar, top bar, composer shell
- content surfaces: bubbles, modal cards, list items
- emphasis surfaces: active chat, primary button, focus states

The current UI already uses blur and dark translucent panels; the refresh will keep that foundation but reduce the sense that every surface is emphasized equally.

### 2. Color Use

The existing rose accent and warm metal tone are good enough to keep.

What changes:

- accent will be used more selectively
- borders will be quieter by default
- neutral text and secondary surfaces will carry more of the layout
- user-message emphasis will be richer but less noisy

Result: better perceived sophistication without losing the app's identity.

### 3. Typography and Rhythm

We will tighten the hierarchy across:

- section labels
- sidebar titles
- active chat title
- message metadata
- stats text
- modal headings

The goal is not larger typography, but better weight, spacing, and contrast decisions so the interface scans faster.

### 4. Control Language

Controls should feel like one family.

This means aligning:

- radii
- padding
- hover/active behavior
- border contrast
- button sizing
- select/input shell styling

Icon-only buttons should feel deliberate and quiet, while the send action should remain the most obvious actionable control in the composition.

## Component-Level Design

### Sidebar

The sidebar should feel more like a navigation rail and less like a raw list container.

Changes:

- give the header clearer grouping
- make the active conversation feel anchored and confident
- soften inactive rows
- improve hover/reveal behavior for rename/delete affordances
- make footer stats feel quieter and more aligned with the rest of the chrome

The list remains dense enough for repeated use, but visually calmer.

### Top Bar

The top bar currently contains useful controls but lacks a clean composition.

Changes:

- strengthen the current chat title as the local anchor
- unify the model selector and utility controls into one cleaner system
- reduce the feeling of controls floating independently
- preserve horizontal scrolling behavior on smaller screens

The top bar should feel like a polished tool header, not a loose strip of widgets.

### Chat Messages

The message area should gain breathing room and clearer role separation.

Changes:

- improve avatar and message alignment
- refine bubble geometry and contrast
- make AI content feel readable and grounded
- make user messages feel intentional without shouting
- reduce visual weight of token stats while keeping them accessible

The goal is a more premium reading experience, especially over longer conversations.

### Composer

The composer is the primary action zone and should look like it.

Changes:

- strengthen its silhouette
- improve focus state
- integrate attachment chips more cleanly
- make the send button feel more premium and more obviously primary
- ensure the area still behaves well on mobile widths

### Empty State

A new chat should not look blank.

We will add a lightweight empty state inside the chat area that:

- welcomes the user into the current session
- reinforces the product identity
- suggests what to do next without turning into a marketing hero

This state should disappear naturally when the first message is sent.

### Password Gate

The password gate is already structurally simple, which is good.

We will refine:

- card proportion
- spacing
- field emphasis
- button polish
- backdrop feel

The result should match the rest of the app's upgraded quality level.

### Settings Modal

The modal should feel cleaner, more sectional, and less like a stack of generic boxes.

Changes:

- clearer modal header
- calmer section framing
- better distinction between descriptive copy and actions
- more consistent button hierarchy

## Interaction Changes

Behavior stays mostly the same.

Small additions or adjustments are acceptable if they directly support polish:

- empty state show/hide logic
- cleaner button labels or icon text
- improved aria/title labels where needed
- small state hooks for visual treatment

No major workflow changes are required.

## Responsive Behavior

The refreshed UI must still work well on narrow screens.

Requirements:

- no overlapping controls
- top-bar controls remain usable and readable
- sidebar drawer still behaves correctly on mobile
- composer remains the dominant action target
- empty state scales down without looking like a hero card

## Testing and Verification

We will verify the refresh through:

1. Manual in-browser review on the running local app
2. Desktop viewport check
3. Mobile/narrow viewport check
4. Password gate, top bar, sidebar, empty state, composer, and settings modal visual inspection
5. Basic regression check that sending messages, switching chats, and opening settings still work

## Implementation Notes

- Prefer scoped markup additions over broad structural rewrites
- Reuse the current architecture and state model
- Keep JS changes small and purpose-driven
- Put most of the effort into a disciplined CSS rewrite of the affected surfaces

## Success Criteria

The refresh is successful if:

- the app immediately looks more intentional and product-grade
- the sidebar, top bar, messages, composer, and modals feel like one design system
- the first screen of a new chat no longer feels unfinished
- usability is unchanged or improved on desktop and mobile
- no core chat workflow regresses
