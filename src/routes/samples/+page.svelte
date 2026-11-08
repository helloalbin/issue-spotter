<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '#lib/components/Button.svelte';
	import ContentPage from '#lib/components/ContentPage.svelte';
	import { SAMPLES } from '#lib/samples.js';
	import { workspace } from '#lib/workspace.svelte.js';

	function useSample(facts: string) {
		workspace.clearAll();
		workspace.fillSample(facts);
		goto('/');
	}
</script>

<ContentPage
	title="Sample cases"
	lead="Hypothetical fact patterns to try. Pick one to load it into the composer, then change it however you like."
	prose={false}
>
	<ul class="space-y-4">
		{#each SAMPLES as sample}
			<li class="rounded-xl border border-border-default bg-surface-1 p-5 shadow-raised">
				<h2 class="type-h4">{sample.label}</h2>
				<p class="mt-2 text-text-secondary">{sample.facts}</p>
				<Button class="mt-4" onclick={() => useSample(sample.facts)}>Use this sample</Button>
			</li>
		{/each}
	</ul>
</ContentPage>
