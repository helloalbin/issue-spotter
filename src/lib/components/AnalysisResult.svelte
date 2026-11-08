<script lang="ts">
	import { toMarkdown } from '#lib/markdown.js';
	import type { SpotterResult } from '#lib/spotter.js';
	import Chip from './Chip.svelte';
	import Icon from './Icon.svelte';

	type Props = { facts: string; result: SpotterResult; onEdit: () => void };
	let { facts, result, onEdit }: Props = $props();

	let copied = $state<'facts' | 'markdown' | null>(null);

	const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
	let summary = $derived(
		[
			count(result.issues.length, 'issue'),
			count(result.doctrines.length, 'doctrine'),
			count(result.precedents.length, 'precedent'),
			count(result.acts.length, 'act')
		].join(' · ')
	);

	async function copy(kind: 'facts' | 'markdown', text: string) {
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

<article class="mx-auto w-full max-w-3xl px-6 py-8">
	<div class="ml-auto max-w-xl rounded-xl border border-border-default bg-surface-1 p-4">
		<div class="flex items-center justify-between">
			<span class="type-meta tracking-widest text-text-tertiary">CASE FACTS</span>
			<span class="flex items-center gap-3 text-caption text-text-tertiary">
				<button
					type="button"
					onclick={() => copy('facts', facts)}
					class="flex items-center gap-1 hover:text-text-primary"
				>
					<Icon name={copied === 'facts' ? 'check' : 'copy'} size={12} />
					{copied === 'facts' ? 'Copied' : 'Copy'}
				</button>
				<button type="button" onclick={onEdit} class="flex items-center gap-1 hover:text-text-primary">
					<Icon name="pencil" size={12} />
					Edit
				</button>
			</span>
		</div>
		<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{facts}</p>
	</div>

	<header class="mt-8 flex items-center gap-3">
		<span class="grid size-8 place-items-center rounded-pill bg-surface-2 text-text-secondary">
			<Icon name="check" />
		</span>
		<h2 class="type-h3">Issue analysis</h2>
	</header>
	<p class="type-meta mt-2 text-text-tertiary">{summary}</p>

	<div class="mt-6 divide-y divide-border-subtle border-t border-border-subtle">
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
				<ul class="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
					{#each result.precedents as item}
						<li class="flex gap-2 text-body text-text-primary">
							<span class="text-text-muted" aria-hidden="true">·</span>
							{item}
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
					{#each result.acts as entry}
						<li class="rounded-xl border border-border-default bg-surface-1 p-4">
							<h4 class="type-label">{entry.act}</h4>
							{#if entry.sections.length > 0}
								<ul class="mt-2 flex flex-wrap gap-2">
									{#each entry.sections as section}
										<li><Chip mono class="rounded-md px-2 py-0.5 text-text-secondary">{section}</Chip></li>
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
	</div>

	<div class="flex items-center justify-between gap-4 border-t border-border-subtle pt-4">
		<button
			type="button"
			onclick={() => copy('markdown', toMarkdown(facts, result))}
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
