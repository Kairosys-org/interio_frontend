# Basic Rules

These are the UI and UX checks and the general rules for any visual or interactive work. Apply them together with `ui-ux-tester.md`.

There are two kinds of checks:
- **UI** is how the page looks (layout, text, color, spacing).
- **UX** is how the page works for a person trying to get something done (can they find things, finish tasks, recover from mistakes).

## UI checklist (how it looks)

**Layout**
- No horizontal scrolling at any viewport.
- No overlapping, clipped or cut-off elements.
- Spacing and alignment are consistent between similar elements.
- Nothing looks stretched, squashed or oddly empty.

**Text and color**
- Text is readable: enough size and enough contrast against its background. Do not judge contrast by eye alone: read the computed text and background colors with `eval` and check the ratio (4.5:1 for normal text, 3:1 for large text).
- Headings, body and labels have a clear visual hierarchy.
- Long text and long words wrap or truncate cleanly.

**Interaction**
- Buttons, links and inputs look clickable and have visible hover, focus and disabled states.
- Click targets are at least about 44x44 on the mobile viewport. This rule is for touch screens: do not enlarge controls on desktop just because they are small.
- Hover states exist on desktop; check them by hovering and taking a screenshot.
- Tab through the whole page. Focus order is logical and the focus ring is visible on every stop.
- Forms show clear validation and error messages, and the page keeps working after submitting wrong input.
- Menus, modals and dropdowns open, close and fit inside the screen.

**States**
- Loading, empty and error states exist and look intentional.
- Long lists and missing images do not break the layout.

**Technical**
- No errors or warnings in the browser console.
- No failed network requests for the page's own assets.
- Images have alt text and the page can be used with the keyboard (Tab order is sensible).

## UX checklist (how it works)

**Clarity**
- On each page it is obvious what the page is for and what the main action is.
- Button and link labels say what will happen ("Save task", not "Submit" or "Click here").
- A first-time visitor could find the main actions without being told where they are.

**Feedback**
- Every action gets a visible response: a changed state, a message, a loading indicator, or a moved focus. Nothing happens silently.
- After saving, adding, completing or deleting something, the page shows that it worked.
- Slow actions show progress. Buttons cannot be pressed twice by accident while they are working.

**Mistakes and recovery**
- Error messages say what went wrong and how to fix it, in plain words, next to the thing that is wrong.
- Typed text is not lost after an error.
- Destructive actions (delete, clear, reset) are hard to trigger by accident: either they ask first or they can be undone.
- The browser's back button and a page reload do not break the app or lose important state.

**Navigation**
- The current page is clearly marked in the navigation.
- There is always a way back or to the home page, including from error pages like 404.
- Links go where their text says. No dead ends and no broken links.
- URLs make sense: a page can be reloaded or shared and still shows the same thing.

**Effort**
- Common tasks take as few steps as reasonable. Flag any flow that feels longer than it needs to be.
- Forms ask only for what is needed, put the cursor in the right place, and work with the keyboard (Enter submits, Tab moves in a sensible order).
- Defaults are sensible so the user does not have to change things in the common case.

**Consistency**
- The same kind of thing looks and behaves the same everywhere (all primary buttons look alike, all delete icons behave alike).
- Wording is consistent: the same thing is not called a "task" on one page and an "item" on another.

**Content**
- No placeholder text, broken characters, or leftover developer wording on screen.
- Empty states tell the user what to do next instead of showing a blank area.
- Dates, numbers and counts are correct and match what the data shows (for example, a badge saying 9 tasks should match the list).

**Accessibility basics**
- The whole flow can be completed with the keyboard alone.
- Focus moves somewhere sensible after opening or closing a form, menu or dialog.
- Icon-only buttons have an accessible name (an `aria-label` or visible text).
- Status changes and errors are announced to screen readers where the page uses live regions or alerts.

## Rules

- Never claim a fix works without a screenshot taken after the fix.
- Fix **bugs** yourself. For **suggestions** (UX improvements that change how the app works rather than repair something broken), list them in the report and do not implement them unless the user asks. Never redesign a flow on your own.
- Report only what you actually saw. If something could not be checked, say so.
- Do not edit files unrelated to the visual problem.
- If the app needs a login, ask for test credentials. Do not invent or guess them.
- If the dev server will not start, report the exact error instead of working around it.
