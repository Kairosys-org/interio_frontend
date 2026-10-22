# UI/UX Instructions (Apple HIG-Inspired, Web App)

Follow every instruction below when designing or building any screen, component, or interaction in this web app.

## 1. Core Principles

1. Design with intention. Give every element a clear purpose; remove anything that has none.
2. Put content first. Make the interface defer to the content; never let chrome compete with it.
3. Keep clarity. Make text legible at every size, icons precise, and the available actions obvious without explanation.
4. Be familiar. Use standard, widely understood patterns (tabs, back navigation, sheets, toggles) so users apply what they already know.
5. Be consistent. Reuse the same component, spacing, wording, and behavior for the same job everywhere.
6. Use depth sparingly. Create hierarchy with layering, subtle shadow, and translucency, not with decoration.
7. Adapt to context. Support every screen size, input method (touch, mouse, keyboard), color scheme, and ability.
8. Respect people and their data. Ask only for what you need, explain why, and never surprise the user.
9. Aim for a calm, polished, quiet feel. Prefer restraint over ornament.

## 2. Design Tokens (define once, reuse everywhere)

1. Define all colors, font sizes, spacing, radii, shadows, and durations as CSS custom properties on `:root`.
2. Never hardcode a color, size, or duration inside a component; always reference a token.
3. Name color tokens by role, not by hue (`--color-text-primary`, `--color-bg-secondary`, `--color-accent`, `--color-separator`, `--color-danger`).
4. Redefine the color tokens for dark mode; do not change component code between modes.

## 3. Typography

1. Use the system font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, "Segoe UI", Roboto, sans-serif`. Do not self-host or embed Apple's San Francisco fonts.
2. Define a small named type scale (Large Title, Title 1–3, Headline, Body, Callout, Subheadline, Footnote, Caption) and use only those styles.
3. Set body text to 17px (1.0625rem) with line-height about 1.4 to 1.5. Never set body text below 16px on mobile; never set any readable text below 12px.
4. Specify all sizes in `rem`, never `px`, so the user's browser font-size setting scales the whole interface.
5. Create hierarchy with size and weight (Regular, Medium, Semibold, Bold) rather than with color or decoration. Use at most three weights per screen.
6. Use tighter letter-spacing on large titles and neutral spacing on body text.
7. Keep line length between 45 and 75 characters for reading text.
8. Left-align text by default. Do not justify. Avoid ALL CAPS except for short labels.
9. Use `font-variant-numeric: tabular-nums` for numbers in tables, counters, prices, and timers.
10. Test the layout at 200% text zoom; make sure nothing clips, overlaps, or becomes unreachable.

## 4. Color

1. Choose one accent color for interactive elements (links, primary buttons, selection, focus). Use it consistently and nowhere else.
2. Use neutral grays for everything else. Keep backgrounds and text neutral so content and the accent stand out.
3. Define background levels: primary (page), secondary (grouped content, cards), tertiary (nested content). Light mode: white then light gray. Dark mode: true black or near-black then slightly lighter grays.
4. Define text levels: primary, secondary, tertiary, and disabled. Use secondary for supporting text and tertiary for placeholders and hints.
5. Reserve semantic colors for meaning only: green for success, orange or yellow for warning, red for error or destructive actions, blue for information or links.
6. Never rely on color alone to convey meaning; pair it with an icon, label, or shape.
7. Meet WCAG AA contrast: at least 4.5:1 for body text, 3:1 for large text (18.66px bold or 24px regular and up), and 3:1 for icons, borders, and focus indicators that carry meaning.
8. Check contrast separately in light mode, dark mode, and high-contrast mode.
9. Use separators and subtle background shifts in place of heavy borders. Make borders 1px (0.5px on high-density screens where supported) in a low-contrast neutral.

## 5. Dark Mode and Theming

1. Support light and dark mode from the first screen built.
2. Follow the system setting by default with `@media (prefers-color-scheme: dark)`; also offer a manual override stored in the user's preferences.
3. Design dark mode intentionally; do not just invert colors. Slightly lower the saturation of accent and semantic colors on dark backgrounds.
4. Replace shadows with lighter surface tones to show elevation in dark mode.
5. Provide dark variants for images, illustrations, and logos that need them.
6. Set `color-scheme: light dark` so native form controls and scrollbars adapt.
7. Respond to `prefers-contrast: more` by strengthening borders, text color, and separators.

## 6. Layout and Spacing

1. Use a 4px base unit and an 8px rhythm. Pick spacing only from the scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
2. Give content generous whitespace; group related items tightly and separate unrelated groups clearly (proximity creates meaning).
3. Align elements to a consistent grid and consistent leading edges. Keep margins identical across sibling screens.
4. Use side padding of 16px on phones, 20–24px on tablets, and a centered max-width container (about 1100–1200px; about 680–720px for reading content) on desktop.
5. Build mobile-first with fluid layouts (Flexbox, Grid, `minmax`, `clamp`). Use breakpoints only where the content needs them.
6. Respect device safe areas: add `viewport-fit=cover` to the viewport meta tag and use `env(safe-area-inset-*)` padding for fixed headers, footers, and tab bars.
7. Use `100dvh`, not `100vh`, for full-height layouts on mobile.
8. Place the most important content and primary action at the top or in the natural thumb zone; place secondary actions away from it.
9. Use consistent corner radii from a small set (for example 8, 12, 16, 22px) and make nested radii concentric (inner radius = outer radius minus padding).
10. Avoid horizontal page scroll at any width from 320px up.

## 7. Touch Targets and Input

1. Make every interactive element at least 44×44 CSS px, including icon buttons, checkboxes, and links in lists. Expand the hit area with padding, not by enlarging the visible icon.
2. Leave at least 8px between adjacent targets.
3. Make list rows at least 44px tall.
4. Use `touch-action: manipulation` on controls to remove tap delay and prevent accidental zoom.
5. Set input font-size to at least 16px so mobile Safari does not zoom on focus.
6. Support mouse, touch, keyboard, and stylus equally. Do not rely on hover for any essential function; treat hover as an enhancement only.
7. Use standard gestures only (tap, long-press, swipe-to-go-back, pull-to-refresh, pinch). Always provide a visible alternative to any gesture.
8. Do not hijack native scroll, text selection, or browser back and forward behavior.

## 8. Navigation

1. Use familiar patterns: a bottom tab bar (3–5 items) for top-level sections on mobile, a sidebar for top-level sections on desktop, and a top navigation bar with a back control for drill-down.
2. Show the user where they are: highlight the current tab or item and use clear screen titles.
3. Keep the same navigation in the same place on every screen.
4. Make the back path always available and predictable; the browser back button must work and restore scroll position and state.
5. Use large titles at the top level that collapse to a compact title on scroll.
6. Keep navigation hierarchy shallow; reach any key task within three taps or clicks.
7. Use a sheet or modal only for a short, focused task that returns to the same context. Use a full page for anything long or complex.
8. Use unique, shareable URLs for each screen and state.
9. Label every tab and nav item with an icon and text; do not use icon-only primary navigation.

## 9. Components

### Buttons
1. Give each screen exactly one primary button (filled, accent color). Use secondary (tinted or outlined) and tertiary (plain text) styles for other actions.
2. Write button labels as verbs describing the result ("Save changes", "Add to cart"); never "OK" or "Submit" when a specific verb fits.
3. Show distinct states: default, hover, pressed, focused, disabled, and loading.
4. Style destructive actions in the danger color and require confirmation for irreversible ones.
5. Disable a button only when necessary; prefer explaining what is missing.

### Forms
1. Place labels above fields, always visible; never use placeholder text as the only label.
2. Use the correct `type`, `inputmode`, `autocomplete`, and `enterkeyhint` attributes on every input.
3. Validate inline after the user leaves a field, not on every keystroke. Show the error directly under the field in text plus an icon, and say how to fix it.
4. Keep forms short. Ask for the minimum, split long forms into steps with a progress indicator, and preserve entered data on error.
5. Use toggles for immediate on/off settings, checkboxes for multi-select, radio buttons or segmented controls for one-of-few choices, and pickers or menus for longer lists.
6. Offer a sign-in option that does not require creating a password (passkeys, "Sign in with Apple", and similar) alongside other providers.

### Lists and tables
1. Use clean rows with thin separators inset from the leading edge, a clear primary line, and a lighter secondary line.
2. Show a disclosure chevron on rows that navigate deeper.
3. Provide swipe or menu actions for row-level operations, plus a visible non-gesture alternative.
4. Make tables sortable and scannable on desktop; collapse them into stacked cards or lists on narrow screens.

### Menus, popovers, sheets, and alerts
1. Use a context menu or overflow menu for secondary actions; keep it to a handful of items with clear labels.
2. Use sheets that slide from the bottom on mobile and centered dialogs or side panels on desktop. Provide a clear close control and support the Escape key and a swipe-down or backdrop tap to dismiss when no data would be lost.
3. Use alerts only for critical, interruptive information. Keep the title short, the message to one or two sentences, and the buttons to two or three clear choices with the safe option as the default.
4. Trap focus inside modals, return focus to the trigger on close, and mark the background inert.

### Cards and content containers
1. Use cards for grouped, self-contained content. Give them a subtle background shift or soft shadow, a consistent radius, and consistent padding.
2. Do not nest cards inside cards more than one level.
3. Make an entire card tappable when it has one primary action, and ensure it has a visible focus state.

### Search, segmented controls, and pickers
1. Place search at the top of the content it filters, show recent searches, and show results as the user types.
2. Use segmented controls for two to five mutually exclusive views of the same content.

## 10. Icons and Imagery

1. Use a single, consistent icon set with matching stroke weight, size grid, and style. Prefer SF Symbols-style outlined icons with a filled variant for the selected or active state.
2. Use SVG icons that inherit `currentColor` and scale with text.
3. Match icon weight to adjacent text weight and align icons optically with the text baseline.
4. Give every icon-only control an accessible name; give decorative icons `aria-hidden="true"`.
5. Serve responsive images (`srcset`, `sizes`), modern formats (AVIF, WebP), explicit width and height to prevent layout shift, and lazy loading below the fold.
6. Use full-bleed, high-quality imagery with an overlay or gradient scrim only when text sits on top of it, and keep that text at AA contrast.

## 11. Materials, Translucency, and Depth

1. Use translucency and blur (`backdrop-filter: blur() saturate()`) only for layered surfaces that float above content: navigation bars, tab bars, sheets, popovers, and menus.
2. Do not apply glass effects to content cards, text blocks, or large areas, and do not stack glass on glass.
3. Keep text on translucent surfaces at AA contrast over the worst-case background; add a slightly more opaque fill if needed.
4. Provide a solid-color fallback with `@supports not (backdrop-filter: blur(1px))`.
5. Replace all translucency with an opaque background when `prefers-reduced-transparency: reduce` or `prefers-contrast: more` is set.
6. Create elevation with a small set of consistent shadows (soft, low-opacity, slightly offset downward). Increase elevation for elements closer to the user (menus, modals).
7. Use thin highlight edges (1px semi-transparent border) on floating surfaces to separate them from the background.

## 12. Motion and Animation

1. Use motion to explain: show where something came from, where it went, or what changed. Never animate purely for decoration.
2. Keep most transitions between 150ms and 350ms; keep micro-interactions (press, toggle) near 100–200ms and large transitions (sheet, page) near 300–450ms.
3. Prefer spring-like or ease-out curves for entrances and ease-in for exits. Define easing tokens (for example `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`) and reuse them.
4. Animate only `transform` and `opacity`; avoid animating layout properties (`width`, `height`, `top`, `left`).
5. Make animations interruptible and reversible; respond immediately to user input, with no blocking delays.
6. Give instant press feedback: a subtle scale-down (about 0.97) or a highlight within 100ms of touch or click.
7. Honor `prefers-reduced-motion: reduce`: remove parallax, large movement, zoom, and looping animations; replace them with simple fades or no animation. Every animation must have this alternative.
8. Never auto-play looping or moving content for more than 5 seconds without a pause control.
9. Use skeleton placeholders and progress indicators for loading, never a blank screen. Show determinate progress when the duration is known.

## 13. Feedback and System Status

1. Acknowledge every user action visibly within 100ms.
2. Show loading states for anything that takes longer than about 300ms; show progress for anything longer than 1 second.
3. Confirm success with a brief, non-blocking message (toast or inline change) that disappears on its own after 3–5 seconds and is announced to screen readers.
4. Make errors specific, calm, and actionable: say what happened and what to do next, near where it occurred. Never blame the user.
5. Use optimistic updates for low-risk actions and roll back with a clear message on failure.
6. Provide undo for destructive or accidental actions wherever possible instead of confirmation dialogs.
7. Design empty states with a short explanation and a clear next action; design offline and error states as first-class screens.
8. Keep haptic-like feedback subtle and optional; on the web, use `navigator.vibrate` only for rare, meaningful events and never as the sole feedback.

## 14. Writing and Content

1. Write short, plain, friendly, and direct UI text. Use active voice and everyday words.
2. Lead with the most important word in labels and headings.
3. Use sentence case for buttons, labels, and headings. Use title case only for proper names.
4. Use consistent terminology; call the same thing by the same name everywhere.
5. Do not use "please", exclamation marks, jargon, or technical error codes in primary messages.
6. Write error messages as: what happened, why (if useful), and how to fix it.
7. Write meaningful link text; never "click here".
8. Use the user's language, locale, date, number, and currency formats. Support right-to-left layouts with logical CSS properties (`margin-inline-start`, `padding-inline-end`).

## 15. Accessibility (non-negotiable)

1. Target WCAG 2.2 AA as the minimum on every screen.
2. Use semantic HTML first (`header`, `nav`, `main`, `section`, `button`, `a`, `ul`, `label`, `table`). Add ARIA only when no native element fits.
3. Use `<button>` for actions and `<a>` for navigation; never attach click handlers to plain `div` or `span`.
4. Make every interactive element reachable and operable by keyboard in a logical order, with Enter and Space activating buttons, Escape closing overlays, and arrow keys moving within menus, tabs, and radio groups.
5. Provide a clearly visible focus indicator (at least 2px, 3:1 contrast, offset from the element) using `:focus-visible`; never remove the outline without a replacement.
6. Provide a "Skip to main content" link as the first focusable element.
7. Give every image meaningful `alt` text (empty `alt=""` when decorative), every form control a programmatic label, and every icon-only button an accessible name.
8. Use a single `h1` per page and a logical heading order.
9. Announce dynamic changes (toasts, validation errors, loading results) with `aria-live` regions or `role="status"` and `role="alert"` as appropriate.
10. Do not depend on color, shape, position, or sound alone to convey information.
11. Support zoom up to 400% without loss of content or function; never disable pinch-zoom.
12. Support screen readers (VoiceOver, TalkBack, NVDA), Voice Control, and switch input by providing clear names, roles, and states (`aria-expanded`, `aria-selected`, `aria-current`, `aria-pressed`).
13. Provide captions for video and transcripts for audio.
14. Give users enough time; make time limits adjustable or extendable.
15. Test with the keyboard only, a screen reader, 200% text size, high contrast, reduced motion, and reduced transparency before shipping any screen.

## 16. Performance and Responsiveness

1. Make the interface feel instant: render the first meaningful content fast, keep interactions under 100ms, and avoid layout shift.
2. Target Core Web Vitals "good" thresholds: LCP under 2.5s, INP under 200ms, CLS under 0.1.
3. Load only what the current screen needs; code-split routes, lazy-load images and heavy components.
4. Prefer skeletons that match final layout over spinners.
5. Preserve scroll position, form data, and view state across navigation and reloads.
6. Make the app usable on slow networks and offline where feasible; cache key views and queue actions for later.

## 17. Privacy, Permissions, and Trust

1. Request a permission (notifications, location, camera, microphone) only at the moment it is needed, after explaining the benefit in context; never on first load.
2. Make the app fully usable when a permission is denied and provide a path to change the choice later.
3. Collect the minimum data needed and show clearly what is collected and why.
4. Make privacy controls, account deletion, and data export easy to find.
5. Do not use dark patterns: no hidden costs, forced continuity, disguised ads, confirm-shaming, or hard-to-find cancel buttons.

## 18. Branding

1. Express the brand through the accent color, logo, tone of voice, and key illustrations; do not let it override clarity, hierarchy, or familiar patterns.
2. Keep brand elements out of the way of content: small logo in navigation, no decorative backgrounds behind text.
3. Keep the same brand treatment on every screen.

## 19. Pre-Ship Checklist

Check every item before merging a screen or component.

1. Uses only design tokens; no hardcoded colors, sizes, or durations.
2. Looks and works in light mode, dark mode, and high contrast.
3. Works from 320px to 1920px wide with no horizontal scroll and no clipped content.
4. Text scales to 200% without breaking; all sizes use `rem`.
5. All touch targets are at least 44×44px with at least 8px spacing.
6. Has exactly one primary action per screen and clear visual hierarchy.
7. All states are designed: default, hover, pressed, focus, disabled, loading, empty, error, offline, success.
8. Fully operable by keyboard with visible focus; screen reader announces names, roles, states, and updates.
9. Contrast meets AA for text, icons, and focus indicators.
10. Motion uses only `transform` and `opacity`, stays within the duration tokens, and has a reduced-motion alternative.
11. Translucency is limited to floating surfaces and has solid fallbacks for reduced transparency, increased contrast, and unsupported browsers.
12. Copy is short, specific, consistent, and in sentence case.
13. Permissions are requested in context only; destructive actions have undo or confirmation.
14. Passes Core Web Vitals targets and shows no layout shift.

