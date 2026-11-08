<script lang="ts">
	import Icon from './Icon.svelte';

	type Props = { stage: 'verifying' | 'analyzing' | null };
	let { stage }: Props = $props();

	let steps = $derived([
		{
			label: 'Reading the facts',
			note: stage === 'verifying' ? 'checking legal context' : '',
			state: stage === 'analyzing' ? 'done' : 'active'
		},
		{
			label: 'Spotting issues, doctrines, precedents and acts',
			note: '',
			state: stage === 'analyzing' ? 'active' : 'pending'
		}
	]);
</script>

<section role="status" aria-live="polite" class="mx-auto w-full max-w-3xl px-6 py-12">
	<div class="flex items-start gap-4">
		<span class="grid size-10 shrink-0 place-items-center rounded-pill bg-surface-2 text-text-secondary">
			<Icon name="loader" size={18} class="spin" />
		</span>
		<div>
			<h2 class="type-h4">Spotting issues</h2>
			<p class="type-body text-text-tertiary">
				Working through the facts you provided. This usually takes a few seconds.
			</p>
		</div>
	</div>

	<ol class="mt-8 ml-5 space-y-5 border-l border-border-default pl-8">
		{#each steps as step}
			<li class="relative">
				<span
					class="absolute top-0.5 -left-[2.625rem] grid size-5 place-items-center rounded-pill border border-border-default bg-bg text-text-secondary"
				>
					{#if step.state === 'done'}
						<Icon name="check" size={12} />
					{:else if step.state === 'active'}
						<Icon name="loader" size={12} class="spin" />
					{/if}
				</span>
				<p
					class="type-body {step.state === 'pending' ? 'text-text-muted' : 'text-text-primary'}"
				>
					{step.label}
					{#if step.note}
						<span class="type-meta ml-2 text-text-tertiary">{step.note}</span>
					{/if}
				</p>
			</li>
		{/each}
	</ol>
</section>
