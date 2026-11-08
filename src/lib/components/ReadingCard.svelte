<script lang="ts">
	import { NEXT_ACTIONS } from '#lib/workspace.svelte.js';
	import type { NextAction, ReadingExchange } from '#lib/workspace.svelte.js';
	import AttachedPages from './AttachedPages.svelte';
	import Icon from './Icon.svelte';

	type Props = {
		exchange: ReadingExchange;
		index: number;
		/** Only the latest message can be taken back to rewrite. */
		isLast: boolean;
		/** Choosing a next step while something is already running would start two searches. */
		busy: boolean;
		onNext: (action: NextAction) => void;
		onEdit: () => void;
	};
	let { exchange, index, isLast, busy, onNext, onEdit }: Props = $props();

	let files = $derived(exchange.attachments.filter((attachment) => attachment.kind === 'file'));
</script>

<article
	id="exchange-{index}"
	class="mx-auto w-full max-w-3xl scroll-mt-4 px-6 py-8 {index > 0 ? 'border-t border-border-subtle' : ''}"
>
	<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">
				{files.length === 1 ? 'FILE' : 'FILES'}
			</span>
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
		<AttachedPages pages={exchange.attachments} />
	</div>

	<section class="mt-8" aria-label="What the file says">
		<p class="type-meta tracking-widest text-accent-text">
			I'VE READ {files.length === 1 ? 'YOUR FILE' : 'YOUR FILES'}
		</p>

		{#each files as file}
			<div class="mt-4">
				<h2 class="type-h4">{file.title}</h2>
				<p class="type-meta mt-1 text-text-tertiary">
					{file.reading?.documentKind ?? 'document'}{file.truncated ? ' · first part only' : ''}
				</p>
				<ul class="mt-3 space-y-2">
					{#each file.reading?.summary ?? [] as point}
						<li class="flex gap-2 text-body text-text-secondary">
							<span class="text-text-muted" aria-hidden="true">·</span>
							{point}
						</li>
					{/each}
				</ul>
			</div>
		{/each}

		<p class="type-lead mt-8 text-text-primary">What would you like to do next?</p>
		<div class="mt-3 flex flex-wrap gap-2">
			{#each NEXT_ACTIONS as action}
				<button
					type="button"
					disabled={busy}
					onclick={() => onNext(action)}
					class="rounded-pill border border-border-default bg-surface-1 px-3.5 py-2 text-sm text-text-primary transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{action.label}
				</button>
			{/each}
		</div>
		<p class="mt-3 text-caption text-text-tertiary">
			Or type your own question below. The {files.length === 1 ? 'file stays' : 'files stay'} attached to
			your case.
		</p>
	</section>
</article>
