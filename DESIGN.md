# DESIGN.md — Interio Design System

> **Status:** Draft V1.0 · 2026-10-22 · **awaiting approval**
> **Owner:** Design engineering
> **Applies to:** the Interio web application, the mobile survey shell, the public design viewer and the platform console.
>
> **How to use this file.** Any agent or developer doing UI work must load the `web-design-engineer` skill and read this file in full before planning or writing a single component. This file is the project's `brand-spec.md`: it supplies the resolved design context the skill asks for. When a decision is not written here, it is not a design decision yet — raise it, do not invent it.

---

## 0. Authority, scope and change control

### 0.1 Precedence

The four project documents answer different questions. They do not compete.

| Rank | Document | Answers | If it conflicts with DESIGN.md |
|---|---|---|---|
| 1 | `web-design-engineer/spec.md` | **What** the product does and **where** — pages, modules, states, gates, data rules | Spec wins. DESIGN.md is wrong. |
| 2 | `web-design-engineer/ui-ux.md` | **How** the interface behaves and feels — HIG principles, tokens, type, motion, accessibility | ui-ux wins. DESIGN.md is wrong. |
| 3 | `standards/architecture.md` | **How** it is built — SvelteKit 2, Svelte 5 runes, Tailwind 4, file layout | Architecture wins. DESIGN.md is wrong. |
| 4 | `DESIGN.md` | **Exact values** — token names, palettes, scales, component contracts, page patterns | This is the tie-breaker for visual values only. |

DESIGN.md never overrides security, tenancy, permissions, workflow gates, API contracts or data rules. It never invents product content, endpoints, states or permissions.

### 0.2 What this document is

- The single source of truth for visual and interaction values in this repository.
- The contract between design, frontend, and the API team on how state, money, dimensions and identity are presented.
- A build checklist: every shared module named by Part 11 §6 has a contract in §9.

### 0.3 What this document is not

- Not a component implementation. Code lives in `src/shared/presentation/ui` and feature `presentation/` folders.
- Not a replacement for Part 11. Page inventory, permissions and endpoints stay there.
- Not a marketing site or email template system.
- Not a place to resolve open product questions. Anything undecided stays in §16 until the spec answers it.

### 0.4 Change control

1. Token or component-contract changes bump the version at the top and add a row to §16.4.
2. A change that alters behaviour must be applied to spec, ui-ux or architecture **first**, then reflected here.
3. No UI pull request may add a colour, size, duration, shadow or radius that is not in this file.
4. Brand assets are added by replacing the entries in §2.3 — never by drawing a substitute.

---

## 1. Design read

### 1.1 One-paragraph brief

Interio is a tenant-scoped operations platform for a bespoke joinery business. It carries one job from survey to aftercare across ten operational roles, four shells and 57 tenant-scoped tables. The interface must feel **calm, precise and expensive** — the visual equivalent of a well-run workshop — while staying dense enough for people who use it all day. Brand is expressed through one accent, generous whitespace and exact typography, not through ornament. The server is authoritative; the UI must make gates, states and evidence obvious rather than decorative.

### 1.2 Design read block

```yaml
Design Read:
  artifact: multi-shell B2B operations platform
  audience: Owner, Sales, Designer, Surveyor, Purchasing, Production Manager,
            Workshop, Installer, Accounts, System Admin, platform operator
  visual-language: Apple-HIG structure + workshop-grade precision
                   (quiet surfaces, warm neutrals, one brass accent, exact alignment)
  mode: greenfield
  visual-variance: 3
  motion-intensity: 2
  information-density: 8
  asset-dependence: 4
  brand-fidelity: 6
```

### 1.3 What each dial changes

| Dial | Value | Concrete consequence |
|---|---|---|
| **Visual variance** | 3 / 10 | One shell language. No per-module colour themes, no decorative hero areas inside the app. Variety comes from content, not chrome. |
| **Motion intensity** | 2 / 10 | Motion explains origin and change only. 100–350 ms. No parallax, no looping decoration, no page-load choreography. |
| **Information density** | 8 / 10 | Table-first layouts, sticky headers, compact density mode for operational screens. Density never reduces a target below 44 × 44 px. |
| **Asset dependence** | 4 / 10 | The product must work without brand imagery. Tenant logos are real when supplied; otherwise the display name is set as text. No CSS-drawn fake logos. |
| **Brand fidelity** | 6 / 10 | Tenant accent and logo are respected, but never at the cost of contrast, hierarchy or a familiar pattern. |

### 1.4 Four positioning questions, per shell

| Shell | Narrative role | Viewing distance | Visual temperature | Capacity check |
|---|---|---|---|---|
| **Web app** | The workspace. Orientation and work. | 1 m desktop, 40 cm tablet | Calm, authoritative, quiet | High density; tables and boards must fit without scrolling the page horizontally |
| **Mobile survey** | A field instrument. Capture reality fast. | 10–30 cm, gloved hands, bright sites | Calm but robust | One task per screen; large targets; offline and sync states always visible |
| **Public viewer** | The brand moment for the customer. | 30 cm–1 m | Quiet, premium, confident | Single purpose: one design, full-bleed, minimal chrome |
| **Platform console** | An operator tool. Neutral and technical. | 1 m | Neutral, clinical | Medium density; never tenant-branded |

### 1.5 Non-negotiable outcomes

1. A new screen can be built from this file plus Part 11 without asking a visual question.
2. A blocked gate is understood in under five seconds.
3. Money, dimensions, states and identities are unambiguous and consistent across every module.
4. The interface remains usable at 320 px, at 200 % text zoom, with keyboard only, with a screen reader, with reduced motion and with reduced transparency.
5. No screen relies on colour alone to carry meaning.

---

## 2. Identity and brand

### 2.1 The chosen direction — **Joinery Ink**

Warm graphite ink, paper neutrals and a single brass accent. It reads as a joinery workshop and a premium interiors studio at the same time: quiet, crafted, expensive, and deliberately unlike the blue-gradient SaaS default.

- **Interio** is the platform product. Its default identity is defined here and used by the platform console, login, onboarding and any un-branded surface.
- **Tenant 1 is Opulent Interiors Group.** Their branding is loaded at runtime from `/auth/me` and overrides the accent, logo and display name only.
- The accent is a **material**, not a mood: it marks interaction and selection. It never fills large areas, never becomes a gradient, and never appears on more than one filled primary action per screen.

### 2.2 Brand surfaces

| Surface | Brand strength | Rules |
|---|---|---|
| Public design viewer `/s/:token` | Highest | Tenant logo + accent allowed; full-bleed 3D; no app chrome; read-only banner always present |
| Login `/login`, invite, onboarding | High | Tenant branding previews before entry; quiet composition; no marketing copy |
| Web app shell | Medium | Logo small in the sidebar/top bar; accent on interaction only |
| Mobile survey shell | Medium | Same tokens; logo only in Account and login; the field UI is the priority |
| Platform console | Interio only | Never tenant-branded; operator context must be unmistakable |
| Exports, labels, printed QR | Functional | Part labels follow the tenant label template from settings; no decorative brand |

### 2.3 Asset protocol

| Asset | Status | Rule |
|---|---|---|
| Interio logotype | **Pending** | Until supplied, set the word `Interio` in Headline weight with +0.01 em tracking. Never place it in a coloured rectangle. |
| Interio mark | **Pending** | Do not draw a substitute. A text wordmark is the honest fallback. |
| Opulent logo (light/dark) | **Pending** | Supply SVG or 2× PNG. Referenced via `<img src>`; never redrawn in CSS or SVG by hand. |
| Opulent accent | **Pending** | Defaults to brass `#8A5A2B`; must pass the accent guard in §3.8 before applying. |
| Product imagery | Not required | The product is the interface. No stock photography, no AI hero imagery. |
| 3D renders | Runtime data | Real design renders from `asset` rows. Missing render = labelled placeholder, never a fake image. |

If a required brand asset is still missing at build time, show the tenant display name as text and record it in §16.1. Do not improvise.

### 2.4 Tenant branding contract

Tenant branding may override **only** these values, applied as CSS custom properties on the document root after `/auth/me` resolves:

| Allowed override | Token | Constraint |
|---|---|---|
| Accent | `--color-accent` | Must pass §3.8; otherwise fall back to brass |
| Accent hover | `--color-accent-hover` | Derived in OKLCH; not supplied by tenant |
| Accent soft | `--color-accent-soft` | Derived; used for selected/soft fills |
| On-accent text | `--color-on-accent` | Chosen by contrast algorithm, not by tenant |
| Logo (light/dark) | `--brand-logo-light`, `--brand-logo-dark` | URL only; never inline SVG injected into the app |
| Display name | `--brand-display-name` | Text, max 60 characters |

Not overridable: typography, spacing, radii, shadows, semantic colours, motion, layout, iconography, component shape. Tenant branding must never be able to break accessibility.

The exact JSON shape of `tenant.branding` is owned by the backend specification. The frontend treats it as an envelope and validates before applying. **Do not implement a shape that Part 5/Part 10 does not define**; if the envelope is unspecified when implementation starts, raise it in §16.1.

---

## 3. Colour

### 3.1 Principles

1. **One accent.** Brass marks links, selection, focus and the single primary action. It appears nowhere else.
2. **Neutral by default.** Surfaces and text are warm neutrals. Content and state carry the colour.
3. **Semantic colour means something.** Green/amber/red/blue are reserved for state and feedback, never decoration.
4. **Never colour alone.** Every state also has a label, icon or shape.
5. **AA is the floor.** Body text ≥ 4.5:1; large text, icons, borders and focus indicators that carry meaning ≥ 3:1.
6. **Dark mode is designed, not inverted.** Surfaces lift with lighter warm grays; accent saturation drops slightly; shadows give way to surface separation.

### 3.2 Token layers

```text
Primitive ramp  →  Semantic role token  →  Component token
(raw values)       (--color-*)             (components consume roles only)
```

Components consume **semantic role tokens**. Raw hex values appear only in §3 and Appendix A. Tenant branding writes only the accent group.

### 3.3 Surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg-primary` | `#FBFAF8` | `#121210` | Page canvas, sheets, top bar base |
| `--color-bg-secondary` | `#F3F1ED` | `#1B1A17` | Grouped content, cards, table header, sidebar |
| `--color-bg-tertiary` | `#EAE7E1` | `#242220` | Nested content, inset panels, hovered rows |
| `--color-separator` | `#DCD8D0` | `#34312C` | Decorative hairlines only (1.36:1 / 1.45:1) |
| `--color-border-strong` | `#8F8A80` | `#6F6A62` | Meaningful borders, input outlines (3.29:1 / 3.50:1) |

Rules:
- Prefer a background shift plus a hairline over heavy borders.
- Never put a card on a card on a card. One nesting level maximum.
- Page canvas is `bg-primary`. Grouped regions are `bg-secondary`. Nested insets are `bg-tertiary`.
- In dark mode, elevation is expressed by moving **up** the surface ramp, not by adding a glow.

### 3.4 Text

| Token | Light | Dark | Contrast on `bg-primary` | Use |
|---|---|---|---|---|
| `--color-text-primary` | `#1C1B18` | `#F4F1EC` | 16.51:1 / 16.65:1 | Body, headings, table values |
| `--color-text-secondary` | `#55524B` | `#BDB7AD` | 7.47:1 / 9.41:1 | Supporting text, metadata, labels |
| `--color-text-tertiary` | `#6C675E` | `#938D83` | 5.38:1 / 5.70:1 | Hints, placeholders, timestamps |
| `--color-text-disabled` | `#A8A399` | `#6B665E` | 2.41:1 / 3.29:1 | Disabled only (exempt, still visible) |

Rules:
- Never use `text-tertiary` for body copy on `bg-tertiary` in light mode without re-checking (4.55:1 at best).
- Disabled text is the only text allowed below 4.5:1, and only when the control is genuinely disabled.
- Do not dim text to create hierarchy when size or weight can do the job.

### 3.5 Accent and interaction

| Token | Light | Dark | Contrast | Use |
|---|---|---|---|---|
| `--color-accent` | `#8A5A2B` | `#D8A96F` | 5.63:1 / 8.77:1 on canvas | Links, selection, focus, primary fill |
| `--color-accent-hover` | `#744A22` | `#E5BD8B` | White on light = 7.65:1; dark ink on dark = 9.83:1 | Hover / pressed accent |
| `--color-accent-soft` | `#F2E7D8` | `#2A2117` | Text on soft = 6.94:1 / 9.02:1 | Selected rows, active nav, soft badges |
| `--color-on-accent` | `#FFFFFF` | `#1C1B18` | 5.87:1 / 8.06:1 | Text and icons on a filled accent |

Rules:
- **Exactly one filled primary action per screen.** Secondary actions are tinted or outlined; tertiary actions are plain text.
- Links use accent + underline on hover. In body copy, links are always underlined (not colour alone).
- Selection uses `accent-soft` background plus a 2 px accent leading bar or check, never background alone.
- Focus uses a 2 px `--color-focus` ring with a 2 px offset in the canvas colour. Never remove the outline.

### 3.6 Semantic feedback

| Token | Light | Dark | Contrast on canvas | Meaning |
|---|---|---|---|---|
| `--color-success` | `#2E6B43` | `#8FD3A8` | 6.10:1 / 10.76:1 | Verified, approved, paid, complete |
| `--color-warning` | `#8A5A00` | `#F0C674` | 5.68:1 / 11.64:1 | Awaiting action, on hold, due, expiring |
| `--color-danger` | `#B3261E` | `#F2B8B5` | 6.27:1 / 10.98:1 | Blocked, rejected, failed, destructive |
| `--color-info` | `#1F5FBF` | `#9CC3F5` | 5.84:1 / 10.30:1 | In progress, issued, informational |

Soft surfaces for chips and banners:

| Group | Soft (light) | Text (light) | Soft (dark) | Text (dark) |
|---|---|---|---|---|
| Neutral | `#EFEDE8` | `#55524B` (6.66:1) | `#262420` | `#C9C3B9` (8.84:1) |
| Muted | `#EAE7E1` | `#6C675E` (4.55:1) | `#242220` | `#938D83` (4.81:1) |
| Success | `#E6F2EA` | `#1F5A36` (7.09:1) | `#17281D` | `#8FD3A8` (8.88:1) |
| Warning | `#FBF0D9` | `#6B4600` (7.42:1) | `#2A2113` | `#F0C674` (9.83:1) |
| Danger | `#FBE9E7` | `#8C1D18` (7.77:1) | `#2C1A19` | `#F2B8B5` (9.69:1) |
| Info | `#E8F0FB` | `#1A4C99` (7.21:1) | `#16243A` | `#9CC3F5` (8.56:1) |

### 3.7 Workflow state palette

The `StateChip` uses six visual categories. The full mapping from every Part 4 state is in **Appendix B**; this table defines the categories.

| Category | Dot | Soft surface | Meaning | Examples |
|---|---|---|---|---|
| `neutral` | `text-tertiary` | neutral | Not started, or a normal resting state | `draft`, `created`, `pending`, `pending_validation` |
| `info` | `info` | info | Work is moving | `in_progress`, `issued`, `engineering`, `cutting`, `assigned` |
| `warning` | `warning` | warning | Waiting on a person, a date or an approval | `submitted`, `on_hold`, `quality_control`, `snagging`, `pending` payment |
| `success` | `success` | success | Passed, verified, approved, paid, complete | `verified`, `approved`, `paid`, `complete`, `closed` |
| `danger` | `danger` | danger | Blocked, rejected, failed, scrapped, held | `rejected`, `held`, `failed`, `open` snag, `scrapped` |
| `muted` | `text-disabled` | muted | Historical, superseded, cancelled, archived | `superseded`, `withdrawn`, `archived`, `cancelled` |

Chip anatomy: 6 px dot + Caption label (12 px / 500), height 24 px, radius full, padding-inline 8 px. The label is always present. A chip is not interactive; if a filter uses chips, the target becomes a 44 px pill button around the same visual.

### 3.8 Tenant accent guard

When a tenant accent arrives:

1. Parse it in OKLCH; clamp lightness so it can reach 4.5:1 against the canvas.
2. Derive `accent-hover` by lowering lightness 8 % (light mode) or raising it 8 % (dark mode).
3. Derive `accent-soft` at L 94 % / C 30 % (light) or L 18 % / C 40 % (dark), hue preserved.
4. Choose `on-accent`: white if contrast(white, accent) ≥ 4.5, otherwise `text-primary`.
5. If any step fails, keep the Interio brass values and log a non-blocking console warning. **Never ship an unreadable accent.**

### 3.9 Charts and data colour

Charts are functional, not decorative. Use a fixed categorical order; never generate hues.

| Order | Light | Dark | Use |
|---|---|---|---|
| 1 | `#1C1B18` | `#F4F1EC` | Primary series / total |
| 2 | `#8A5A2B` | `#D8A96F` | Second series / quoted |
| 3 | `#1F5FBF` | `#9CC3F5` | Third series / in progress |
| 4 | `#2E6B43` | `#8FD3A8` | Fourth series / complete |
| 5 | `#8A5A00` | `#F0C674` | Fifth series / variance |
| 6 | `#A24E2E` | `#E8A184` | Sixth series / actual |
| 7 | `#6B4A75` | `#C3A6CB` | Seventh series |

Rules: max 7 series; 2 px lines; no 3D; no gradients; gridlines only at `separator`; label axes in `text-secondary`; direct labels when ≤ 4 series; pattern or dash as a second channel for critical distinctions.

---

## 4. Typography

### 4.1 Families

| Token | Value | Use |
|---|---|---|
| `--font-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif` | Everything |
| `--font-mono` | `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace` | UUIDs, part codes, expression/JSON rule editors |

The system stack is mandated by `ui-ux.md`. This is the documented exception to the "avoid system-ui as display" rule: the project spec explicitly requires it, no webfont is downloaded, and Apple's SF fonts are never embedded. Do not add Google Fonts, Inter, a display serif, or a second sans.

### 4.2 Type scale

Only these styles exist. Sizes are `rem`; body is 17 px; nothing readable is below 12 px; mobile body is never below 16 px.

| Style | Token | Size | Line height | Weight | Tracking | Use |
|---|---|---|---|---|---|---|
| Display | `--text-display` | 2.75 rem / 44 px | 1.1 | 700 | −0.02 em | Public viewer hero only |
| Large Title | `--text-large-title` | 2.125 rem / 34 px | 1.15 | 700 | −0.02 em | Page title |
| Title 1 | `--text-title-1` | 1.75 rem / 28 px | 1.2 | 600 | −0.015 em | Major section |
| Title 2 | `--text-title-2` | 1.375 rem / 22 px | 1.25 | 600 | −0.01 em | Card group |
| Title 3 | `--text-title-3` | 1.1875 rem / 19 px | 1.3 | 600 | −0.005 em | Card / panel title |
| Headline | `--text-headline` | 1.0625 rem / 17 px | 1.35 | 600 | 0 | Table header, emphasised value |
| Body | `--text-body` | 1.0625 rem / 17 px | 1.5 | 400 | 0 | Default text |
| Callout | `--text-callout` | 1 rem / 16 px | 1.45 | 400 | 0 | Mobile body minimum, dense forms |
| Subheadline | `--text-subheadline` | 0.9375 rem / 15 px | 1.4 | 500 | 0 | Metadata, secondary values |
| Footnote | `--text-footnote` | 0.8125 rem / 13 px | 1.4 | 400 | 0 | Table secondary cells, helper text |
| Caption | `--text-caption` | 0.75 rem / 12 px | 1.35 | 500 | 0.01 em | Chips, labels, overlines |

Rules:
- Maximum three weights per screen (400 / 500 / 600; 700 only for Display and Large Title).
- Heading hierarchy: one `h1` per page, no skipped levels.
- Use size and weight for hierarchy before colour.
- Large titles collapse to a compact title on scroll in the web shell; do not animate the size, swap the style at a threshold.
- Italic is reserved for quoted customer text and measurement notes.

### 4.3 Numbers, money and dimensions

- `font-variant-numeric: tabular-nums` on every table, counter, price, timer and dimension.
- Money is stored and passed as **integer pence**, displayed as GBP in `en-GB` (`£12,480.00`). Never compute in floats in the UI.
- Dimensions are **integer millimetres**, displayed with a thin space + `mm` (`2 400 mm`). No feet/inches conversion unless the spec adds it.
- Negative money uses a true minus sign (`−£480.00`), never parentheses or red alone.
- Percentages carry one decimal only when the value is not exact (`32.5 %`).
- Dates: `22 Oct 2026`; date + time: `22 Oct 2026, 14:05`; timezone Europe/London. Never `10/22/26`.
- Counts use the locale separator (`1,284`).

### 4.4 Reading and zoom

- Reading text: 45–75 characters per line; `text-wrap: pretty` on headings and prose.
- Left-aligned by default; never justified.
- At 200 % text zoom nothing clips, overlaps or becomes unreachable. Test every pattern in §10.
- Uppercase only for short labels (≤ 3 words) and the `OVERDUE` / `BORING: YES` style operational flags; never for headings or sentences.

---

## 5. Space, layout and grid

### 5.1 Spacing scale

Base unit 4 px, rhythm 8 px. Only these steps exist.

| Token | Value | Typical use |
|---|---|---|
| `--spacing-1` | 4 px | Icon gap, hairline offsets |
| `--spacing-2` | 8 px | Inside chips, compact gaps, minimum between targets |
| `--spacing-3` | 12 px | Input padding-block, tight stacks |
| `--spacing-4` | 16 px | Card padding (compact), page gutter on phones |
| `--spacing-5` | 20 px | Card padding |
| `--spacing-6` | 24 px | Section gap, page gutter on tablet |
| `--spacing-8` | 32 px | Between major groups |
| `--spacing-10` | 40 px | Page header to content |
| `--spacing-12` | 48 px | Large section separation |
| `--spacing-16` | 64 px | Empty-state breathing room, public viewer |

No arbitrary spacing values. Tailwind's base is set to `0.25rem`; only the steps above are allowed in components.

### 5.2 Shell dimensions

| Token | Value | Notes |
|---|---|---|
| `--layout-sidebar` | 17 rem / 272 px | Expanded desktop sidebar |
| `--layout-sidebar-collapsed` | 4.5 rem / 72 px | Icon rail; labels on hover/focus |
| `--layout-topbar` | 3.5 rem / 56 px | Search, sync/notifications, account |
| `--layout-content-data` | 90 rem / 1440 px | Tables, boards, dashboards |
| `--layout-content-form` | 68 rem / 1088 px | Detail hubs, forms, quote builder |
| `--layout-content-reading` | 44 rem / 704 px | Prose, settings explanations, public viewer copy |
| `--layout-gutter-mobile` | 1 rem | 16 px |
| `--layout-gutter-tablet` | 1.5 rem | 24 px |
| `--layout-gutter-desktop` | 2 rem | 32 px |

### 5.3 Controls and rows

| Token | Value | Notes |
|---|---|---|
| `--layout-control-height` | 2.75 rem / 44 px | Every interactive control, including icon buttons |
| `--layout-row-comfortable` | 3.25 rem / 52 px | Default table/list row |
| `--layout-row-compact` | 2.75 rem / 44 px | Minimum operational row; never below |
| `--layout-target-min` | 2.75 rem / 44 px | Touch/click target floor |
| `--layout-target-gap` | 0.5 rem / 8 px | Minimum space between adjacent targets |

Density never shrinks a target. Compact mode reduces padding and row height only, down to 44 px.

### 5.4 Grid and breakpoints

| Name | Min width | Behaviour |
|---|---|---|
| `base` | 320 px | Single column, 16 px gutter, bottom tabs in mobile shell |
| `sm` | 480 px | Single column, wider controls |
| `md` | 768 px | Two-column forms, sidebar rail, table starts |
| `lg` | 1024 px | Persistent sidebar, multi-column dashboards |
| `xl` | 1280 px | Full data tables, side panels |
| `2xl` | 1536 px | Content capped at 1440 px and centered |

- Mobile-first, fluid layouts. Breakpoints only where the content needs them.
- No horizontal page scroll from 320 px to 1920 px. Wide tables scroll **inside** their container with a sticky first column and an explicit scroll affordance.
- Use `100dvh` for full-height layouts; never `100vh`.
- Respect safe areas with `env(safe-area-inset-*)` on fixed bars.

### 5.5 Density modes

| Mode | Applies to | Row height | Cell padding | Use |
|---|---|---|---|---|
| **Comfortable** (default) | Detail pages, forms, dashboards, settings | 52 px | 12 × 16 px | Calm reading |
| **Compact** | DataTable, workshop board, parts, audit, reports | 44 px | 8 × 12 px | Scanning large sets |

Density is a user preference persisted per user, not a per-page accident. Mobile survey is always comfortable.

---

## 6. Shape, elevation and materials

### 6.1 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 0.5 rem / 8 px | Chips, tags, small controls |
| `--radius-md` | 0.75 rem / 12 px | Inputs, buttons, cards |
| `--radius-lg` | 1 rem / 16 px | Panels, sheets, grouped sections |
| `--radius-xl` | 1.375 rem / 22 px | Modals, floating menus |
| `--radius-full` | 9999 px | Pills, avatars, dots |

- Nested radii are concentric: inner = outer − padding. Never nest a 22 px radius inside a 12 px one.
- Buttons and inputs share `md` unless they sit inside a pill or a segmented control.

### 6.2 Borders and separators

- 1 px hairline at `--color-separator` for decorative separation.
- 1 px at `--color-border-strong` for inputs, focusable containers and any border that carries meaning.
- 0.5 px only on ≥ 2× density displays, via `@media (min-resolution: 2dppx)`.
- Never use a coloured left-border accent on cards. Use a state chip or a leading icon instead.

### 6.3 Elevation

| Token | Light | Dark | Use |
|---|---|---|---|
| `--shadow-1` | `0 1px 2px rgb(28 27 24 / .06)` | `0 1px 2px rgb(0 0 0 / .40)` | Card resting |
| `--shadow-2` | `0 2px 8px rgb(28 27 24 / .08)` | `0 2px 8px rgb(0 0 0 / .45)` | Card hover, sticky header |
| `--shadow-3` | `0 8px 24px rgb(28 27 24 / .10)` | `0 8px 24px rgb(0 0 0 / .50)` | Dropdown, popover |
| `--shadow-4` | `0 16px 40px rgb(28 27 24 / .14)` | `0 16px 40px rgb(0 0 0 / .55)` | Sheet, side panel |
| `--shadow-5` | `0 24px 64px rgb(28 27 24 / .18)` | `0 24px 64px rgb(0 0 0 / .60)` | Modal, command palette |

In dark mode, elevation is primarily the surface ramp (`bg-secondary` → `bg-tertiary`) plus a 1 px top highlight (`rgb(255 255 255 / .06)`); shadows are secondary.

### 6.4 Translucency and materials

- Translucency is allowed **only** on floating surfaces: top bar, mobile tab bar, sheets, popovers, menus, modals, command palette.
- Recipe: `background: color-mix(in oklab, var(--color-bg-primary) 82%, transparent); backdrop-filter: blur(20px) saturate(180%); border-bottom: 1px solid rgb(255 255 255 / .10)`.
- Never apply glass to content cards, tables, forms or large areas. Never stack glass on glass.
- Text on a translucent surface must meet AA against the worst-case background; raise opacity if not.
- Fallbacks:
  - `@supports not (backdrop-filter: blur(1px))` → solid `--color-bg-primary`.
  - `prefers-reduced-transparency: reduce` → solid surface.
  - `prefers-contrast: more` → solid surface, stronger separators.

### 6.5 Focus and selection

- Focus ring: 2 px solid `--color-focus`, offset 2 px, radius follows the element.
- On accent-filled controls, the offset reveals the canvas, so the ring stays visible.
- Selection: `accent-soft` fill + 2 px accent leading bar or check icon.
- Hover is an enhancement only. Every hover-revealed action must also exist in a menu, toolbar or detail view.

---

## 7. Motion

### 7.1 Tokens

| Token | Value | Use |
|---|---|---|
| `--motion-press` | 100 ms | Press feedback |
| `--motion-fast` | 150 ms | Hover, focus, colour change |
| `--motion-standard` | 200 ms | Expand/collapse, dialog enter |
| `--motion-emphasis` | 250 ms | Toast, tab indicator, row insert |
| `--motion-overlay` | 300 ms | Sheet, side panel |
| `--motion-page` | 400 ms | Route transition (fade only) |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `--ease-enter` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Exits |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Small, non-essential confirmation only |

### 7.2 Interaction recipes

| Interaction | Motion |
|---|---|
| Button / card press | scale 0.97, 100 ms, standard; release returns on pointer-up |
| Hover / focus | background, border or text colour, 150 ms |
| Row expand | height via grid-template-rows, opacity, 200 ms |
| Dialog | opacity 0 → 1 + scale 0.98 → 1, 200 ms enter, 150 ms exit |
| Sheet | translateY(100%) → 0, 300 ms enter, 250 ms exit |
| Toast | translateY(8px) + opacity, 250 ms enter, 200 ms exit, auto-dismiss 4 s |
| Skeleton | static shimmer only if motion is allowed; otherwise a calm static block |
| Page change | 200 ms cross-fade; no slide choreography |
| Stage / gate change | colour + icon change, 200 ms; no bouncing |

### 7.3 Rules

- Animate only `transform` and `opacity`. Never animate `width`, `height`, `top`, `left`, `margin` or `font-size`.
- Motion must be interruptible and reversible. Nothing blocks input.
- Give press feedback within 100 ms.
- No autoplay, looping or ambient animation longer than 5 s without a pause control. In practice: none in this product.
- `prefers-reduced-motion: reduce`: remove movement, parallax, zoom and looping; keep opacity fades ≤ 100 ms or remove them. Loading indicators still show progress.
- Never use motion to communicate a state that is not also present in text and colour.

---

## 8. Icons and imagery

### 8.1 Icons

- One set: **Lucide** via `@lucide/svelte`. No mixing with another icon library, no hand-drawn UI icons, no emoji as icons.
- Sizes: 16 px (inline with Footnote/Caption), 20 px (controls, nav), 24 px (page headers, empty states). Stroke 2 px at 24, 1.75 px at 20, 1.5 px at 16; align optically with the text baseline.
- Icons inherit `currentColor`. Decorative icons get `aria-hidden="true"`; icon-only controls get an accessible name via `aria-label` and a tooltip.
- Active navigation = accent icon + accent text + `accent-soft` background. Lucide has no filled variant; do not fake one by stacking strokes.
- Directional icons mirror in RTL via logical properties; do not hardcode `left`/`right` transforms.

### 8.2 Imagery

- Survey media, design renders and evidence are **real assets** from `asset` rows. Missing asset = placeholder card with aspect ratio and purpose, never a stock or AI substitute.
- Ratios: 16:9 (renders, video), 4:3 (survey photos), 1:1 (avatars, material swatches), free (plans).
- Serve AVIF/WebP with `srcset`/`sizes`, explicit `width`/`height`, lazy loading below the fold, and a solid `bg-secondary` placeholder to prevent layout shift.
- Alt text describes the content (`Wall A, 2 400 mm, window at 900 mm`), not the file name. Decorative images use `alt=""`.
- No full-bleed imagery inside operational screens. Full-bleed is reserved for the public viewer and login.

---

## 9. Component contracts

### 9.1 Universal component rules

1. One primary action per screen. Secondary and tertiary actions are visually subordinate.
2. Every component defines: default, hover, pressed, focus-visible, disabled, loading, empty, error. Offline and success where the scenario requires them.
3. All interactive targets are at least 44 × 44 px, with at least 8 px between adjacent targets. Expand the hit area with padding, not by enlarging the icon.
4. Labels are always visible above fields. Placeholder text is never the only label.
5. Destructive actions use `danger`, require confirmation when irreversible, and offer undo where the domain allows it.
6. Disabled is a last resort. Prefer explaining the missing precondition (and linking to it) over a dead button.
7. Cards have one primary action and are fully tappable when they have exactly one. No card nests more than one level.
8. Loading uses skeletons that match the final layout. Anything over 1 s shows determinate progress when the duration is known.
9. Errors are inline, specific and actionable. Never a blank screen.
10. No component invents data, permissions, states or endpoints.

### 9.2 Shared module register (Part 11 §6)

| Component | Purpose | Anatomy | States / behaviour | Accessibility |
|---|---|---|---|---|
| `SidebarNav` | Permission-filtered web navigation | Sections, items with Lucide icon + label, active indicator, collapse control | Expanded / collapsed rail / mobile drawer; state persisted per user; visibility recomputed from `/auth/me` on every load | `<nav>` + lists; `aria-current="page"`; arrow/Home/End keyboard; skip link precedes it |
| `StageIndicator` | Cross-page orientation across the pipeline | 15 step marks, labels, G1–G8 badges, current marker | Passed / blocking / future / current; horizontal scroll on narrow screens; compact mode shows current ± 1 | Ordered list; each step has a text label and state; not colour-only; `aria-label="Stage 4 of 15: Design"` |
| `GateBanner` | Explains a blocked gate and what unblocks it | Gate id, title, `blocking_reasons[]`, primary fix link | Blocking (danger) / warning / resolved (success, dismissible); persistent while blocking | `role="status"` for non-urgent, `role="alert"` only when a submission fails; reasons as a list; focus target on arrival |
| `StateChip` | Canonical workflow state | 6 px dot + Caption label | Neutral / info / warning / success / danger / muted per Appendix B | Text label always present; `title` adds the machine + raw value; never colour-only |
| `DataTable` | Every list page | Toolbar (search, filters, density, columns), sticky header, sortable columns, rows, bulk bar, keyset pagination | Loading / empty / error / filtered-empty / selected / compact; URL-synced filters; row actions in a menu | `<table>` with `<caption>`; `aria-sort`; keyboard row focus; checkboxes with labels; stacked cards below `md` |
| `MoneyField` / `PricingChainWidget` | Money entry and the pricing chain | Currency affix, integer-pence value, tabular numerals; chain: cost → mark-up → discount → VAT → total → GP % | Read-only / editable / invalid / recomputing; negative values; zero and null | `inputmode="decimal"`; formatted value announced; chain is a definition list, not a colour bar |
| `DimensionField` | Millimetre capture | Numeric input, `mm` suffix, range hint from Part 5, critical flag | Default / out-of-range warning / invalid / critical-verified | `inputmode="numeric"`; error text under the field; hint tied with `aria-describedby` |
| `QrPanel` | Part label QR | QR canvas, part UUID, caption, print action | Ready / generating / print preview / failed | Monochrome QR with quiet zone; UUID visible as text; label includes the caption; never used for projects |
| `AssignmentPanel` | Surveyor assignment on a project | Search + multi-select, selected chips with role badge, add/remove | Loading / empty (explains mobile access) / saving / error; removal confirmation explains existing surveys are kept, new ones blocked | Combobox pattern; selected items removable by keyboard; changes announced politely |
| `VersionTimeline` | Design and quote versions | Vertical list V1…Vn, status chip, date, author, immutable lock | Current / frozen / superseded / approved; expandable diff entry point | Ordered list; lock icon + “Frozen” text; no colour-only distinction |
| `EvidenceUploader` | Approval, sign-off and render evidence | Drop zone + file picker, file rows, progress, preview, replace/remove | Idle / uploading / complete / failed / required-missing; blocks the gated action until complete when required | Native file input; progress with `role="progressbar"`; errors next to the file; required state stated in text |
| `ValidationList` | V01–V13 engineering validation | Summary counts, rows of code + label + pass/fail/warning + reason | Pass / fail / warning / not-run; expandable reason; filter by result | Code and human label both shown; icon + text; announces count changes |
| `ChecklistDrawer` | Survey submission / verification readiness | Sectioned checklist, blockers, jump links, submit action | Ready / blocked / loading; sheet on mobile, side panel on desktop | Focus trap; Escape closes; return focus; blocker count in the title |
| `DedupReviewModal` | R5 duplicate review | Side-by-side candidate comparison, field diffs, “Link to existing” / “Confirm distinct” + note | Comparing / linking / confirming / error; cannot proceed without a note for distinct | Focus trap; destructive-style confirmation; radio group for the decision; full candidate labels |
| `ScanInput` | Workshop UUID entry | Single text field, paste/type, inline validation, submit on Enter | Empty / invalid (not 36-char lowercase UUID) / accepted / not found | No camera on mobile; explicit label; error explains the expected format |
| `AuditTrailTab` | Object history | Filterable timeline, actor, action, timestamp, expandable before/after diff | Loading / empty / error / filtered; CSV export where permitted | `<time>` with ISO value; diff labelled “Before” / “After”; table semantics |
| `SyncStatusChip` | Mobile sync state | Icon + count + label (`Queued`, `Conflicts`) | Synced / queued / syncing / conflict / offline | `aria-live="polite"` on count changes; tap opens Sync; never colour-only |
| `PermissionGate` | Hide actions the user cannot perform | Wrapper around an action or section | Allowed / hidden / disabled-with-reason | UX only — the server is authoritative; hidden controls are not focusable; a 403 route still exists |
| `ErrorBoundary` + `ForbiddenPage` | Shell failure and 403 | Illustration-free message, explanation, back/retry, request id | 403 / 404 / offline / unexpected error; retry | `h1`, actionable copy, focus moved to the heading; request id selectable |
| `AppShell` / `TopBar` | Web chrome | Skip link, sidebar, top bar, search, sync/notifications, account, main region | Expanded / collapsed / mobile drawer; command palette | Landmark roles; skip link first; one `main`; focus order follows visual order |

### 9.3 Primitives

| Primitive | Contract |
|---|---|
| **Button** | Variants: primary (accent filled, one per screen), secondary (outline / tinted), tertiary (text), destructive (danger), ghost (icon). Height 44 px, radius `md`, label sentence case, verb-first. Loading keeps width and shows a spinner + “Saving…”. |
| **Icon button** | 44 × 44 px hit area, 20 px icon, `aria-label`, tooltip on hover/focus. Never the only way to perform a critical action. |
| **Link** | Accent, underlined in prose, always distinguishable without colour. External links announce the new tab. |
| **Input / Textarea** | Label above, hint below, error below with icon + fix. 16 px minimum font size on mobile. `autocomplete`, `inputmode`, `enterkeyhint` always set. Validate on blur, not per keystroke. |
| **Select / Combobox** | Native select for ≤ 8 static options; combobox for searchable lists (customers, suppliers, decor). Keyboard complete; selected value announced. |
| **Checkbox / Radio / Switch** | Checkbox for multi-select, radio or segmented for one-of-few, switch for immediate on/off. 44 px target; label clickable; state not colour-only. |
| **Tabs** | For 2–5 views of the same object. `aria-selected`, arrow keys, focus follows selection or stays per pattern. URL reflects the tab. |
| **Dialog** | Short focused task. Max width 32 rem, radius `xl`, focus trap, Escape, backdrop click when no data is lost, return focus to trigger, background `inert`. |
| **Sheet / Side panel** | Mobile sheet from bottom; desktop side panel. Same focus rules as dialog. Swipe-down dismiss only when no data is lost. |
| **Menu / Popover** | Secondary actions, max ~8 items, labels with icons optional. Escape and outside click close; arrow keys navigate. |
| **Tooltip** | Enhancement only, never the sole label. Appears on hover and focus, dismisses on Escape, 500 ms delay. |
| **Toast** | `svelte-sonner`, top-right desktop / bottom-center mobile, 4 s auto-dismiss, one action max, `role="status"`. Errors that need action are inline, not toasts. |
| **Badge / Pill** | Read-only counts and categories. Caption style. Interactive filter pills are buttons with 44 px targets. |
| **Progress** | Linear for known progress, indeterminate only when unknown. `role="progressbar"` with value text. |
| **Skeleton** | Matches final layout. No spinner for content. Reduced motion: static block. |
| **Empty state** | Short explanation + one next action + optional secondary link. Never an illustration that hides the action. |
| **Pagination** | Keyset “Load more” for long lists; page numbers only for reports. Show total only when the API provides it. |
| **Breadcrumb** | Detail pages with a parent hub. Truncate middles, keep the current page as text. |
| **Avatar** | Initials on a neutral fill when no image; 24/32/40 px; accessible name. |
| **Accordion** | For long reference content only, not for primary workflows. `aria-expanded`; content stays in the DOM. |

### 9.4 Do / don't

| Do | Don't |
|---|---|
| Use one filled accent action | Two competing primary buttons |
| Pair colour with a label or icon | Red dot with no text |
| Use a background shift + hairline for grouping | Heavy outlines and coloured left borders |
| Put the gate reason next to the disabled action | A disabled button with no explanation |
| Show the real state and the next step | Hide a blocking condition behind a tooltip |
| Use Lucide icons at the text weight | Emoji, mixed icon sets, hand-drawn SVGs |
| Use tabular numerals for all quantities | Proportional digits in tables |

---

## 10. Page patterns

### 10.1 Shell

- Skip link → sidebar → top bar → `main`.
- Sidebar sections follow Part 11 §3 exactly; visibility is permission-driven; direct URL without permission renders the 403 page, never a blank screen.
- Top bar: global search, sync/notifications, account. Search is scoped and labelled; no fake global suggestions.
- Page header: breadcrumb (where applicable), `h1` (Large Title), optional supporting line, one primary action, overflow menu for the rest.
- Content max width by page type (§5.2). The page never scrolls horizontally; inner tables do.
- Every detail page shows: `StateChip`, `GateBanner` when blocked, and an Audit tab where Part 11 requires one.

### 10.2 Patterns

| Pattern | Used by | Layout | Primary action |
|---|---|---|---|
| **Dashboard** | `/dashboard`, reports index | Widget grid; each widget is a card with a title, metric, trend and link; role-scoped | Role-specific next step |
| **List** | customers, projects, surveys, quotes, jobs, parts, payments, snags | Page header + toolbar + DataTable + pagination; filters in URL; bulk bar appears on selection | “New …” |
| **Detail hub** | customer, project, survey, design, quote, job, part, installation, aftercare | Header with identity + state + gates; summary cards; tabs; audit tab | The next legal transition |
| **Form / edit** | settings, profile, catalogue records | Single column max 68 rem; sections; sticky action bar on mobile | “Save changes” |
| **Wizard** | new project, import, onboarding | Stepper with progress; one decision per step; back preserves data; review step before commit | “Continue” → “Commit” |
| **Board** | jobs, workshop, snags | Columns by state; cards with caption + key metadata; drag is an enhancement with a menu alternative | Move / scan |
| **Editor** | design studio | Left catalogue palette, centre 2D/3D canvas, right inspector, bottom read-only survey strip; collapsible panels; save state visible | “Issue version” when legal |
| **Public viewer** | `/s/:token` | Full-bleed 3D; version badge; read-only banner; no nav | None (view only) |
| **Platform console** | `/platform/*` | Separate Interio shell; tables + drawers; never tenant-branded | Tenant / grant action |
| **Audit / activity** | `/activity`, `/admin/audit`, audit tabs | Filter bar + timeline/table; before/after diff; CSV | Export |
| **Settings** | `/admin/settings`, `/onboarding` | Key cards, each with current value, scope and edit action; changes audited | Save per card |
| **Report** | `/reports/:name` | Parameter form + chart/table + CSV; derived values labelled as such | Export CSV |

### 10.3 Page-level rules

1. The primary action is the **next legal transition** for the current state, not the most impressive one.
2. Gates are visible before the action, not after a failed submit.
3. Immutable objects (issued/approved versions) show a lock + “Frozen” label; editing creates a new version.
4. Derived financials are labelled “Derived” and show the formula source.
5. Identity captions are used everywhere; UUIDs appear only in part detail and QR payloads.
6. Every list reflects filters in the URL so the view is shareable.
7. Empty states explain the next action; offline and error states are first-class pages.
8. Preserve scroll position, filters and form data across navigation and reload.

---

## 11. Responsive behaviour and shells

| Shell | Range | Navigation | Special rules |
|---|---|---|---|
| **Web app** | 1024 px+ primary; 768 px+ supported | Left sidebar + top bar | Persistent sidebar `lg`+; rail from `md`; drawer below `md` |
| **Mobile survey** | 320–480 px | Bottom tabs: Projects, Surveys, Sync, Account | Comfortable density; 16 px body minimum; offline banner; sync chip always visible; safe-area padding; `100dvh` |
| **Public viewer** | Any | None | Full-bleed canvas; version badge; read-only banner; dead-link screen for unknown/revoked/superseded tokens |
| **Platform console** | 1024 px+ | Own minimal sidebar | Interio brand only; visually distinct from tenant app; never exposes tenant navigation |

Rules:
- Forms collapse to one column below `md`; tables become stacked cards below `md`, with the same fields and actions.
- Sticky action bars on mobile sit above the tab bar and respect safe areas.
- 3D editor panels become sheets on narrow screens; the canvas keeps its aspect ratio and never causes page scroll.
- The public viewer must work on a phone with one hand, with no account and no app chrome.

---

## 12. Accessibility

Target: **WCAG 2.2 AA** on every screen, every state, light and dark.

### 12.1 Structure and semantics

- Semantic HTML first: `header`, `nav`, `main`, `section`, `button`, `a`, `ul`, `ol`, `table`, `label`, `dialog`.
- One `h1` per page; logical heading order; landmarks; skip link as the first focusable element.
- `<button>` for actions, `<a>` for navigation. Never click handlers on `div`/`span`.
- Every image has meaningful `alt` or `alt=""`; every control has a programmatic label; every icon-only control has an accessible name.
- Dynamic changes announced with `aria-live` (`polite` for status, `assertive` only for errors that need immediate attention).

### 12.2 Keyboard

- Everything operable by keyboard in visual order: Enter/Space activate, Escape closes overlays, arrows move within menus/tabs/radio groups, Tab moves between groups.
- Visible focus ring: 2 px, 3:1 contrast, 2 px offset, never removed.
- Focus trap in dialogs/sheets; return focus to the trigger; background `inert`.
- No keyboard trap anywhere. No shortcut that overrides browser or screen-reader shortcuts.

### 12.3 Targets and input

- 44 × 44 px minimum, 8 px minimum gap.
- List rows ≥ 44 px.
- Inputs ≥ 16 px font size on mobile.
- `touch-action: manipulation` on controls.
- Support mouse, touch, keyboard and stylus. Hover is an enhancement only.
- Standard gestures only; every gesture has a visible alternative.
- Do not hijack scroll, text selection or browser back/forward.

### 12.4 Perception

- Body text 4.5:1; large text 3:1; icons, borders and focus 3:1.
- Never colour alone: pair with label, icon, shape or position.
- Support 200 % text zoom and 400 % page zoom without loss of content or function.
- Support `prefers-contrast: more`: stronger borders, separators and text; solid surfaces.
- Support `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Captions for video, transcripts for audio.

### 12.5 Forms and errors

- Labels above fields, always visible; hints tied with `aria-describedby`; errors tied and announced.
- Validate on blur; never on every keystroke.
- Error text: what happened, why (if useful), how to fix it. No blame, no codes as the primary message.
- Preserve entered data on error. Never clear a form on failure.
- Required fields are marked in text, not by colour alone.

### 12.6 Test matrix before shipping a screen

Keyboard only · screen reader (VoiceOver/TalkBack/NVDA) · 200 % text · 400 % zoom · dark mode · high contrast · reduced motion · reduced transparency · 320 px · 1920 px.

---

## 13. Content and voice

### 13.1 Voice

Quiet, precise, human, never salesy inside the app. Short sentences, active voice, everyday words. The product speaks like a competent colleague, not a brochure.

- Sentence case for headings, buttons, labels and menu items.
- Verbs first on buttons: “Save changes”, “Issue version”, “Add surveyor”, “Mark paid”.
- No “please”, no exclamation marks, no jargon, no technical error codes in primary messages.
- Same thing, same name, everywhere. Terminology is locked by the spec.

### 13.2 Terminology

| Term | Meaning | Never call it |
|---|---|---|
| **Job** | The permanent production spine created from an approved order | Order, project |
| **Project** | The customer engagement before and around the job | Job |
| **Unit** | One cabinet / wardrobe / furniture unit in a room | Item, piece |
| **Part** | One physical component with a permanent UUID | Piece, panel |
| **Survey** | The captured reality of the property | Site visit |
| **Design version** | Immutable revision of a design | Draft |
| **Quote version** | Immutable revision of a quote | Estimate |
| **Remake** | Replacement production of a damaged/incorrect part | Reorder |
| **Snag** | A defect found at installation | Issue |
| **Aftercare** | Warranty / service request | Support ticket |
| **Gate** | A server-enforced precondition (G1–G8) | Check, step |
| **Hold point** | A blocking condition requiring on-site information | Blocker |
| **BORING** | Whether a part requires drilling | Drill flag |

### 13.3 Formatting

- Currency: GBP, `£12,480.00`, integer pence underneath.
- Dimensions: integer millimetres, `2 400 mm`.
- Dates: `22 Oct 2026`; time: `14:05`; timezone Europe/London.
- Percentages: `32.5 %` only when not exact.
- UUIDs: never displayed except part detail and QR payloads; captions are the UI identity.
- Reference numbers (`OIG-2026-0001`) are display-only, never identifiers in copy.

### 13.4 Copy patterns

| Situation | Pattern |
|---|---|
| Empty list | “No surveys yet.” + why + “New survey” |
| Blocked gate | “Design cannot be issued yet.” + reasons + “Verify measurements” |
| Field error | “Enter a width between 100 and 6 000 mm.” |
| System error | “We could not save this change. Try again. If it keeps happening, quote request ID `…`.” |
| Offline (mobile) | “You are offline. Changes are saved on this device and will sync when you reconnect.” |
| Sync conflict | “This record changed on the server. Review the difference and re-apply your change.” |
| Destructive confirm | Verb + object + consequence (“Delete draft version V2? This cannot be undone.”) |
| Success toast | “Survey submitted.” (no “Successfully”) |
| Read-only | “View only. This design cannot be changed.” |

---

## 14. Implementation contract

### 14.1 Stack constraints

- **SvelteKit 2 + Svelte 5 runes + TypeScript strict.**
- **Tailwind CSS 4** with `@tailwindcss/vite`, `tailwind-merge`, `clsx`, `cn()` in `$lib/utils`.
- **Lucide** via `@lucide/svelte`; **Sonner** via `svelte-sonner`; theme via `mode-watcher`.
- **No shadcn-svelte.** The architecture fixes Tailwind + local wrappers; do not add a component library.
- Generic UI used by 2+ features lives in `src/shared/presentation/ui`; feature-only components stay in the module's `presentation/components`.
- No API calls, workflow logic or feature imports inside generic primitives.

### 14.2 Token files

| File | Contents |
|---|---|
| `src/lib/styles/tokens.css` | Canonical role tokens, dark overrides, spacing, radii, shadows, motion, layout, reduced-motion/transparency rules |
| `src/app.css` | `@import "tailwindcss"; @import "./lib/styles/tokens.css";` + the `@theme` / `@theme inline` mapping |
| `src/shared/presentation/ui/state-chip.ts` | The single state → category map from Appendix B |
| `src/shared/presentation/ui/` | Primitives and shared modules, each with a barrel export |

If the project chooses `src/app.css` only, the token content moves there unchanged. Do not create a second token source.

### 14.3 Canonical tokens

Components consume the `--color-*` roles in Appendix A. Tailwind utilities are generated by mapping those roles to readable utility names:

| Role token | Tailwind utility example |
|---|---|
| `--color-bg-primary` | `bg-canvas` |
| `--color-bg-secondary` | `bg-canvas-grouped` |
| `--color-bg-tertiary` | `bg-canvas-nested` |
| `--color-text-primary` | `text-ink` |
| `--color-text-secondary` | `text-ink-secondary` |
| `--color-text-tertiary` | `text-ink-tertiary` |
| `--color-separator` | `border-hairline` |
| `--color-border-strong` | `border-hairline-strong` |
| `--color-accent` | `bg-brand`, `text-brand`, `border-brand` |
| `--color-danger` | `text-critical`, `bg-critical` |
| `--color-success` | `text-safe`, `bg-safe` |
| `--color-warning` | `text-caution`, `bg-caution` |
| `--color-info` | `text-notice`, `bg-notice` |
| `--color-neutral-soft` | `bg-chip-neutral` |
| `--shadow-1` … `--shadow-5` | `shadow-e1` … `shadow-e5` |

Rules:
- Never hardcode a hex, rgb, px font size, duration or shadow in a component.
- Never use arbitrary Tailwind values (`bg-[#…]`, `text-[13px]`). Layout math may use `calc()` with layout tokens.
- Inline `style` is allowed only for dynamic values from data or 3D/canvas geometry (progress width, canvas transforms).
- Use logical CSS properties (`margin-inline-start`, `padding-inline-end`) for RTL readiness.
- `cn()` merges classes; variants are explicit props, not string concatenation.

### 14.4 Theme mode

- `mode-watcher` toggles the `dark` class on `<html>` and persists the user choice.
- `:root { color-scheme: light; }`, `.dark { color-scheme: dark; }`.
- The token overrides live under `.dark`; components never branch on theme.
- Tenant branding is applied after `/auth/me` resolves and before the authenticated shell paints; avoid a flash of default accent by rendering the shell only after branding resolves (skeleton is acceptable).

### 14.5 Component rules

- Every shared module in §9.2 has one owner file and one barrel export.
- State mapping is centralised; no page invents its own chip colours.
- Money and dimensions go through `MoneyField` / `DimensionField`; no ad-hoc formatting.
- Permissions are checked through `PermissionGate` for UX and re-checked by the server; never treat the gate as security.
- Toasts are for confirmation only; errors that require action stay inline.
- Loading, empty, error and offline are part of the component, not a page afterthought.

### 14.6 Performance budgets

| Metric | Budget |
|---|---|
| LCP | < 2.5 s |
| INP | < 200 ms |
| CLS | < 0.1 |
| Interaction feedback | < 100 ms |
| Route code-splitting | Required |
| Images | AVIF/WebP, `srcset`, explicit dimensions, lazy below fold |
| Fonts | System stack only; zero webfont requests |

Skeletons match final layout. Never show a blank screen while loading.

---

## 15. Quality gates

A screen or component is not reviewable until every item passes.

### 15.1 Visual and interaction

- [ ] Uses only tokens from this file; no hardcoded colour, size, duration, shadow or radius.
- [ ] Works in light mode, dark mode and `prefers-contrast: more`.
- [ ] Works from 320 px to 1920 px with no horizontal page scroll and no clipped content.
- [ ] Text scales to 200 % without breaking; all sizes use `rem`.
- [ ] Every target is ≥ 44 × 44 px with ≥ 8 px spacing.
- [ ] Exactly one primary action per screen; hierarchy is obvious at a squint.
- [ ] All states designed: default, hover, pressed, focus, disabled, loading, empty, error, offline, success.
- [ ] No more than three font weights per screen; no colour-only meaning.
- [ ] Motion uses only `transform`/`opacity`, stays within duration tokens, and has a reduced-motion alternative.
- [ ] Translucency only on floating surfaces, with solid fallbacks.
- [ ] Copy is sentence case, specific, consistent and free of jargon.
- [ ] Destructive actions have undo or confirmation; permissions are requested in context.
- [ ] No AI clichés: no purple-pink gradients, no emoji icons, no coloured left-border cards, no fake logos, no fabricated data.

### 15.2 Product contract

- [ ] Every control maps to at least one Part 10 endpoint; no invented data or endpoints.
- [ ] Every detail page shows the canonical `StateChip`, a `GateBanner` when blocked, and an Audit tab where required.
- [ ] The primary action is the next legal transition for the current state.
- [ ] Immutable versions show the lock + “Frozen” label.
- [ ] Money is integer pence / GBP; dimensions are integer mm; dates are en-GB.
- [ ] UUIDs are not displayed except in part detail and QR payloads.
- [ ] Permission-hidden navigation still resolves to a real 403 page.
- [ ] Tenant branding cannot break contrast or hierarchy.

### 15.3 Accessibility

- [ ] WCAG 2.2 AA contrast for text, icons, borders and focus.
- [ ] Keyboard-only operation with visible focus; no traps.
- [ ] Screen reader announces names, roles, states and updates.
- [ ] One `h1`, logical headings, landmarks, skip link.
- [ ] Forms: visible labels, inline errors, preserved data, correct input types.
- [ ] Reduced motion and reduced transparency respected.

### 15.4 Performance

- [ ] LCP < 2.5 s, INP < 200 ms, CLS < 0.1 on the target route.
- [ ] Route-level code splitting; heavy editor/viewer code is not in the shell bundle.
- [ ] Images sized, responsive and lazy below the fold.
- [ ] Skeletons match final layout; no layout shift on data arrival.

---

## 16. Open questions and change log

### 16.1 Brand and assets

| # | Question | Default until answered | Impact |
|---|---|---|---|
| B1 | Interio logo / mark files | Text wordmark “Interio” | Login, console, docs |
| B2 | Opulent logo (light/dark) and exact accent | Brass default; display name as text | Login, shell, public viewer |
| B3 | Exact `tenant.branding` JSON envelope | Treat as opaque; validate before apply | Tenant theming, onboarding |
| B4 | Whether the mobile survey app is the web shell at `/m/*` or a native wrapper | Same tokens and routes as Part 11 §5 | Build and packaging |

### 16.2 Design decisions to confirm

| # | Decision | Current value | Alternative |
|---|---|---|---|
| D1 | Identity direction | **Joinery Ink** | Drafting Blue; Plaster & Clay |
| D2 | Default density | Comfortable; compact opt-in | Compact default for ops roles |
| D3 | Default theme | Follow system, manual override | Light default |
| D4 | Tenant overrides | Accent + logo + display name only | Allow tenant surface tint (not recommended) |
| D5 | Chart library | Not fixed; lightweight SVG/CSS first | Add a library only by explicit decision |

### 16.3 Spec questions that affect UI

Anything undecided in Part 12 remains undecided here. Do not fill gaps with plausible UI. If a screen needs a state the spec has not defined, stop and raise it.

### 16.4 Change log

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-22 | Initial design system: Joinery Ink identity, tokens, shared-module contracts, page patterns, implementation contract, quality gates |

---

## Appendix A — Canonical token CSS

Copy-paste source of truth. The values here and the tables above must match.

```css
/* ============================================================
   Interio Design Tokens — V1.0
   Canonical role tokens. Components consume these only.
   ============================================================ */

:root {
  color-scheme: light;

  /* Surfaces */
  --color-bg-primary: #fbfaf8;
  --color-bg-secondary: #f3f1ed;
  --color-bg-tertiary: #eae7e1;

  /* Text */
  --color-text-primary: #1c1b18;
  --color-text-secondary: #55524b;
  --color-text-tertiary: #6c675e;
  --color-text-disabled: #a8a399;

  /* Lines */
  --color-separator: #dcd8d0;
  --color-border-strong: #8f8a80;

  /* Accent */
  --color-accent: #8a5a2b;
  --color-accent-hover: #744a22;
  --color-accent-soft: #f2e7d8;
  --color-on-accent: #ffffff;

  /* Feedback */
  --color-danger: #b3261e;
  --color-danger-soft: #fbe9e7;
  --color-danger-text: #8c1d18;
  --color-success: #2e6b43;
  --color-success-soft: #e6f2ea;
  --color-success-text: #1f5a36;
  --color-warning: #8a5a00;
  --color-warning-soft: #fbf0d9;
  --color-warning-text: #6b4600;
  --color-info: #1f5fbf;
  --color-info-soft: #e8f0fb;
  --color-info-text: #1a4c99;

  /* Neutral chip */
  --color-neutral-soft: #efede8;
  --color-neutral-text: #55524b;

  /* Focus */
  --color-focus: var(--color-accent);
  --color-focus-offset: var(--color-bg-primary);

  /* Spacing — 4 px base, 8 px rhythm */
  --spacing-1: 0.25rem;
  --spacing-2: 0.5rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  --spacing-16: 4rem;

  /* Radii */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.375rem;
  --radius-full: 9999px;

  /* Elevation */
  --shadow-1: 0 1px 2px rgb(28 27 24 / 0.06);
  --shadow-2: 0 2px 8px rgb(28 27 24 / 0.08);
  --shadow-3: 0 8px 24px rgb(28 27 24 / 0.1);
  --shadow-4: 0 16px 40px rgb(28 27 24 / 0.14);
  --shadow-5: 0 24px 64px rgb(28 27 24 / 0.18);

  /* Motion */
  --motion-press: 100ms;
  --motion-fast: 150ms;
  --motion-standard: 200ms;
  --motion-emphasis: 250ms;
  --motion-overlay: 300ms;
  --motion-page: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

  /* Layout */
  --layout-sidebar: 17rem;
  --layout-sidebar-collapsed: 4.5rem;
  --layout-topbar: 3.5rem;
  --layout-content-data: 90rem;
  --layout-content-form: 68rem;
  --layout-content-reading: 44rem;
  --layout-gutter-mobile: 1rem;
  --layout-gutter-tablet: 1.5rem;
  --layout-gutter-desktop: 2rem;
  --layout-control-height: 2.75rem;
  --layout-row-comfortable: 3.25rem;
  --layout-row-compact: 2.75rem;
  --layout-target-min: 2.75rem;
  --layout-target-gap: 0.5rem;
}

.dark {
  color-scheme: dark;

  --color-bg-primary: #121210;
  --color-bg-secondary: #1b1a17;
  --color-bg-tertiary: #242220;

  --color-text-primary: #f4f1ec;
  --color-text-secondary: #bdb7ad;
  --color-text-tertiary: #938d83;
  --color-text-disabled: #6b665e;

  --color-separator: #34312c;
  --color-border-strong: #6f6a62;

  --color-accent: #d8a96f;
  --color-accent-hover: #e5bd8b;
  --color-accent-soft: #2a2117;
  --color-on-accent: #1c1b18;

  --color-danger: #f2b8b5;
  --color-danger-soft: #2c1a19;
  --color-danger-text: #f2b8b5;
  --color-success: #8fd3a8;
  --color-success-soft: #17281d;
  --color-success-text: #8fd3a8;
  --color-warning: #f0c674;
  --color-warning-soft: #2a2113;
  --color-warning-text: #f0c674;
  --color-info: #9cc3f5;
  --color-info-soft: #16243a;
  --color-info-text: #9cc3f5;

  --color-neutral-soft: #262420;
  --color-neutral-text: #c9c3b9;

  --shadow-1: 0 1px 2px rgb(0 0 0 / 0.4);
  --shadow-2: 0 2px 8px rgb(0 0 0 / 0.45);
  --shadow-3: 0 8px 24px rgb(0 0 0 / 0.5);
  --shadow-4: 0 16px 40px rgb(0 0 0 / 0.55);
  --shadow-5: 0 24px 64px rgb(0 0 0 / 0.6);
}

/* Accessibility adaptations */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .material {
    background: var(--color-bg-primary) !important;
    backdrop-filter: none !important;
  }
}

@supports not (backdrop-filter: blur(1px)) {
  .material {
    background: var(--color-bg-primary);
  }
}

@media (prefers-contrast: more) {
  :root {
    --color-separator: var(--color-border-strong);
  }
}
```

### Tailwind 4 mapping

```css
@import "tailwindcss";
@import "./lib/styles/tokens.css";

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display",
    system-ui, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;

  --text-display: 2.75rem;
  --text-display--line-height: 1.1;
  --text-display--font-weight: 700;
  --text-display--letter-spacing: -0.02em;

  --text-large-title: 2.125rem;
  --text-large-title--line-height: 1.15;
  --text-large-title--font-weight: 700;
  --text-large-title--letter-spacing: -0.02em;

  --text-title-1: 1.75rem;
  --text-title-1--line-height: 1.2;
  --text-title-1--font-weight: 600;
  --text-title-1--letter-spacing: -0.015em;

  --text-title-2: 1.375rem;
  --text-title-2--line-height: 1.25;
  --text-title-2--font-weight: 600;
  --text-title-2--letter-spacing: -0.01em;

  --text-title-3: 1.1875rem;
  --text-title-3--line-height: 1.3;
  --text-title-3--font-weight: 600;
  --text-title-3--letter-spacing: -0.005em;

  --text-headline: 1.0625rem;
  --text-headline--line-height: 1.35;
  --text-headline--font-weight: 600;

  --text-body: 1.0625rem;
  --text-body--line-height: 1.5;
  --text-body--font-weight: 400;

  --text-callout: 1rem;
  --text-callout--line-height: 1.45;
  --text-callout--font-weight: 400;

  --text-subheadline: 0.9375rem;
  --text-subheadline--line-height: 1.4;
  --text-subheadline--font-weight: 500;

  --text-footnote: 0.8125rem;
  --text-footnote--line-height: 1.4;
  --text-footnote--font-weight: 400;

  --text-caption: 0.75rem;
  --text-caption--line-height: 1.35;
  --text-caption--font-weight: 500;
  --text-caption--letter-spacing: 0.01em;

  --spacing: 0.25rem;

  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.375rem;
  --radius-full: 9999px;
}

@theme inline {
  --color-canvas: var(--color-bg-primary);
  --color-canvas-grouped: var(--color-bg-secondary);
  --color-canvas-nested: var(--color-bg-tertiary);
  --color-ink: var(--color-text-primary);
  --color-ink-secondary: var(--color-text-secondary);
  --color-ink-tertiary: var(--color-text-tertiary);
  --color-ink-disabled: var(--color-text-disabled);
  --color-hairline: var(--color-separator);
  --color-hairline-strong: var(--color-border-strong);
  --color-brand: var(--color-accent);
  --color-brand-hover: var(--color-accent-hover);
  --color-brand-soft: var(--color-accent-soft);
  --color-on-brand: var(--color-on-accent);
  --color-critical: var(--color-danger);
  --color-critical-soft: var(--color-danger-soft);
  --color-critical-ink: var(--color-danger-text);
  --color-safe: var(--color-success);
  --color-safe-soft: var(--color-success-soft);
  --color-safe-ink: var(--color-success-text);
  --color-caution: var(--color-warning);
  --color-caution-soft: var(--color-warning-soft);
  --color-caution-ink: var(--color-warning-text);
  --color-notice: var(--color-info);
  --color-notice-soft: var(--color-info-soft);
  --color-notice-ink: var(--color-info-text);
  --color-chip-neutral: var(--color-neutral-soft);
  --color-chip-neutral-ink: var(--color-neutral-text);
  --color-ring: var(--color-focus);

  --shadow-e1: var(--shadow-1);
  --shadow-e2: var(--shadow-2);
  --shadow-e3: var(--shadow-3);
  --shadow-e4: var(--shadow-4);
  --shadow-e5: var(--shadow-5);
}
```

> If Tailwind reports a circular reference when upgrading, rename the theme alias rather than the canonical role token. The `--color-*` roles are the contract; utilities are an implementation detail.

---

## Appendix B — State → category map

The single map consumed by `StateChip`. `neutral` = not started/resting; `info` = moving; `warning` = waiting; `success` = passed/complete; `danger` = blocked/failed; `muted` = historical/cancelled.

| Entity / column | State | Category |
|---|---|---|
| customer, property `state` | `active` | neutral |
| | `pending_review` | warning |
| | `archived` | muted |
| | `cancelled` | muted |
| project `status` | `active` | success |
| | `on_hold` | warning |
| | `completed` | neutral |
| | `cancelled` | muted |
| survey `status` | `draft` | neutral |
| | `in_progress` | info |
| | `submitted` | warning |
| | `verified` | success |
| | `rejected` | danger |
| | `cancelled` | muted |
| design `state` | `active` | neutral |
| | `archived` | muted |
| design_version `status` | `draft` | neutral |
| | `issued` | info |
| | `approved` | success |
| | `rejected` | danger |
| | `superseded` | muted |
| | `archived` | muted |
| quote `state` | `active` | neutral |
| | `archived` | muted |
| quote_version `status` | `draft` | neutral |
| | `issued` | info |
| | `approved` | success |
| | `rejected` | danger |
| | `expired` | warning |
| | `withdrawn` | muted |
| | `superseded` | muted |
| | `archived` | muted |
| sales_order `status` | `open` | info |
| | `completed` | success |
| | `cancelled` | muted |
| job `status` | `created` | neutral |
| | `engineering` | info |
| | `procuring` | info |
| | `released_to_production` | info |
| | `in_production` | info |
| | `ready_for_install` | warning |
| | `installing` | info |
| | `completed` | success |
| | `closed` | neutral |
| | `on_hold` | warning |
| | `cancelled` | muted |
| unit `engineering_status` | `pending` | neutral |
| | `engineered` | success |
| | `superseded` | muted |
| part `status` | `pending_validation` | neutral |
| | `held` | danger |
| | `released` | info |
| | `cutting` | info |
| | `cut` | info |
| | `edge_banding` | info |
| | `boring` | info |
| | `assembly` | info |
| | `quality_control` | warning |
| | `complete` | info |
| | `ready_for_installation` | success |
| | `installed` | success |
| | `scrapped` | danger |
| part `remake_status` | `none` | neutral |
| | `requested` | warning |
| | `approved` | info |
| | `in_production` | info |
| | `complete` | success |
| | `rejected` | danger |
| remake_request `status` | `requested` | warning |
| | `approved` | info |
| | `rejected` | danger |
| | `complete` | success |
| | `cancelled` | muted |
| export_run `status` | `preview` | neutral |
| | `production` | info |
| | `failed` | danger |
| installation `status` | `ready_to_install` | info |
| | `install_booked` | info |
| | `delivered` | info |
| | `installation` | info |
| | `snagging` | warning |
| | `customer_sign_off` | warning |
| | `complete` | success |
| | `cancelled` | muted |
| snag_item `status` | `open` | danger |
| | `in_progress` | info |
| | `resolved` | success |
| | `waived` | muted |
| aftercare_request `status` | `open` | warning |
| | `assigned` | info |
| | `in_progress` | info |
| | `resolved` | success |
| | `closed` | neutral |
| | `cancelled` | muted |
| payment `status` | `pending` | warning |
| | `paid` | success |
| | `cancelled` | muted |
| | `refunded` | muted |
| asset `upload_state` | `pending` | neutral |
| | `uploading` | info |
| | `complete` | success |
| | `failed` | danger |
| app_user `state` | `active` | success |
| | `suspended` | warning |
| | `disabled` | muted |
| import_batch `status` | `staged` | info |
| | `committed` | success |
| | `cancelled` | muted |

Gate badges: **passed** = `success` + check; **blocking** = `danger` + alert; **future** = `muted` + dot. The gate id (G1–G8) is always in the label.

---

## Appendix C — Coverage matrix

### C.1 Part 11 §6 shared modules, plus shell chrome

| # | Module | Contract |
|---|---|---|
| 1 | `SidebarNav` | §9.2 |
| 2 | `StageIndicator` | §9.2 |
| 3 | `GateBanner` | §9.2 |
| 4 | `StateChip` | §9.2 + Appendix B |
| 5 | `DataTable` | §9.2 |
| 6 | `MoneyField` / `PricingChainWidget` | §9.2 + §4.3 |
| 7 | `DimensionField` | §9.2 + §4.3 |
| 8 | `QrPanel` | §9.2 |
| 9 | `AssignmentPanel` | §9.2 |
| 10 | `VersionTimeline` | §9.2 |
| 11 | `EvidenceUploader` | §9.2 |
| 12 | `ValidationList` | §9.2 |
| 13 | `ChecklistDrawer` | §9.2 |
| 14 | `DedupReviewModal` | §9.2 |
| 15 | `ScanInput` | §9.2 |
| 16 | `AuditTrailTab` | §9.2 |
| 17 | `SyncStatusChip` | §9.2 |
| 18 | `PermissionGate` | §9.2 |
| 19 | `ErrorBoundary` + `ForbiddenPage` | §9.2 |
| 20 | `AppShell` / `TopBar` | §9.2 |

### C.2 Shells and page families

| Shell / family | Designed in |
|---|---|
| Web shell, sidebar, top bar | §5.2, §10.1, §11 |
| Dashboard | §10.2 |
| List / DataTable pages | §9.2, §10.2 |
| Detail hubs | §10.2, §10.3 |
| Forms / wizards | §10.2, §12.5 |
| Boards (jobs, workshop, snags) | §10.2, §5.5 |
| Design editor | §10.2, §11 |
| Public viewer | §2.2, §10.2, §11 |
| Platform console | §2.2, §10.2, §11 |
| Mobile survey | §1.4, §5.5, §11 |
| Audit / activity / reports | §10.2, §13.3 |

---

*End of DESIGN.md — V1.0, awaiting approval.*
