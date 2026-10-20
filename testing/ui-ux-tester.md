# UI Tester Instructions

Use these instructions whenever you change or review anything visual or interactive (layout, styling, components, pages, forms, navigation, user flows). Do not call a UI/UX task done until you have looked at it and used it in a real browser.

The UI and UX checks and the general rules are in `basic-rules.md`. Read it alongside this file.

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
4. **Find problems** using the UI checklist and the UX checklist in `basic-rules.md`, then walk through the main user flows (see "Testing user flows"). Write a short list of what is wrong, with the page, viewport and element for each. Mark each item as **UI** or **UX**, and as **bug** (clearly broken) or **suggestion** (works, but could be better).
5. **Fix the code.** Make the smallest change that fixes each problem. Do not redesign things that were not broken.
6. **Re-check.** Reload, take new screenshots at the same viewports, and confirm each problem is fixed and nothing else moved.
7. **Repeat** until the checklist passes or you are blocked.
8. **Report** briefly: what was wrong, what you changed (file names), and what you could not fix.

## Viewports

Always check at least these:

- Desktop: 1280x720
- Tablet: 768x1024
- Mobile: 390x844

## Testing user flows

A flow is a whole task a real person would try, from start to finish. Do not only look at pages one by one. Use the app the way a visitor would.

1. **List the main flows first.** Read the navigation and the main buttons, then write down 3 to 5 things a visitor would want to do (for example: add a task, mark it done, delete it, open a project, find something by filtering). If the project rules below name flows, test those too.
2. **Run each flow on mobile and on desktop.** Use real clicks, typing and keyboard presses. After every step, take a screenshot or snapshot and check what happened.
3. **Test the happy path first, then try to break it.** Submit empty forms, type very long text, type odd characters, click twice quickly, go back with the browser's back button, reload in the middle, and open a page that does not exist.
4. **Note every step.** For each flow, record how many clicks it took, where you hesitated or could not tell what to do next, and anything that surprised you.

Do not leave test data behind. If you create, edit or delete things while testing, say so in your report.

## Project-specific rules

Add your own rules below. Anything written here overrides the defaults in `basic-rules.md`.

- Brand colors:
- Fonts:
- Spacing scale:
- Component library / design system:
- Pages to always check:
- Main user flows to always test (for example "sign up", "add item to cart"):
- Who the users are and what they care about most:
- Anything the agent must never change:
