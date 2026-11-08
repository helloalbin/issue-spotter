# Issue Spotter: UI Context

Describes the UI as it is built today (`src/routes/+page.svelte`, `+page.server.ts`, `+layout.svelte`, `layout.css`, `app.html`). It is a single page with no routing, no component library and no custom components. Everything is inline Tailwind utility classes. For domain terms, the API and quota rules see [`CONTEXT.md`](CONTEXT.md).

## Product feel

A calm, academic tool: warm neutral palette, restrained accents, generous whitespace. The audience is law students working through hypotheticals. The UI reads as a study aid, never as legal advice. Disclaimers appear in the header badge and the footer. The UI never truncates or rewrites what the user typed. Guidance (the context tip, the not-legal notice, the quota notice) is always non-blocking and keeps the user's text.

## Design tokens (as used, not formally defined)

There is no theme config. Tailwind 4 defaults are used directly, imported by one line in `layout.css`.

| Role | Value |
| --- | --- |
| Page background | `bg-stone-200/60` |
| Surfaces (cards) | `bg-white`, `border-stone-300`, `rounded-xl`, `shadow-sm` |
| Hero / primary | `stone-900` (header, primary button, count badge) |
| Accent | `amber-700` (Doctrines card only) |
| Neutral accent | `stone-500` (Precedents card) |
| Inset surface | `bg-stone-100/70` with `ring-1 ring-stone-200` (act cards) |
| Neutral notice | `bg-stone-100`, `border-stone-300`, `text-stone-700` (not-legal and out-of-searches notices) |
| Error | `red-50` background, `red-300` border, `red-800` text. Counter turns `red-700` |
| Text | `stone-900` body, `stone-800` lists, `stone-700` and `stone-600` secondary, `stone-500` and `stone-400` tertiary and placeholder |
| Type | Tailwind default sans (no custom font). `font-mono` for section chips. `tabular-nums` on counters |
| Radius | `rounded-xl` for cards, `rounded-lg` for inputs, buttons, notices and inset cards, `rounded-full` for pills and badges, `rounded-md` for chips |

No dark mode. No design tokens or CSS variables.

## Layout

```
main.min-h-screen  (px-4 py-10, stone-200/60)
└─ div.max-w-6xl.mx-auto
   ├─ header             dark hero card
   ├─ input card
   │   ├─ form           label + char counter, textarea, context tip,
   │   │                 actions row (3 buttons + quota counter)
   │   ├─ error banner   (role="alert", when an error exists)
   │   ├─ out-of-searches notice   (when quota is 0)
   │   └─ status region  (role="status"): stage text and not-legal notice
   ├─ loading skeleton   3 cards      (while loading)
   ├─ results summary line            (when result)
   ├─ results grid       3 columns on md+, stacked below
   ├─ acts section       full-width card, 2 columns on lg+
   └─ footer             centered disclaimer
```

Breakpoints in use: `sm` (wider padding on the header and input card), `md` (3-column card grid and skeleton grid), `lg` (2-column act grid). Mobile is a single stacked column.

## Sections and components

### Header (hero)
- `bg-stone-900` card with a pill badge: "For law students · learning aid, not legal advice".
- H1 "Case Law Issue Spotter" and a short description (`max-w-2xl text-sm`). Static.

### Input card
- **Label and counter.** "Case facts" label tied to the textarea via `for="facts"`. The counter shows `n / 12,000` and turns red over the limit. It counts raw length. The server requires 20 or more trimmed characters.
- **Textarea.** 8 rows, `required`, `bind:value`. A custom focus style replaces the outline. The placeholder is an example tenant scenario. There is no `maxlength`, so the counter and button state tell the user.
- **Context tip.** Shown under the textarea when the text is 40 or more characters and `looksLegal` is false: "Tip: say who did what to whom, and what harm, dispute or right is at stake. Legal context helps the spotter find the right issues." It is a small `text-xs` line. It never blocks submit and disappears once legal context is detected.
- **Actions row.**
  - **Spot issues** is the primary action. The label becomes "Analyzing…" while loading. It is disabled while loading, over the limit, or out of searches.
  - **Use sample facts** (secondary) fills the textarea with a landlord/tenant scenario and clears the error and notice. It does not clear results.
  - **Clear** (ghost) resets facts, error, notice and results.
  - **Quota counter** is pushed to the right (`ml-auto`, `text-xs`): "N of M free searches left today". It renders on first paint from the page load and updates from the stream.
- **Error banner** (`role="alert"`): validation errors, server error messages and network failures. Only the message is shown; any server `details` are never displayed.
- **Out-of-searches notice** (neutral box), shown when quota is 0: "You have used today's M free searches. They reset at {local time}. Your text is kept, and more access is coming soon." The local time appears only after the page mounts (it reads "later today" before), to avoid a server/client time zone mismatch.
- **Status region** (`role="status"`, `aria-live="polite"`): holds the stage text and the not-legal notice.
  - Stage text: "Checking that this is a legal fact pattern…" then "Spotting issues, doctrines, precedents and acts…". The first stage is skipped when the heuristic already shows clear legal context.
  - Not-legal notice (neutral box): "This doesn't look like a legal fact pattern. Update the facts and try again."

### Loading state
- Three skeleton cards labeled Issues, Doctrines and Precedents, with `animate-pulse` bars. The acts area has no skeleton.
- Each card is `aria-hidden="true"` with an `sr-only` label inside, which assistive tech never reads. The status region above is what announces progress.

### Results
Appears only when `result` exists and loading has finished.

- **Summary line:** `N issues · N doctrines · N precedents · N acts`. Not singularized ("1 issues").
- **Three category cards**, each with a colored top border, an H2 title, a count badge and a list.

  | Card | Title | Top border and badge | List |
  | --- | --- | --- | --- |
  | 1 | Primary legal issues | `stone-900` | Numbered (`ol`) |
  | 2 | Relevant doctrines | `amber-700` | Bulleted |
  | 3 | Landmark precedents | `stone-500` | Bulleted |

  Each has its own empty-state sentence.
- **Applicable acts & sections.** A full-width card with a title, a verification hint ("check the exact section wording in a bare act before citing") and a count badge that pluralizes correctly.
  - Act entries are 1 column on small screens, 2 on `lg`. Each is an inset card with the act name (H3), a one-line relevance and monospace section chips.
  - No sections: a small note tells the reader to open the act for the closest provision.
  - No acts: a dashed empty state explains the issues may turn on case law and general principles.
- Items are plain text. Nothing is expandable, linkable, copyable or sortable.

### Footer
Centered, `text-xs`: "Study aid for issue-spotting practice. Always verify sections and precedents against primary sources — model output can be incomplete or out of date."

## Interaction model

State is local to the page (Svelte 5 runes):

| State | Purpose |
| --- | --- |
| `facts` | Textarea content |
| `isLoading` | Disables submit, swaps the label, shows skeletons, hides results |
| `stage` | `verifying`, `analyzing` or none. Drives the status text |
| `errorMessage` | Error banner text |
| `notice` | Not-legal notice text |
| `liveQuota` | Latest quota from the stream. The displayed `quota` is `liveQuota ?? data.quota` |
| `mounted` | True after mount. Gates the local reset time |
| `result` | Last successful response, or `null` |

Flow on submit: clear error, notice and previous result → validate (min 20 trimmed, max 12,000) → set loading → `POST /api/spot` → read the NDJSON stream line by line → handle each event (`quota`, `stage`, `result`, `notLegal`, `error`) → clear loading and stage.

- A non-OK response is read as JSON. `quota_exceeded` (429) updates the quota and shows the out-of-searches notice, with no red error banner. Other failures use the error banner.
- If the stream ends without a result, a not-legal event or an error, the page shows "The analysis ended unexpectedly."
- Submitting clears the previous result immediately, so the old analysis disappears while the new one loads.
- There is no cancel, retry button or request abort.
- The `required` attribute triggers the browser's native message on an empty textarea before the custom check. Whitespace-only input gets the custom message.
- Results do not auto-scroll or take focus, so on small screens they may appear below the fold.
- Nothing is persisted client-side. A refresh loses the facts and the result (the quota is server-side and survives).

## Accessibility

Works:
- Label tied to the textarea. Native `required` and `disabled`.
- Visible focus styling on the textarea. Buttons use browser defaults.
- Semantic headings (H1 page, H2 per card, H3 per act) and real lists.
- Stage text and the not-legal notice are announced (`role="status"`, `aria-live="polite"`). The error banner is announced (`role="alert"`).

Gaps:
- The out-of-searches notice and quota counter changes are not in a live region, so they are not announced.
- No focus management after a result, notice or error appears. Results do not scroll into view.
- The `sr-only` text inside the `aria-hidden` skeleton is never read (harmless now that the status region announces progress).
- Placeholder text is `stone-400` on white, likely below AA contrast. Measure before relying on it.
- The card accents rely partly on color, though each card also has a title and count.
- `{#each}` blocks have no keys. Fine for static lists, but worth fixing if items become interactive.

## Not built

These do not exist in the UI today:
- Sign-in, account state or a sign-in prompt (the out-of-searches notice only says more access is coming).
- The Investigative and Research tiers, a tier switcher, credits or a balance.
- A purchase flow.
- A jurisdiction selector or override (the model infers it).
- Copy, export or share of results. History or saved analyses.
- Streaming of the result itself (only progress stages stream).
- Confidence or verification flags on precedents and sections.
- Links from acts or cases to source texts.
- Dark mode, theming, i18n or a custom font.
- Component extraction (cards, badges and buttons are repeated inline).

## UI conventions for new work

- Reuse the tokens above. The three card accents (`stone-900`, `amber-700`, `stone-500`) are the only accents. Use the neutral notice style for guidance and the red style only for real errors.
- Guidance must never block the user or alter their text.
- Keep Tailwind utilities inline for now. Extract components (`ResultCard`, `CountBadge`, `ActCard`, `Notice`) when a second use appears, under `src/lib`, imported via `#lib/...js`.
- Svelte 5 runes only (`$state`, `$derived`, `onclick={...}`).
- Share validation constants with the server (`MIN_FACTS`, `MAX_FACTS` come from `#lib/spotter.js`).
- Keep the disclaimers.
- Anything time- or locale-dependent must render only after mount, to avoid hydration mismatches.
- Check the page at mobile width and at `md` and `lg`. Verify UI changes in a real browser, not only through the API.
