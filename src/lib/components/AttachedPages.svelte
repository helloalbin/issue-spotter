<script lang="ts">
	import Icon from './Icon.svelte';

	type Props = { pages: { url: string; title: string }[] };
	let { pages }: Props = $props();
</script>

{#if pages.length > 0}
	<ul class="mt-2 flex flex-wrap gap-2">
		{#each pages as page}
			<li>
				<a
					href={page.url}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex max-w-64 items-center gap-1.5 rounded-pill border border-border-subtle px-2.5 py-0.5 text-caption text-text-tertiary hover:text-text-primary"
				>
					<Icon name="globe" size={11} class="shrink-0" />
					<span class="truncate">{page.title}</span>
					<span class="sr-only">(opens in a new tab)</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
