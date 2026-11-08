<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SITE_NAME } from '#lib/site.js';

	type Props = {
		title: string;
		lead?: string;
		updated?: string;
		/** Styles headings, paragraphs and lists inside as long-form text. */
		prose?: boolean;
		children: Snippet;
	};
	let { title, lead, updated, prose = true, children }: Props = $props();
</script>

<svelte:head>
	<title>{title} · {SITE_NAME}</title>
</svelte:head>

<main id="main" class="relative flex-1 overflow-y-auto overscroll-contain">
	<div class="mx-auto w-full max-w-2xl px-6 pt-4 pb-16">
		<h1 class="type-h1">{title}</h1>
		{#if updated}
			<p class="type-meta mt-3 text-text-tertiary">Last updated {updated}</p>
		{/if}
		{#if lead}
			<p class="type-lead mt-3 text-text-secondary">{lead}</p>
		{/if}

		<div class="type-body {prose ? 'legal' : 'mt-8'}">
			{@render children()}
		</div>
	</div>
</main>
