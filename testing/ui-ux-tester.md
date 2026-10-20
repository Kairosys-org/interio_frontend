# UI Tester Instructions

Use these instructions whenever you change or review anything visual or interactive (layout, styling, components, pages, forms, navigation, user flows). Do not call a UI/UX task done until you have looked at it and used it in a real browser.

There are two kinds of checks:
- **UI** is how the page looks (layout, text, color, spacing).
- **UX** is how the page works for a person trying to get something done (can they find things, finish tasks, recover from mistakes).

## Tool

Use `playwright-cli` (Playwright's command-line tool for coding agents), always headless. Do not pass `--headed`.

- If you are unsure of a command, run `playwright-cli --help` instead of guessing.
- If the browser is missing, run `playwright-cli install-browser`.
- Save screenshots and snapshots to files and read only what you need. Do not dump whole pages into the conversation.
- Close the browser session when finished.

## Commands that are known to work

Use these first instead of trial and error.

- Open with an explicit browser: `playwright-cli open --browser=chromium <url>` (plain `open` or other browsers may fail on missing dependencies).
- Go to another page: `playwright-cli goto <url>`
- Set viewport: `playwright-cli resize <width> <height>`
- Screenshot to a file: `playwright-cli screenshot --filename=.playwright-cli/ui-review/<page>-<viewport>.png`
- Snapshot to a file: `playwright-cli snapshot --filename=.playwright-cli/ui-review/<page>-<viewport>.yml`
- Look at a screenshot by reading the PNG file with your file-read tool.
- Click by role: `playwright-cli click "getByRole('button', { name: 'New task', exact: true })"`
- Keyboard: `playwright-cli press Tab`
- Run JavaScript in the page: `playwright-cli --raw eval "<expression>"`
- Console messages: `playwright-cli console`

Screenshots capture only the visible viewport by default. To check below the fold, scroll first:
`playwright-cli eval "window.scrollTo(0, document.body.scrollHeight)"` then screenshot again (repeat for tall pages).

Overflow check (run on every page at every viewport; `sw` must not be larger than `w`):

```
playwright-cli --raw eval "JSON.stringify({w:innerWidth, sw:document.documentElement.scrollWidth, overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<-1)}).slice(0,6).map(el=>el.tagName+'|'+(el.textContent||'').trim().slice(0,30))})"
```

Click-target check (run at the mobile viewport; list buttons, links and inputs smaller than 44x44):

```
playwright-cli --raw eval "JSON.stringify([...document.querySelectorAll('button,a,input,select,textarea,[role=button]')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(r.width<44||r.height<44)}).slice(0,15).map(el=>el.tagName+'|'+(el.getAttribute('aria-label')||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,28)+'|'+Math.round(el.getBoundingClientRect().width)+'x'+Math.round(el.getBoundingClientRect().height)))"
```

Before reporting a small target as a problem, read its CSS. Some controls have an invisible padded hit area (for example a `::after` with negative inset) that makes the real tap area larger than the visible element.

## Workflow

1. **Start the app.** Find the dev server command in `package.json` (usually `npm run dev`), run it in the background, and wait until the URL responds. Note the URL and port.
2. **Open the page** headless with `playwright-cli open <url>`.
3. **Capture the current state.** Take a screenshot and a snapshot at each viewport below, for every page including error pages (like 404). Scroll down and capture the lower part of long pages too. Look at the screenshots before changing any code.
4. **Find problems** using the UI checklist, then walk through the main user flows (see "Testing user flows") and apply the UX checklist. Write a short list of what is wrong, with the page, viewport and element for each. Mark each item as **UI** or **UX**, and as **bug** (clearly broken) or **suggestion** (works, but could be better).
5. **Fix the code.** Make the smallest change that fixes each problem. Do not redesign things that were not broken.
6. **Re-check.** Reload, take new screenshots at the same viewports, and confirm each problem is fixed and nothing else moved.
7. **Repeat** until the checklist passes or you are blocked.
8. **Report** briefly: what was wrong, what you changed (file names), and what you could not fix.

## Viewports

Always check at least these:

- Desktop: 1280x720
- Tablet: 768x1024
- Mobile: 390x844

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

## Testing user flows

A flow is a whole task a real person would try, from start to finish. Do not only look at pages one by one. Use the app the way a visitor would.

1. **List the main flows first.** Read the navigation and the main buttons, then write down 3 to 5 things a visitor would want to do (for example: add a task, mark it done, delete it, open a project, find something by filtering). If the project rules below name flows, test those too.
2. **Run each flow on mobile and on desktop.** Use real clicks, typing and keyboard presses. After every step, take a screenshot or snapshot and check what happened.
3. **Test the happy path first, then try to break it.** Submit empty forms, type very long text, type odd characters, click twice quickly, go back with the browser's back button, reload in the middle, and open a page that does not exist.
4. **Note every step.** For each flow, record how many clicks it took, where you hesitated or could not tell what to do next, and anything that surprised you.

Do not leave test data behind. If you create, edit or delete things while testing, say so in your report.

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

## Project-specific rules

Add your own rules below. Anything written here overrides the defaults above.

- Brand colors:
- Fonts:
- Spacing scale:
- Component library / design system:
- Pages to always check:
- Main user flows to always test (for example "sign up", "add item to cart"):
- Who the users are and what they care about most:
- Anything the agent must never change:

