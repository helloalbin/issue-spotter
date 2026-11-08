<script lang="ts">
	import { toMarkdown } from '#lib/markdown.js';
	import { caseLink, sectionLink } from '#lib/sources.js';
	import { caseKey, lookupCount, sectionKey } from '#lib/spotter.js';
	import type { Exchange } from '#lib/workspace.svelte.js';
	import AttachedPages from './AttachedPages.svelte';
	import Icon from './Icon.svelte';

	type Props = {
		exchange: Exchange;
		/** Its place in the conversation: 0 is the first message. */
		index: number;
		/** The messages of the case up to and including this one, for the Markdown export. */
		turns: string[];
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		onEdit: () => void;
	};
	let { exchange, index, turns, isLast, onEdit }: Props = $props();

	let result = $derived(exchange.result);
	let sources = $derived(exchange.sources);
	let verification = $derived(exchange.verification);

	let copied = $state<'message' | 'markdown' | null>(null);
	let verifiedCount = $derived(Object.keys(sources).length);

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

{#snippet heading(title: string, n: number)}
	<h3 class="flex items-center gap-2 type-h4">
		{title}
		<span class="type-meta rounded-pill bg-surface-2 px-2 py-0.5 text-text-tertiary">{n}</span>
	</h3>
{/snippet}

<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">
				{index === 0 ? 'CASE FACTS' : 'ADDED TO CASE'}
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

	<header class="mt-8 flex items-center gap-3">
		<span class="grid size-8 place-items-center rounded-pill bg-surface-2 text-text-secondary">
			<Icon name="check" />
		</span>
		<h2 class="type-h3">{index === 0 ? 'Issue analysis' : 'Updated analysis'}</h2>
	</header>
	{#if index > 0}
		<p class="mt-1 text-caption text-text-tertiary">Covers all the facts so far, including this message.</p>
	{/if}
	<div class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-2">
		<p class="type-meta text-text-tertiary">{summary}</p>
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
			{@render heading('Primary legal issues', result.issues.length)}
			{#if result.issues.length > 0}
				<ol class="mt-4 space-y-3">
					{#each result.issues as item, index}
						<li class="flex gap-4 text-body text-text-primary">
							<span class="type-meta w-4 shrink-0 pt-0.5 text-text-tertiary">{index + 1}</span>
							{item}
						</li>
					{/each}
				</ol>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No distinct issues identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Relevant doctrines', result.doctrines.length)}
			{#if result.doctrines.length > 0}
				<ul class="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
					{#each result.doctrines as item}
						<li class="flex gap-2 text-body text-text-secondary">
							<span class="text-text-muted" aria-hidden="true">·</span>
							{item}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No doctrines identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Landmark precedents', result.precedents.length)}
			{#if result.precedents.length > 0}
				<ul class="mt-4 grid gap-x-7 gap-y-3.5 sm:grid-cols-2">
					{#each result.precedents as precedent, precedentIndex}
						{@const search = caseLink(precedent, result.jurisdiction)}
						{@const match = sources[caseKey(precedentIndex)]}
						<li>
							<a
								href={match?.url ?? search.href}
								target="_blank"
								rel="noopener noreferrer"
								title={match ? `Verified: ${match.title}` : undefined}
								class="group inline-flex items-start gap-1.5 text-body font-medium text-text-primary hover:underline"
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
									class="mt-1.5 shrink-0 group-hover:text-text-primary {match
										? 'text-accent-text'
										: 'text-text-muted'}"
								/>
							</a>
							{#if precedent.year}
								<p class="font-mono text-[11px] text-text-tertiary">{precedent.year}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="type-body mt-3 text-text-tertiary">No precedents identified.</p>
			{/if}
		</section>

		<section class="py-6">
			{@render heading('Applicable acts & sections', result.acts.length)}
			<p class="mt-1 text-caption text-text-tertiary">
				Check the exact section wording in a bare act before citing.
			</p>
			{#if result.acts.length > 0}
				<ul class="mt-4 space-y-3">
					{#each result.acts as entry, actIndex}
						<li class="rounded-xl border border-border-default bg-surface-1 p-4">
							<h4 class="type-label">{entry.act}</h4>
							{#if entry.sections.length > 0}
								<ul class="mt-2 flex flex-wrap gap-1.5">
									{#each entry.sections as section, sectionIndex}
										{@const search = sectionLink(entry.act, section, result.jurisdiction)}
										{@const match = sources[sectionKey(actIndex, sectionIndex)]}
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
	</div>

	<div class="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
		<button
			type="button"
			onclick={() => copy('markdown', toMarkdown(turns, result, sources))}
			class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
		>
			<Icon name={copied === 'markdown' ? 'check' : 'copy'} size={14} />
			{copied === 'markdown' ? 'Copied' : 'Copy as Markdown'}
		</button>
		<p class="text-right text-caption text-text-tertiary">
			Model output can be incomplete or out of date. Verify before citing.
		</p>
	</div>
</article>
