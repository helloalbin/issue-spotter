<script lang="ts">
	import Icon from './Icon.svelte';

	type Props = { stage: 'checking' | 'searching' | null };
	let { stage }: Props = $props();

	let steps = $derived([
		{ label: 'Checking the topic belongs to your case', done: stage === 'searching' },
		{ label: 'Searching court and statute sites', done: false }
	]);
</script>

<section class="mx-auto w-full max-w-3xl px-6 py-8" aria-live="polite" aria-label="Researching">
	<p class="type-meta tracking-widest text-accent-text">RESEARCHING</p>
	<ul class="mt-4 space-y-2.5">
		{#each steps as step, at}
			{@const active = !step.done && (at === 0 ? stage === 'checking' : stage === 'searching')}
			<li class="flex items-center gap-2.5 text-body {active || step.done ? 'text-text-primary' : 'text-text-tertiary'}">
				{#if step.done}
					<Icon name="check" size={14} class="text-accent-text" />
				{:else if active}
					<Icon name="loader" size={14} class="spin text-accent-text" />
				{:else}
					<span class="size-3.5 rounded-pill border border-border-default"></span>
				{/if}
				{step.label}
			</li>
		{/each}
	</ul>
	<p class="mt-4 text-caption text-text-tertiary">This can take a minute or two.</p>
</section>
