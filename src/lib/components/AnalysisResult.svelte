<script lang="ts">
	import { compareBy } from '#lib/diff.js';
	import { toMarkdown } from '#lib/markdown.js';
	import { analysisScript } from '#lib/speech.js';
	import { caseLink, sectionLink } from '#lib/sources.js';
	import { caseKey, lookupCount, sectionKey } from '#lib/spotter.js';
	import type { ActReference, Precedent, SpotterResult } from '#lib/spotter.js';
	import type { AnalysisExchange } from '#lib/workspace.svelte.js';
	import AttachedPages from './AttachedPages.svelte';
	import DraftCard from './DraftCard.svelte';
	import ReadAloud from './ReadAloud.svelte';
	import Icon from './Icon.svelte';

	type Props = {
		exchange: AnalysisExchange;
		/** Its place in the thread, which is also its anchor on the page. */
		index: number;
		/** How many analyses came before this one: 0 for the first, which is shown whole. */
		ordinal: number;
		/** The analysis before this one, which an update is compared against. */
		previous: SpotterResult | null;
		/** The messages of the case up to and including this one, for the Markdown export. */
		turns: string[];
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		onEdit: () => void;
	};
	let { exchange, index, ordinal, previous, turns, isLast, onEdit }: Props = $props();

	let result = $derived(exchange.result);
	let sources = $derived(exchange.sources);
	let verification = $derived(exchange.verification);

	let copied = $state<'message' | 'markdown' | null>(null);
	let verifiedCount = $derived(Object.keys(sources).length);

	/**
	 * An update is read against the analysis before it: what it adds, what still applies and what it
	 * set aside. The first analysis has nothing to compare with and is shown whole.
	 */
	let compare = $derived(
		ordinal > 0 && previous
			? {
					issues: compareBy(previous.issues, result.issues, (text) => text),
					doctrines: compareBy(previous.doctrines, result.doctrines, (text) => text),
					precedents: compareBy(previous.precedents, result.precedents, (entry) => entry.name),
					acts: compareBy(previous.acts, result.acts, (entry) => entry.act)
				}
			: null
	);

	let totals = $derived(
		compare
			? {
					fresh: Object.values(compare).reduce((sum, c) => sum + c.fresh.length, 0),
					kept: Object.values(compare).reduce((sum, c) => sum + c.kept.length, 0),
					gone: Object.values(compare).reduce((sum, c) => sum + c.gone.length, 0)
				}
			: null
	);

	const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
	let summary = $derived(
		[
			count(result.issues.length, 'issue'),
			count(result.doctrines.length, 'doctrine'),
			count(result.precedents.length, 'precedent'),
			count(result.acts.length, 'act')
		].join(' · ')
	);

	async function copy(kind: 'message' | 'markdown', text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = kind;
			setTimeout(() => (copied = null), 1500);
		} catch {
			// Clipboard access can be denied; nothing else to do.
		}
	}
</script>

{#snippet heading(title: string, n: number, fresh = 0)}
	<h3 class="flex items-center gap-2 type-h4">
		{title}
		<span class="type-meta rounded-pill bg-surface-2 px-2 py-0.5 text-text-tertiary">{n}</span>
		{#if fresh > 0}
			<span class="type-meta rounded-pill bg-accent-subtle px-2 py-0.5 text-accent-text">+{fresh} new</span>
		{/if}
	</h3>
{/snippet}

{#snippet newBadge()}
	<span
		class="ml-1 inline-block rounded-pill bg-accent-subtle px-1.5 py-px align-middle font-mono text-[10px] font-semibold text-accent-text"
	>
		NEW
	</span>
{/snippet}

{#snippet issueRow(text: string, n: number, isNew: boolean, muted: boolean)}
	<li class="flex gap-4 text-body {muted ? 'text-text-tertiary' : 'text-text-primary'}">
		<span class="type-meta w-4 shrink-0 pt-0.5 text-text-tertiary">{n}</span>
		<span>
			{text}
			{#if isNew}{@render newBadge()}{/if}
		</span>
	</li>
{/snippet}

{#snippet doctrineRow(text: string, isNew: boolean, muted: boolean)}
	<li class="flex gap-2 text-body {muted ? 'text-text-tertiary' : 'text-text-secondary'}">
		<span class="text-text-muted" aria-hidden="true">·</span>
		<span>
			{text}
			{#if isNew}{@render newBadge()}{/if}
		</span>
	</li>
{/snippet}

{#snippet precedentRow(precedent: Precedent, at: number, isNew: boolean, muted: boolean)}
	{@const search = caseLink(precedent, result.jurisdiction)}
	{@const match = sources[caseKey(at)]}
	<li>
		<a
			href={match?.url ?? search.href}
			target="_blank"
			rel="noopener noreferrer"
			title={match ? `Verified: ${match.title}` : undefined}
			class="group inline-flex items-start gap-1.5 text-body font-medium hover:underline {muted
				? 'text-text-secondary'
				: 'text-text-primary'}"
		>
			<span>
				{precedent.name}
				<span class="sr-only">
					{match
						? `(verified page on ${match.host}, opens in a new tab)`
						: `(searches ${search.name}, opens in a new tab)`}
				</span>
			</span>
			<Icon
				name={match ? 'badgeCheck' : 'externalLink'}
				size={12}
				class="mt-1.5 shrink-0 group-hover:text-text-primary {match ? 'text-accent-text' : 'text-text-muted'}"
			/>
		</a>
		{#if isNew}{@render newBadge()}{/if}
		{#if precedent.year}
			<p class="font-mono text-[11px] text-text-tertiary">{precedent.year}</p>
		{/if}
	</li>
{/snippet}

{#snippet actRow(entry: ActReference, at: number, isNew: boolean, muted: boolean)}
	<li class="rounded-xl border bg-surface-1 p-4 {isNew ? 'border-accent-text/40' : 'border-border-default'}">
		<h4 class="type-label {muted ? 'text-text-secondary' : ''}">
			{entry.act}
			{#if isNew}{@render newBadge()}{/if}
		</h4>
		{#if entry.sections.length > 0}
			<ul class="mt-2 flex flex-wrap gap-1.5">
				{#each entry.sections as section, sectionIndex}
					{@const search = sectionLink(entry.act, section, result.jurisdiction)}
					{@const match = sources[sectionKey(at, sectionIndex)]}
					<li>
						<a
							href={match?.url ?? search.href}
							target="_blank"
							rel="noopener noreferrer"
							title={match ? `Verified: ${match.title}` : undefined}
							class="group inline-flex items-center gap-[5px] rounded-sm border border-border-subtle bg-surface-2 px-[9px] py-[3px] font-mono text-caption text-text-secondary hover:text-text-primary"
						>
							{section}
							<span class="sr-only">
								{match
									? `(verified page on ${match.host}, opens in a new tab)`
									: `(searches ${search.name}, opens in a new tab)`}
							</span>
							<Icon
								name={match ? 'badgeCheck' : 'externalLink'}
								size={11}
								class="group-hover:text-text-primary {match ? 'text-accent-text' : 'text-text-muted'}"
							/>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-2 text-caption text-text-tertiary">
				Sections not specified. Read the act for the closest provision.
			</p>
		{/if}
		{#if entry.relevance}
			<p class="type-body mt-2 text-text-tertiary">{entry.relevance}</p>
		{/if}
	</li>
{/snippet}

<!-- What an update keeps, folded away, and what it set aside, so the new points stand alone. -->
{#snippet carried(keptCount: number, gone: string[], rows: import('svelte').Snippet)}
	{#if keptCount > 0 || gone.length > 0}
		<details class="group mt-4">
			<summary
				class="flex w-fit cursor-pointer list-none items-center gap-1.5 text-caption text-text-tertiary hover:text-text-primary [&::-webkit-details-marker]:hidden"
			>
				<Icon name="chevronDown" size={12} class="transition group-open:rotate-180" />
				Still applies · {keptCount}{gone.length > 0 ? ` · set aside · ${gone.length}` : ''}
			</summary>
			<div class="mt-3 space-y-4">
				{#if keptCount > 0}{@render rows()}{/if}
				{#if gone.length > 0}
					<div>
						<p class="type-meta text-text-tertiary">NO LONGER CENTRAL</p>
						<ul class="mt-2 space-y-1">
							{#each gone as text}
								<li class="text-body text-text-muted line-through decoration-border-strong">{text}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		</details>
	{/if}
{/snippet}

{#snippet keptIssues()}
	<ol class="space-y-3">
		{#each compare?.issues.kept ?? [] as { item, index: at }}
			{@render issueRow(item, at + 1, false, true)}
		{/each}
	</ol>
{/snippet}

{#snippet keptDoctrines()}
	<ul class="grid gap-x-8 gap-y-2 sm:grid-cols-2">
		{#each compare?.doctrines.kept ?? [] as { item }}
			{@render doctrineRow(item, false, true)}
		{/each}
	</ul>
{/snippet}

{#snippet keptPrecedents()}
	<ul class="grid gap-x-7 gap-y-3.5 sm:grid-cols-2">
		{#each compare?.precedents.kept ?? [] as { item, index: at }}
			{@render precedentRow(item, at, false, true)}
		{/each}
	</ul>
{/snippet}

{#snippet keptActs()}
	<ul class="space-y-3">
		{#each compare?.acts.kept ?? [] as { item, index: at }}
			{@render actRow(item, at, false, true)}
		{/each}
	</ul>
{/snippet}

<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">
				{ordinal === 0 ? 'CASE FACTS' : 'ADDED TO CASE'}
			</span>
			<span class="flex items-center gap-3 text-caption text-text-tertiary">
				<button
					type="button"
					onclick={() => copy('message', exchange.added)}
					class="flex items-center gap-1 hover:text-text-primary"
				>
					<Icon name={copied === 'message' ? 'check' : 'copy'} size={12} />
					{copied === 'message' ? 'Copied' : 'Copy'}
				</button>
				{#if isLast}
					<button
						type="button"
						onclick={onEdit}
						class="flex items-center gap-1 hover:text-text-primary"
					>
						<Icon name="pencil" size={12} />
						Edit
					</button>
				{/if}
			</span>
		</div>
		<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{exchange.added}</p>
		<AttachedPages pages={exchange.attachments} />
	</div>

	{#if result.draft}
		<DraftCard {result} id="draft-{index}" />
	{:else}
	{#if compare}
		<header class="mt-8">
			<p class="type-meta tracking-widest text-accent-text">UPDATE {ordinal}</p>
			<h2 class="type-h3 mt-1">{result.headline ?? 'Updated analysis'}</h2>
		</header>
	{:else}
		<header class="mt-8 flex items-center gap-3">
			<span class="grid size-8 place-items-center rounded-pill bg-surface-2 text-text-secondary">
				<Icon name="check" />
			</span>
			<h2 class="type-h3">Issue analysis</h2>
		</header>
	{/if}

	<div class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
		{#if totals}
			<p class="type-meta text-text-tertiary">
				<span class="text-accent-text">{totals.fresh} new</span> · {totals.kept} still
				{totals.kept === 1 ? 'applies' : 'apply'} · {totals.gone} set aside
			</p>
		{:else}
			<p class="type-meta text-text-tertiary">{summary}</p>
		{/if}
		{#if result.jurisdiction}
			<span
				class="flex items-center gap-[5px] rounded-pill border border-border-subtle bg-surface-1 px-[9px] py-[3px] text-[11px] text-text-tertiary"
			>
				<Icon name="mapPin" size={11} />
				Jurisdiction: {result.jurisdiction}
			</span>
		{/if}
		<span
			class="flex items-center gap-[5px] rounded-pill border border-border-subtle bg-surface-1 px-[9px] py-[3px] text-[11px] text-text-tertiary"
		>
			{#if verification === 'running'}
				<Icon name="loader" size={11} class="spin" />
				Verifying links
			{:else if verifiedCount > 0}
				<Icon name="badgeCheck" size={11} class="text-accent-text" />
				{verifiedCount} of {lookupCount(result)} verified
			{:else}
				<Icon name="link" size={11} class="text-accent-text" />
				Search links
			{/if}
		</span>
	</div>

	{#if compare && result.update && result.update.length > 0}
		<section
			class="mt-6 rounded-xl border border-l-2 border-border-default border-l-accent bg-surface-1 p-5"
			aria-label="What the new facts change"
		>
			<h3 class="type-label text-text-primary">What these facts change</h3>
			<ul class="mt-3 space-y-2.5">
				{#each result.update as point}
					<li class="type-body text-text-primary">{point}</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mt-6 divide-y divide-border-subtle border-t border-border-subtle">
		{#if result.summary && result.summary.length > 0}
			<section class="py-6">
				{@render heading('Case summary', result.summary.length)}
				<ul class="mt-4 space-y-2">
					{#each result.summary as point}
						<li class="flex gap-2 text-body text-text-secondary">
							<span class="text-text-muted" aria-hidden="true">·</span>
							{point}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="py-6">
			{@render heading('Primary legal issues', result.issues.length, compare?.issues.fresh.length)}
			{#if compare}
				{#if compare.issues.fresh.length > 0}
					<ol class="mt-4 space-y-3">
						{#each compare.issues.fresh as { item, index: at }}
							{@render issueRow(item, at + 1, true, false)}
						{/each}
					</ol>
				{:else}
					<p class="type-body mt-3 text-text-tertiary">No new issues.</p>
				{/if}
				{@render carried(compare.issues.kept.length, compare.issues.gone, keptIssues)}
			{:else if result.issues.length > 0}
				<ol class="mt-4 space-y-3">
					{#each result.issues as item, at}
						{@render issueRow(item, at + 1, false, false)}
					{/each}
				</ol>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No distinct issues identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Relevant doctrines', result.doctrines.length, compare?.doctrines.fresh.length)}
			{#if compare}
				{#if compare.doctrines.fresh.length > 0}
					<ul class="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
						{#each compare.doctrines.fresh as { item }}
							{@render doctrineRow(item, true, false)}
						{/each}
					</ul>
				{:else}
					<p class="type-body mt-3 text-text-tertiary">No new doctrines.</p>
				{/if}
				{@render carried(compare.doctrines.kept.length, compare.doctrines.gone, keptDoctrines)}
			{:else if result.doctrines.length > 0}
				<ul class="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
					{#each result.doctrines as item}
						{@render doctrineRow(item, false, false)}
					{/each}
				</ul>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No doctrines identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Landmark precedents', result.precedents.length, compare?.precedents.fresh.length)}
			{#if compare}
				{#if compare.precedents.fresh.length > 0}
					<ul class="mt-4 grid gap-x-7 gap-y-3.5 sm:grid-cols-2">
						{#each compare.precedents.fresh as { item, index: at }}
							{@render precedentRow(item, at, true, false)}
						{/each}
					</ul>
				{:else}
					<p class="type-body mt-3 text-text-tertiary">No new precedents.</p>
				{/if}
				{@render carried(
					compare.precedents.kept.length,
					compare.precedents.gone.map((entry) => entry.name),
					keptPrecedents
				)}
			{:else if result.precedents.length > 0}
				<ul class="mt-4 grid gap-x-7 gap-y-3.5 sm:grid-cols-2">
					{#each result.precedents as precedent, at}
						{@render precedentRow(precedent, at, false, false)}
					{/each}
				</ul>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No precedents identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Applicable acts & sections', result.acts.length, compare?.acts.fresh.length)}
			<p class="mt-1 text-caption text-text-tertiary">
				Check the exact section wording in a bare act before citing.
			</p>
			{#if compare}
				{#if compare.acts.fresh.length > 0}
					<ul class="mt-4 space-y-3">
						{#each compare.acts.fresh as { item, index: at }}
							{@render actRow(item, at, true, false)}
						{/each}
					</ul>
				{:else}
					<p class="type-body mt-3 text-text-tertiary">No new acts.</p>
				{/if}
				{@render carried(compare.acts.kept.length, compare.acts.gone.map((entry) => entry.act), keptActs)}
			{:else if result.acts.length > 0}
				<ul class="mt-4 space-y-3">
					{#each result.acts as entry, at}
						{@render actRow(entry, at, false, false)}
					{/each}
				</ul>
			{:else}
				<p
					class="type-body mt-4 rounded-xl border border-dashed border-border-default p-4 text-text-tertiary"
				>
					No specific statute identified for these facts. The issues above may turn on case law and
					general principles instead.
				</p>
			{/if}
		</section>

		{#if result.counterArguments && result.counterArguments.length > 0}
			<section class="py-6">
				{@render heading('Counter-arguments', result.counterArguments.length)}
				<p class="mt-1 text-caption text-text-tertiary">
					The strongest points the other side could make. Test your own answer against them.
				</p>
				<ul class="mt-4 space-y-4">
					{#each result.counterArguments as entry}
						<li class="border-l-2 border-border-default pl-4">
							<p class="type-label text-text-primary">{entry.issue}</p>
							<p class="type-body mt-1 text-text-secondary">{entry.argument}</p>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if result.openQuestions && result.openQuestions.length > 0}
			<section class="py-6">
				{@render heading('What would sharpen this', result.openQuestions.length)}
				<p class="mt-1 text-caption text-text-tertiary">
					Facts still unknown that could change the analysis. Adding them above will update it.
				</p>
				<ul class="mt-4 space-y-2.5">
					{#each result.openQuestions as question}
						<li class="flex gap-3 text-body text-text-secondary">
							<span class="type-meta w-4 shrink-0 pt-0.5 text-accent-text" aria-hidden="true">?</span>
							{question}
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>

	<div class="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={() => copy('markdown', toMarkdown(turns, result, sources))}
				class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
			>
				<Icon name={copied === 'markdown' ? 'check' : 'copy'} size={14} />
				{copied === 'markdown' ? 'Copied' : 'Copy as Markdown'}
			</button>
			<ReadAloud id="analysis-{index}" script={() => analysisScript(result)} />
		</div>
		<p class="text-right text-caption text-text-tertiary">
			Model output can be incomplete or out of date. Verify before citing.
		</p>
	</div>
	{/if}
</article>
