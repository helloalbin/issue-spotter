<script lang="ts">
	import type { CompareExchange } from '#lib/workspace.svelte.js';
	import type { QuotaInfo } from '#lib/spotter.js';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';
	import ResearchReport from './ResearchReport.svelte';
	import ResearchSources from './ResearchSources.svelte';

	type Props = {
		exchange: CompareExchange;
		index: number;
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		busy: boolean;
		/** Comparisons left this month. */
		quota: QuotaInfo | null;
		onConfirm: () => void;
		onEdit: () => void;
	};
	let { exchange, index, isLast, busy, quota, onConfirm, onEdit }: Props = $props();

	let ready = $derived(
		exchange.cases.length === 2 && exchange.cases.every((found) => found.verified && found.readable)
	);
	let outOfComparisons = $derived(quota !== null && quota.remaining === 0);
</script>

<!--
	Comparing two cases is done in two steps. First the cases the user named are found and each page is
	opened to check it is that case; the user confirms them here. Only then is the comparison run.
-->
<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">COMPARE CASES</span>
			{#if isLast && exchange.state !== 'comparing'}
				<button
					type="button"
					onclick={onEdit}
					class="flex items-center gap-1 text-caption text-text-tertiary hover:text-text-primary"
				>
					<Icon name="pencil" size={12} />
					Edit
				</button>
			{/if}
		</div>
		<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{exchange.input}</p>
	</div>

	{#if exchange.state !== 'done'}
		<section class="mt-8" aria-label="Cases found">
			<p class="type-meta tracking-widest text-accent-text">I FOUND THESE TWO CASES</p>
			<ul class="mt-4 grid gap-3 sm:grid-cols-2">
				{#each exchange.cases as found}
					<li class="rounded-xl border border-border-default bg-surface-1 p-4">
						<h2 class="type-h4">{found.name}</h2>
						<p class="type-meta mt-1 text-text-tertiary">
							{[found.court, found.year].filter(Boolean).join(' · ') || 'Court and year not given'}
						</p>
						{#if found.url}
							<a
								href={found.url}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-3 inline-flex max-w-full items-center gap-1.5 text-sm text-text-primary hover:underline"
							>
								<span class="truncate">{found.title || found.url}</span>
								<Icon name="externalLink" size={11} class="shrink-0 text-text-muted" />
								<span class="sr-only">(opens in a new tab)</span>
							</a>
							<p class="mt-0.5 text-caption text-text-tertiary">
								{found.host} · {found.official ? 'Official source' : 'A copy on Indian Kanoon, not the court’s own'}
							</p>
						{/if}
						<p
							class="mt-3 flex items-start gap-1.5 text-caption {found.verified && found.readable
								? 'text-accent-text'
								: 'text-text-secondary'}"
						>
							<Icon name={found.verified && found.readable ? 'badgeCheck' : 'info'} size={13} class="mt-px shrink-0" />
							{found.verified && found.readable
								? 'The page opened and is about this case.'
								: (found.problem ?? 'This page could not be checked.')}
						</p>
					</li>
				{/each}
			</ul>

			{#if exchange.state === 'confirm'}
				<div class="mt-5 flex flex-wrap items-center gap-3">
					<Button
						variant="primary"
						class="gap-[7px] px-4 py-2.5 shadow-button"
						onclick={onConfirm}
						disabled={!ready || busy || outOfComparisons}
					>
						<Icon name="gitCompare" />
						Compare these two
					</Button>
					{#if isLast}
						<button
							type="button"
							onclick={onEdit}
							disabled={busy}
							class="text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
						>
							These aren’t right
						</button>
					{/if}
				</div>
				<p class="mt-3 text-caption text-text-tertiary">
					{#if outOfComparisons}
						You have used your comparisons for this month.
					{:else if !ready}
						Both cases need to be found and checked before they can be compared. Edit your message and try again.
					{:else}
						Comparing uses one of your comparisons this month. It looks at the facts and then at what
						each court decided, and for any later decision that overturned either.
					{/if}
				</p>
			{/if}
		</section>
	{:else if exchange.brief?.report}
		<ResearchReport brief={exchange.brief} {index} />
		<ResearchSources brief={exchange.brief} {index} />
	{/if}
</article>
