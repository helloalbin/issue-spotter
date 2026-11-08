<script lang="ts">
	import type { VerifyExchange } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';
	import ResearchReport from './ResearchReport.svelte';
	import ResearchSources from './ResearchSources.svelte';

	type Props = {
		exchange: VerifyExchange;
		index: number;
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		onEdit: () => void;
	};
	let { exchange, index, isLast, onEdit }: Props = $props();
</script>

<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">VERIFY CITES</span>
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
		<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{exchange.input}</p>
	</div>

	{#if exchange.brief.report}
		<ResearchReport brief={exchange.brief} {index} />
		<ResearchSources brief={exchange.brief} {index} />
	{/if}
</article>
