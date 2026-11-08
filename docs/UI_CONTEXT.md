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
- **Result.** `AnalysisResult`, from the output frames (dark `T3K0n5`, light `acNPn`): the submitted facts with Copy and Edit, an "Issue analysis" heading, a summary line with a **Jurisdiction** chip (the jurisdiction the model says it applied, shown only if it gave one) and a **Search links** chip. Then Primary legal issues (numbered), Relevant doctrines (two columns), Landmark precedents (two columns, each a link with an external-link icon and the year beneath when the model gave a valid one) and Applicable acts & sections (cards whose section chips are links with the same icon). A footer row holds Copy as Markdown and a verify-before-citing note. The composer is empty and docked, and submitting from it adds to the case (see Follow-ups).
- **External links.** By default every link is a **search**, built in `src/lib/sources.ts`, never a stored address, because the model returns names and nothing else. Indian law (and an unstated jurisdiction) searches Indian Kanoon; another jurisdiction falls back to a Google search. When `SOURCE_VERIFICATION` is on, the server follows the answer with a web-search check and sends back real pages for the references it could confirm. Those links go straight to the page and show a **badge-check** icon instead of the external-link icon, with the page title as a tooltip; the rest keep their search link. The results appear first, with a "Verifying links" chip and a "Verifying…" pane header while it runs, then the chip reads "4 of 9 verified" (or "Search links" if nothing was confirmed). Links open in a new tab with `rel="noopener noreferrer"` and a visually hidden description ("verified page on indiankanoon.org" or "searches Indian Kanoon"). Copy as Markdown uses the verified links where there are any.
- **Verification pane.** `Inspector`, from `U4jGP`: a 328px right pane that shows once there is a result. **Search path** lists the five steps with the real counts, with "Analyzed with {model} · {n}s" from the server's `meta` event. **Sources** lists every case and statute as a link row (Case or Statute tag, truncated name with the full name as a tooltip, and a badge-check on a verified row), headed by the host(s) in use, with a note that explains what a verified link does and does not show. A panel toggle beside the theme toggle shows and hides it. On wide screens (1024px and up) it opens by default and remembers a choice made there (localStorage `pane`). Below that it is an overlay with a backdrop that always starts closed.
- **Error.** `ErrorNotice`, from the design's error frame: a compact notice centered in the column between the composer and the sample chips, on `surface-2` with a default border, a `danger` triangle-alert icon and 14px medium secondary text. Only the icon is colored; the box is not red. The user's text is kept. It is `role="alert"`. In development the provider-unreachable message also names the cause, for example "(ECONNREFUSED ::1:4999)"; production shows the plain message.
- **Not-legal.** Returns to the empty state with the user's text kept, as a neutral full-width notice in a polite status region.
- **Out of searches.** A neutral notice with the reset time. Anonymous visitors also get an inline Sign in link.

## Follow-ups

The page is a conversation. With an analysis on screen, the composer adds facts to that case instead of starting a new one, and nothing already on screen is replaced.

- **A thread of exchanges.** The workspace keeps `thread`: one `Exchange` per message, with what the user typed, the analysis of the whole case up to that message, and that analysis's own verified links. Each follow-up appends a new block below the earlier ones: the message in a bubble labelled "ADDED TO CASE", then an **update**, which is deliberately not the first analysis printed again (see "What an update looks like"). The earlier analyses stay exactly as they were, and the page scrolls to the start of the new one.
- **While it runs,** the earlier blocks stay, the message being analysed appears as a bubble below them, and the progress tree follows it ("Reading the whole case again, with the facts you added."). The composer is locked with Stop.
- **Combining.** On submit, `caseText` (`src/lib/case.ts`) sends the earlier messages followed by the new one, so the model reads the whole case. The model sees each later message prefixed `Further facts:` and the system prompt says to treat them as one case. That label is for the model only and never appears in the UI or the export.
- **The composer changes with the conversation.** The primary button reads **Spot issues** (sparkles) for the first message and **Add facts** (up arrow) once there is a conversation. The placeholder is "Add more facts to this case…", with a line saying the facts are added to the case, the analysis is updated below, and it counts as one search. **Clear** empties only the draft; **New analysis** in the sidebar starts a different case.
- **Edit** appears on the latest message only and takes it back into the composer, together with its analysis; the earlier exchanges stay. On the first message that returns to the empty state with its text.
- **Limits.** The counter and the 12,000-character limit apply to the whole case, and Spot issues or Add facts is disabled over it. A follow-up needs at least 5 characters (a first message needs 20), since "It was flour." is a real follow-up.
- **Failures leave the thread alone.** An error, a not-legal reply, Stop or a network failure adds nothing; the draft is kept to retry.
- The verification pane describes the latest analysis, and says so ("Latest analysis") once there is more than one. Copy as Markdown on an analysis exports the case up to that message.

### Files and drafts in the thread

- **A file sent on its own** (no text typed) is not analysed. The primary button reads "Send file", and the thread gets a **reading** message: a bubble labelled "FILE", then "I'VE READ YOUR FILE" with the file's title, its kind ("legal notice"), 3 to 5 plain-language points, and "What would you like to do next?" with three choices (Spot the legal issues, Find the counter-arguments, Draft a petition or complaint). A choice is sent as if typed, with the file as background, and costs one search. The reading itself uses no search. The composer says "Tell me what you want to do with the file…". Several files sent together are read together.
- **A file with text** is an ordinary analysis with the file as background. A few words are enough ("issues?"), since the file carries the facts. The file shows as a chip under the message.
- **A draft** replaces the analysis layout with `DraftCard`: "DRAFT · POLICE COMPLAINT", the document's title, "6 parts · 12 details to fill in or check", then the document in a panel, one part per heading. Everything in [square brackets] is highlighted, which covers both unknown details to fill in and statute sections to check. Below it: "Details to fill in" (up to 6 questions) and "Check before you use this" (3 to 5 notes: why this document, the forum, limitation, what to attach, that an advocate must review it). **Copy draft** and **Download .txt** give the same plain text. The pane says a draft has no references, and no reference verification is run. A disclaimer says it is a study draft, not ready to file.
- Progress for a draft shows its own steps: "Drafting the document", "Listing the details you still need to fill in", "Noting what to check before use".
- **Edit** on a file message puts the files back in the composer.

### What an update looks like

A follow-up is read against the analysis before it, so the new facts stand out instead of hiding inside a repeat of everything.

- **A headline and a kicker.** "UPDATE n" in the accent color, then a one-line headline the model writes about what the new facts change (for example "Flour, not a drug: the suspicion starts to look unreasonable"). The count line reads "5 new · 5 still apply · 3 set aside".
- **"What these facts change".** A card with an accent rail and 2 to 3 plain sentences, addressed to the student: what becomes stronger or weaker and what is newly raised.
- **New points lead.** In each section (issues, doctrines, precedents, acts) the new entries come first with a `NEW` badge and a "+n new" chip on the heading; a section with nothing new says so ("No new precedents.").
- **The rest folds away.** "Still applies · k" is a collapsed disclosure holding the entries the update shares with the earlier analysis, muted; "No longer central" lists, struck through, what the earlier analysis had and this one dropped.
- **"What would sharpen this".** Up to 4 questions about facts still unknown that would change the analysis, so the next message has somewhere to go.
- The first analysis keeps the original full layout. Case summary and Counter-arguments (the skills) are shown whole in an update.

**How the comparison works.** The model is told it is writing an update, is given the earlier analysis (only the headings of each entry), and is asked to copy earlier wording where an entry still applies, add entries for what the new facts raise, and leave out what no longer matters. The page does not trust any label from the model: `compareBy` (`src/lib/diff.ts`) decides new, still applies and set aside itself, by comparing words with filler removed (a 75% overlap counts as the same entry), so a lightly rephrased entry is still recognised. Each earlier entry can match only one new entry. Verified links keep working because new entries keep their position in the updated list.

Progress for an update gains "Comparing with your earlier analysis" first and "Noting what is still unknown" last.

## Composer

`Composer.svelte`, from the design's input card: a `bg-surface-2`, `rounded-2xl` card with a `textarea` (label `sr-only`, `name="facts"`) and a footer row. On the left are the **Add** button (opens the Add context drawer) and the character counter (`n / 12,000`, red over the limit, "Context locked" while loading). On the right are Clear and Spot issues (with the sparkles icon and `shadow-button`). The remaining searches ("N of M free searches left today", "free" only for anonymous visitors) sit under the card. The context tip (40 or more characters with no legal vocabulary) appears there too and never blocks. Validation: at least 20 trimmed characters, at most 12,000. Below the card in the empty state are the sample chips: "Use sample facts" (loads the next sample in turn), then one chip per sample.

### Add context drawer

`AddContext.svelte`, from the design: Upload files, Add a URL, a Skills grid and an "Or paste a link" field. It opens above the Add button, closes on Escape (focus returns to the button) or a click outside, and sizes itself to the space above the button, scrolling inside if needed.

- **Add a URL / paste a link** works. The row focuses the field; Enter or Add sends the address to `POST /api/source`, which fetches the page on the server (see CONTEXT.md) and returns its title and text. Only pages on Indian Kanoon, India Code and the Supreme Court site are accepted, and the field says so. Errors show under the field in the danger color ("For now you can add pages from…", a PDF, a missing page, the daily limit). Success closes the drawer and the page appears as a chip.
- **Skills.** **Summarize** and **Counter-args** are real toggles (`aria-pressed`, the selected style from the design, and "N selected" or "2 available" in the header). A skill stays on until switched off, across messages. The others (Draft, Deep research, Compare cases, Verify cites) are disabled and tagged "Soon".
- **Upload files** works. It opens the file picker (PDF, DOCX, PNG, JPEG, WebP; several at once), and files can also be dropped on the composer. The type is checked from the file's first bytes, not its name, so a renamed file is refused, and anything that is not one of those kinds gets "That file type can't be attached. You can add a PDF, a Word (.docx) file, or an image (PNG, JPEG or WebP)." A PDF or Word file has its text read in the browser (see CONTEXT.md); an image is shrunk first. The server then says what the file is. A legal document becomes a chip with "partial" when only its start is used; a clearly unrelated one (a recipe, a holiday photo) is **not attached** and the composer shows an off-context notice that says what it looks like and what Legal Spotter works on; and a PDF with no text layer says it may be a scan and to upload its pages as images. Limits: 10 MB per PDF or Word file, 8 MB per image, 40 PDF pages read, and the shared attachment limits.
- **Draft** is the third working skill. It is **exclusive**: switching it on switches Summarize and Counter-args off, and switching either of those on switches Draft off, because a draft is a document, not an analysis. The primary button then reads "Draft" with a pen icon.
- **Chips in the composer.** Active skills and pages attached to the message being written show as chips above the controls, each with an x to turn it off or remove it. A page chip links to the page and says "partial" when only its start is used. Once sent, a message's pages appear as small link chips under its bubble.

**What a skill adds.** Summarize adds a "Case summary" at the top of the analysis (3 to 5 plain-language bullets of the key facts). Counter-args adds "Counter-arguments" at the end: one entry per main issue with the strongest point the other side could make. Progress gains a matching step for each skill ("Summarizing the case", "Preparing counter-arguments"), and the verification pane's search path gains the same rows.

**Attached pages persist for the case.** The server is stateless, so every analysis re-sends the pages attached so far (up to 5, 12,000 characters each and 30,000 together). A page can be removed only while it is still in the draft.

## Sign-in

The sidebar shows "Sign In for Free" only when all four `FIREBASE_*` values are set. It opens the dialog, which offers Continue with Google and links to Terms and Privacy. The dialog closes when sign-in succeeds. Closing the popup is not an error. A signed-in user sees an account block in the sidebar (gradient avatar, name, email, and an up-down chevron that opens a menu with Sign out). The design's second avatar in the top bar is deliberately not built: it duplicated this block. The avatar gradient uses the `avatar-from`, `avatar-to` and `avatar-fg` tokens. Requests carry `Authorization: Bearer <ID token>` when signed in.

## Accessibility

Works: labelled textarea, `type="button"` on non-submit buttons, `:focus-visible` outline from the `focus` token, icon-only buttons have `aria-label`, decorative icons are `aria-hidden`, the progress and not-legal notice are polite live regions, errors are `role="alert"`, the dialog is native (focus trap and Escape), the spinner stops under `prefers-reduced-motion`, and the off-canvas drawer is `visibility: hidden` when closed so it leaves the tab order.

Gaps: the quota counter changes are not announced; results do not take focus or scroll into view; the dialog's backdrop click has no keyboard equivalent beyond Escape and the close button (acceptable); `text-muted` is below AA contrast in light mode, so keep it to placeholders.

## In the design but not built

- **Upload files and four of the six skills** (Draft, Deep research, Compare cases, Verify cites) are drawn and disabled (see the drawer above).
- **History, saved analyses, sync across devices**, and the "Ask a follow-up" input. The docked composer starts a new analysis.

- **Feedback and share actions** under the results (thumbs up and down, read aloud, the more menu). Thumbs need somewhere to store feedback; read aloud and the menu have no defined behavior yet. Only Copy as Markdown is built.

Extras not in the design: the ABOUT group (Privacy, Terms, Contact) in the sidebar, since the legal pages need a home.

## Conventions for new work

- Use tokens only. Never write a hex value. Use `type-*` text styles and the radius, spacing and elevation tokens above.
- Guidance must never block the user or alter their text. Use the neutral notice style for guidance and the danger style only for real errors.
- Extract a component when a second use appears, under `src/lib/components`, imported through `#lib/...`.
- Svelte 5 runes only (`$state`, `$derived`, `onclick={...}`).
- Anything time- or locale-dependent must render only after mount, to avoid hydration mismatches.
- Check both themes and a narrow width. Verify UI changes in a real browser, not only through the API.
- Keep the disclaimers.
