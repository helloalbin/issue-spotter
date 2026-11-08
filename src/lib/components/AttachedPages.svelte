<script lang="ts">
	import Icon from './Icon.svelte';

	type Props = { pages: { kind: 'page' | 'file'; title: string; url?: string; truncated?: boolean }[] };
	let { pages }: Props = $props();

	const chip =
		'inline-flex max-w-64 items-center gap-1.5 rounded-pill border border-border-subtle px-2.5 py-0.5 text-caption text-text-tertiary';
</script>

{#if pages.length > 0}
	<ul class="mt-2 flex flex-wrap gap-2">
		{#each pages as page}
			<li>
				{#if page.kind === 'page' && page.url}
					<a
						href={page.url}
						target="_blank"
						rel="noopener noreferrer"
						class="{chip} hover:text-text-primary"
					>
						<Icon name="globe" size={11} class="shrink-0" />
						<span class="truncate">{page.title}</span>
						<span class="sr-only">(opens in a new tab)</span>
					</a>
				{:else}
					<span class={chip}>
						<Icon name="fileText" size={11} class="shrink-0" />
						<span class="truncate">{page.title}</span>
						{#if page.truncated}<span class="shrink-0">· partial</span>{/if}
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}
