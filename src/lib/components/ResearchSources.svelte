<script lang="ts">
	import type { ResearchBrief } from '#lib/spotter.js';
	import Icon from './Icon.svelte';

	type Props = { brief: ResearchBrief; index: number };
	let { brief, index }: Props = $props();

	/** Once pages have been read for a report, a source that was not read says so. */
	let readAny = $derived(brief.report !== undefined || brief.sources.some((source) => source.read));
</script>

<section aria-label="Sources">
	<h3 class="type-meta mt-10 tracking-widest text-text-tertiary">SOURCES</h3>
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
						{#if source.read === 'text'}
							· Page read{source.truncated ? ' (excerpts of a long document)' : ''}
						{:else if source.read === 'pdf'}
							· PDF read
						{:else if readAny}
							· Not read
						{/if}
					</span>
				</span>
			</li>
		{/each}
	</ol>
	{#if brief.searches > 0}
		<p class="mt-6 text-caption text-text-tertiary">
			{brief.searches}
			{brief.searches === 1 ? 'search' : 'searches'} of primary legal sources. Open each source and
			read the passage before relying on it.
		</p>
	{/if}
</section>
