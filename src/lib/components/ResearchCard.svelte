<script lang="ts">
	import type { ResearchExchange } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';

	type Props = {
		exchange: ResearchExchange;
		index: number;
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		onEdit: () => void;
	};
	let { exchange, index, isLast, onEdit }: Props = $props();

	let brief = $derived(exchange.brief);
	let uncited = $derived(
		brief.blocks.reduce(
			(total, block) =>
				total + (block.kind === 'paragraph' ? block.sentences.filter((s) => s.uncited).length : 0),
			0
		)
	);
</script>

<!--
	A research brief. Every sentence carries the numbers of the pages it came from, and a sentence
	with no page is marked so it is not mistaken for a finding.
-->
<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">DEEP RESEARCH</span>
			{#if isLast}
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
		<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{exchange.topic}</p>
	</div>

	<section class="mt-8" aria-label="Research brief">
		<p class="type-meta tracking-widest text-accent-text">
			RESEARCH BRIEF · {brief.sources.length}
			{brief.sources.length === 1 ? 'SOURCE' : 'SOURCES'}
		</p>

		<div class="mt-4 space-y-3">
			{#each brief.blocks as block}
				{#if block.kind === 'heading'}
					<h2 class="type-h4 mt-6">{block.text}</h2>
				{:else}
					<p class="text-body leading-relaxed text-text-secondary {block.bullet ? 'flex gap-2' : ''}">
						{#if block.bullet}<span class="text-text-muted" aria-hidden="true">·</span>{/if}
						<span>
							{#each block.sentences as sentence}
								<span class={sentence.uncited ? 'text-text-tertiary' : ''}>{sentence.text}</span>
								{#each sentence.cites as n}
									<a
										href="#source-{index}-{n}"
										class="ml-0.5 align-super font-mono text-[10px] text-accent-text hover:underline"
										aria-label="Source {n}">[{n}]</a
									>
								{/each}
								{#if sentence.uncited}
									<span
										class="ml-1 rounded-sm border border-border-subtle px-1.5 py-px font-mono text-[10px] text-text-tertiary"
										title="No source was found for this sentence. Treat it as unconfirmed."
										>NO SOURCE</span
									>
								{/if}{' '}
							{/each}
						</span>
					</p>
				{/if}
			{/each}
		</div>

		{#if uncited > 0}
			<p class="mt-4 text-caption text-text-tertiary">
				{uncited}
				{uncited === 1 ? 'statement has' : 'statements have'} no source and {uncited === 1
					? 'is'
					: 'are'} marked. Treat {uncited === 1 ? 'it' : 'them'} as unconfirmed.
			</p>
		{/if}

		<h3 class="type-meta mt-8 tracking-widest text-text-tertiary">SOURCES</h3>
		<ol class="mt-3 space-y-2">
			{#each brief.sources as source}
				<li id="source-{index}-{source.n}" class="flex gap-3 text-sm">
					<span class="w-6 shrink-0 font-mono text-caption text-text-tertiary">[{source.n}]</span>
					<span class="min-w-0">
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1.5 text-text-primary hover:underline"
						>
							<span class="truncate">{source.title}</span>
							<Icon name="externalLink" size={11} class="shrink-0 text-text-muted" />
							<span class="sr-only">(opens in a new tab)</span>
						</a>
						<span class="mt-0.5 block text-caption text-text-tertiary">
							{source.host} ·
							{source.official ? 'Official source' : 'A copy on Indian Kanoon, not the court’s own'}
						</span>
					</span>
				</li>
			{/each}
		</ol>
		<p class="mt-6 text-caption text-text-tertiary">
			{brief.searches}
			{brief.searches === 1 ? 'search' : 'searches'} of primary legal sources. Open each source and read
			the passage before relying on it.
		</p>
	</section>
</article>
