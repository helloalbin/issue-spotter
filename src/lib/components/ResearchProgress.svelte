<script lang="ts">
	import Icon from './Icon.svelte';

	type Mode = 'research' | 'identify' | 'compare';
	type Props = { mode?: Mode; stage: string | null };
	let { mode = 'research', stage }: Props = $props();

	const STEPS: Record<Mode, { stage: string; label: string }[]> = {
		research: [
			{ stage: 'checking', label: 'Checking the topic belongs to your case' },
			{ stage: 'searching', label: 'Searching court and statute sites' },
			{ stage: 'reading', label: 'Opening the cited pages and choosing the relevant passages' },
			{ stage: 'writing', label: 'Writing the report and checking every quote against its page' }
		],
		identify: [{ stage: 'identifying', label: 'Finding the two cases and checking their pages' }],
		compare: [
			{ stage: 'opening', label: 'Opening both judgments' },
			{ stage: 'treatment', label: 'Looking for decisions that overturned either' },
			{ stage: 'reading', label: 'Choosing the passages on facts and on what each court decided' },
			{ stage: 'writing', label: 'Writing the comparison and checking every quote against its page' }
		]
	};
	let steps = $derived(STEPS[mode]);
	let current = $derived(mode === 'identify' ? 0 : steps.findIndex((step) => step.stage === stage));
	let heading = $derived(mode === 'research' ? 'RESEARCHING' : mode === 'identify' ? 'FINDING THE CASES' : 'COMPARING');
</script>

<section class="mx-auto w-full max-w-3xl px-6 py-8" aria-live="polite" aria-label={heading.toLowerCase()}>
	<p class="type-meta tracking-widest text-accent-text">{heading}</p>
	<ul class="mt-4 space-y-2.5">
		{#each steps as step, at}
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
	<p class="mt-4 text-caption text-text-tertiary">
		{mode === 'identify' ? 'This takes a few seconds.' : 'This can take a minute or two.'}
	</p>
</section>
