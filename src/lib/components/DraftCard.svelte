<script lang="ts">
	import { draftToText, gapCount, splitGaps } from '#lib/draft.js';
	import type { SpotterResult } from '#lib/spotter.js';
	import { draftScript } from '#lib/speech.js';
	import Icon from './Icon.svelte';
	import ReadAloud from './ReadAloud.svelte';

	type Props = { result: SpotterResult; id: string };
	let { result, id }: Props = $props();

	let blocks = $derived(result.draft ?? []);
	let gaps = $derived(gapCount(blocks));
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(draftToText(result.documentTitle, blocks));
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard access can be denied; the download still works.
		}
	}

	function download() {
		const type = (result.documentType ?? 'draft').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
		const url = URL.createObjectURL(
			new Blob([draftToText(result.documentTitle, blocks)], { type: 'text/plain;charset=utf-8' })
		);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${type || 'draft'}-draft.txt`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<header class="mt-8">
	<p class="type-meta tracking-widest text-accent-text">
		DRAFT{result.documentType ? ` · ${result.documentType.toUpperCase()}` : ''}
	</p>
	<h2 class="type-h3 mt-1">{result.documentTitle ?? 'Draft document'}</h2>
	<p class="type-meta mt-2 text-text-tertiary">
		{blocks.length} {blocks.length === 1 ? 'part' : 'parts'} · {gaps}
		{gaps === 1 ? 'detail' : 'details'} to fill in or check
		{#if result.jurisdiction}· {result.jurisdiction}{/if}
	</p>
</header>

<section
	class="mt-6 rounded-xl border border-border-default bg-surface-1 p-6 sm:p-8"
	aria-label="Draft document"
>
	{#each blocks as block}
		<div class="mt-6 first:mt-0">
			{#if block.heading}
				<h3 class="type-label tracking-wide text-text-primary uppercase">{block.heading}</h3>
			{/if}
			<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{#each splitGaps(block.text) as piece}{#if piece.gap}<span class="rounded-sm bg-accent-subtle px-1 text-accent-text">{piece.text}</span>{:else}{piece.text}{/if}{/each}</p>
		</div>
	{/each}
</section>

<div class="mt-6 divide-y divide-border-subtle border-t border-border-subtle">
	{#if result.openQuestions && result.openQuestions.length > 0}
		<section class="py-6">
			<h3 class="flex items-center gap-2 type-h4">
				Details to fill in
				<span class="type-meta rounded-pill bg-surface-2 px-2 py-0.5 text-text-tertiary">
					{result.openQuestions.length}
				</span>
			</h3>
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

	{#if result.draftNotes && result.draftNotes.length > 0}
		<section class="py-6">
			<h3 class="flex items-center gap-2 type-h4">
				Check before you use this
				<span class="type-meta rounded-pill bg-surface-2 px-2 py-0.5 text-text-tertiary">
					{result.draftNotes.length}
				</span>
			</h3>
			<ul class="mt-4 space-y-2.5">
				{#each result.draftNotes as note}
					<li class="flex gap-2 text-body text-text-secondary">
						<span class="text-text-muted" aria-hidden="true">·</span>
						{note}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>

<div class="flex flex-wrap items-center justify-between gap-4 border-t border-border-subtle pt-4">
	<div class="flex items-center gap-2">
		<button
			type="button"
			onclick={copy}
			class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
		>
			<Icon name={copied ? 'check' : 'copy'} size={14} />
			{copied ? 'Copied' : 'Copy draft'}
		</button>
		<button
			type="button"
			onclick={download}
			class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
		>
			<Icon name="fileText" size={14} />
			Download .txt
		</button>
		<ReadAloud {id} script={() => draftScript(result)} />
	</div>
	<p class="max-w-sm text-right text-caption text-text-tertiary">
		A study draft, not a document ready to file. Have an advocate review it before it is used.
	</p>
</div>
