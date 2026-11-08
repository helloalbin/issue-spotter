<script lang="ts">
	import Icon from './Icon.svelte';

	type Stage = 'checking' | 'searching' | 'reading' | 'writing';
	type Props = { stage: Stage | null };
	let { stage }: Props = $props();

	const STEPS: { stage: Stage; label: string }[] = [
		{ stage: 'checking', label: 'Checking the topic belongs to your case' },
		{ stage: 'searching', label: 'Searching court and statute sites' },
		{ stage: 'reading', label: 'Opening the cited pages and choosing the relevant passages' },
		{ stage: 'writing', label: 'Writing the report and checking every quote against its page' }
	];
	let current = $derived(STEPS.findIndex((step) => step.stage === stage));
</script>

<section class="mx-auto w-full max-w-3xl px-6 py-8" aria-live="polite" aria-label="Researching">
	<p class="type-meta tracking-widest text-accent-text">RESEARCHING</p>
	<ul class="mt-4 space-y-2.5">
		{#each STEPS as step, at}
			{@const done = at < current}
			{@const active = at === current}
			<li class="flex items-center gap-2.5 text-body {active || done ? 'text-text-primary' : 'text-text-tertiary'}">
				{#if done}
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
