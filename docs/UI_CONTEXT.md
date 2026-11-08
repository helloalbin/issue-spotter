# Legal Spotter: UI Context

Describes the UI as built today. The source of truth for visuals is the local `design/spotter.pen` file (gitignored): frame `design-system` for tokens, and `current-default`, `current-streaming`, `current-output` and the `· light` frames for screens. For domain terms, the API and quota rules see [`CONTEXT.md`](CONTEXT.md).

## Product feel

A calm, academic tool. Neutral surfaces with one silver accent, generous whitespace, dark by default with a light theme. The audience is law students working through hypotheticals. The UI reads as a study aid, never as legal advice. The UI never truncates or rewrites what the user typed. Guidance (the context tip, the not-legal notice, the quota notice) is non-blocking and keeps the user's text.

## Design system

Defined once in `src/routes/layout.css`, taken from the `design-system` frame. **No raw colors anywhere else.** Components use the token classes, and `npm run check:tokens` fails on a hex or `rgb()` outside that file. A development-only page at `/design-system` renders every token and primitive in both themes (404 in production).

| Area | Tokens and how to use them |
| --- | --- |
| Surfaces | `bg-bg` (page), `bg-surface-1` (card), `bg-surface-2` (input, raised), `bg-surface-3` (overlay) |
| Text | `text-text-primary`, `-secondary`, `-tertiary`, `-muted`. Muted is for placeholders and decoration only: it fails contrast as body text in light mode |
| Borders | `border-border-subtle` (hairline), `-default` (standard edge), `-strong` (focus, emphasis) |
| Accent | `accent`, `accent-hover`, `accent-fg`, `accent-subtle`, `accent-text`. Primary button: `bg-btn`, `text-btn-fg`, `border-btn-border` |
| Status | `danger`, `danger-fg`, `danger-subtle`, `danger-border`, `success`, `success-subtle`, `success-text` |
| Type | Inter for the interface, JetBrains Mono for chips, counters and code. Scale `text-caption` 12, `text-sm` 13, `text-body` 14, `text-md` 16, `text-lg` 18, `text-xl` 20, `text-2xl` 24, `text-3xl` 30, `text-4xl` 38. These names are the design's `fs-*` tokens, so `text-body` is 14px and `text-md` is 16px |
| Text styles | `type-display`, `type-h1` to `type-h4`, `type-lead`, `type-body`, `type-label`, `type-meta`. They set size, weight and tracking together |
| Spacing | Tailwind's 4px base: 1 = 4px, 2 = 8, 3 = 12, 4 = 16, 6 = 24, 8 = 32, 12 = 48. Multiples only |
| Radius | `rounded-sm` 8, `-md` 10, `-lg` 12, `-xl` 16, `-2xl` 24, `-pill`. Keep nested corners concentric |
| Elevation | `shadow-raised`. Soft layered shadow on light, none on dark, where borders and surface steps carry the structure |

Themes: dark is the default and light is `data-theme="light"` on `<html>`. An inline script in `src/app.html` applies the saved choice (localStorage `theme`, falling back to the system preference) before first paint. `ThemeToggle` saves it.

Primitives in `src/lib/components`: `Button` (primary, secondary, ghost), `Chip`, `Icon` (inlined Lucide paths), `ThemeToggle`, `GoogleMark` (brand colors are tokens too).

One unavoidable exception: `static/favicon/site.webmanifest` holds `theme_color` and `background_color`. JSON cannot reference a CSS variable, so they are literal values there.

## Layout

The shell lives in `src/routes/+layout.svelte`, so the sidebar, top bar and sign-in dialog stay put while pages change. Analysis state lives in `src/lib/workspace.svelte.ts` and auth state in `src/lib/auth.svelte.ts`, outside any page, so opening a Learn page and coming back keeps the facts, the result and the quota counter.

```
div.flex.h-dvh
├─ Sidebar            272px; off-canvas drawer below md
│   ├─ brand (logo mark, wordmark), New analysis, Sample cases
│   ├─ LEARN: How it works, Issue-spotting guide, Glossary
│   ├─ ABOUT: Privacy, Terms, Contact
│   └─ Learning aid note, Sign In for Free / account chip with sign-out
└─ column
    ├─ top bar        menu button (below md), theme toggle
    └─ page           each page renders its own <main id="main">
SignInDialog          native <dialog>, opened through auth.openDialog()
```

Pages: `/` (the analysis), `/samples`, `/learn/how-it-works`, `/learn/guide`, `/learn/glossary`, `/privacy`, `/terms`. The last six use `ContentPage`. The active sidebar item is marked with `aria-current="page"`. "New analysis" clears the workspace and goes to `/`; the logo only navigates, so it never discards a result. A skip link jumps to `#main`.

## States

- **Empty.** Heading "What are the facts?", a short description, the composer, and sample chips (Landlord & tenant, Negligence, Contract breach). Messages sit under the composer. A footer holds the disclaimer and Privacy and Terms links.
- **Loading.** `Progress`, from the design's streaming frames (dark `EERdl`, light `DVL0X`): a "Spotting issues" head with a spinner, then a vertical tree of five steps joined by a rail. "Reading the facts" is first (note "checking legal context" while the classifier runs, then "done"). Then Identifying primary legal issues, Matching governing doctrines, Finding landmark precedents and Locating applicable acts & sections. Each step is done (check marker), active (spinner marker) or pending (empty marker, dimmed). Entries appear under a step as the server streams them, with a "3 found" count, and ease in (reduced motion turns that off). The first section the model has not finished is the active one. The tree is `aria-hidden`; a visually hidden live region announces only the active step and its count, so a screen reader is not read every entry.
  The composer is docked and locked: the facts show as two lines with **Show more / Show less** when there is more, "Context locked" on the left and **Stop** on the right. Stop cancels the request and the provider stops generating, so it saves cost, but the search still counts. The page returns to the empty state with the text kept and a notice.
- **Result.** `AnalysisResult`: the submitted facts with Copy and Edit, an "Issue analysis" heading with a one-line summary (correctly pluralized), then Primary legal issues (numbered), Relevant doctrines and Landmark precedents (two columns), and Applicable acts & sections (cards with monospace section chips). A footer row holds Copy as Markdown and a verify-before-citing note. The composer is empty and docked. Submitting from it starts a new analysis; it is not a follow-up.
- **Error or not-legal.** Returns to the empty state with the user's text kept and the message shown (`role="alert"` for errors, a polite status region for the not-legal notice).
- **Out of searches.** A neutral notice with the reset time. Anonymous visitors also get an inline Sign in link.

## Composer

`Composer.svelte`, from the design's input card: a `bg-surface-2`, `rounded-2xl` card with a `textarea` (label `sr-only`, `name="facts"`) and a footer row. On the left are the **Add** button (opens the Add context drawer) and the character counter (`n / 12,000`, red over the limit, "Context locked" while loading). On the right are Clear and Spot issues (with the sparkles icon and `shadow-button`). The remaining searches ("N of M free searches left today", "free" only for anonymous visitors) sit under the card. The context tip (40 or more characters with no legal vocabulary) appears there too and never blocks. Validation: at least 20 trimmed characters, at most 12,000. Below the card in the empty state are the sample chips: "Use sample facts" (loads the next sample in turn), then one chip per sample.

### Add context drawer

`AddContext.svelte` is the design's drawer: Upload files, Add a URL, a Skills grid (Draft, Deep research, Compare cases, Counter-args, Verify cites, Summarize) and an "Or paste a link" field. It opens above the Add button, closes on Escape (focus returns to the button) or a click outside, and sizes itself to the space above the button, scrolling inside if needed. **Every control in it is disabled and labelled "Soon" or "Coming soon"**, because uploads, link fetching and skills have no backend yet. The first two need file parsing and safe server-side fetching; the skills overlap with the Investigative and Research tiers in the roadmap. Wire them one at a time and remove the disabled state as each lands.

## Sign-in

The sidebar shows "Sign In for Free" only when all four `FIREBASE_*` values are set. It opens the dialog, which offers Continue with Google and links to Terms and Privacy. The dialog closes when sign-in succeeds. Closing the popup is not an error. A signed-in user sees an account block in the sidebar (gradient avatar, name, email, and an up-down chevron that opens a menu with Sign out) and a matching avatar beside the theme toggle in the top bar. The avatar gradient uses the `avatar-from`, `avatar-to` and `avatar-fg` tokens. Requests carry `Authorization: Bearer <ID token>` when signed in.

## Accessibility

Works: labelled textarea, `type="button"` on non-submit buttons, `:focus-visible` outline from the `focus` token, icon-only buttons have `aria-label`, decorative icons are `aria-hidden`, the progress and not-legal notice are polite live regions, errors are `role="alert"`, the dialog is native (focus trap and Escape), the spinner stops under `prefers-reduced-motion`, and the off-canvas drawer is `visibility: hidden` when closed so it leaves the tab order.

Gaps: the quota counter changes are not announced; results do not take focus or scroll into view; the dialog's backdrop click has no keyboard equivalent beyond Escape and the close button (acceptable); `text-muted` is below AA contrast in light mode, so keep it to placeholders.

## In the design but not built

- **Upload files, Add a URL and Skills** are drawn and disabled (see the drawer above). The "2 selected" skills state is not shown, since none can be selected.
- **Verification panel** (search path, linked sources) and the "Jurisdiction" and "Sources linked" chips. Precedents and sections are model output with no verification, so a "linked" claim would be false.
- **External links** on precedents and sections, and the year beside each case. The model returns plain strings.
- **History, saved analyses, sync across devices**, and the "Ask a follow-up" input. The docked composer starts a new analysis.
- **Feedback actions** (thumbs, read aloud, more) and a **Stop** button. Stopping would not stop the provider cost or refund the search.

Extras not in the design: the ABOUT group (Privacy, Terms, Contact) in the sidebar, since the legal pages need a home.

## Conventions for new work

- Use tokens only. Never write a hex value. Use `type-*` text styles and the radius, spacing and elevation tokens above.
- Guidance must never block the user or alter their text. Use the neutral notice style for guidance and the danger style only for real errors.
- Extract a component when a second use appears, under `src/lib/components`, imported through `#lib/...`.
- Svelte 5 runes only (`$state`, `$derived`, `onclick={...}`).
- Anything time- or locale-dependent must render only after mount, to avoid hydration mismatches.
- Check both themes and a narrow width. Verify UI changes in a real browser, not only through the API.
- Keep the disclaimers.
