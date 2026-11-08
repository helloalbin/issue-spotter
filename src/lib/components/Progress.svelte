<script lang="ts">
	import type { SpotSection, Streamed } from '#lib/spotter.js';
	import Icon from './Icon.svelte';

	type Props = { stage: 'verifying' | 'analyzing' | null; streamed: Streamed; closed: SpotSection[] };
	let { stage, streamed, closed }: Props = $props();

	const sections = [
		{ key: 'issues', label: 'Identifying primary legal issues' },
		{ key: 'doctrines', label: 'Matching governing doctrines' },
		{ key: 'precedents', label: 'Finding landmark precedents' },
		{ key: 'acts', label: 'Locating applicable acts & sections' }
	] as const;

	type State = 'done' | 'active' | 'pending';

	let reading = $derived(stage === 'analyzing');
	let steps = $derived.by(() => {
		const firstOpen = sections.findIndex((section) => !closed.includes(section.key));
		const rows: { label: string; state: State; note: string; items: string[] }[] = [
			{
				label: 'Reading the facts',
				state: reading ? 'done' : 'active',
				note: reading ? 'done' : stage === 'verifying' ? 'checking legal context' : '',
				items: []
			}
		];

		sections.forEach((section, index) => {
			const items =
				section.key === 'acts'
					? streamed.acts.map((entry) => entry.act)
					: section.key === 'precedents'
						? streamed.precedents.map((entry) => entry.name)
						: streamed[section.key];
			rows.push({
				label: section.label,
				state: closed.includes(section.key)
					? 'done'
					: reading && index === firstOpen
						? 'active'
						: 'pending',
				note: items.length > 0 ? `${items.length} found` : '',
				items
			});
		});

		return rows;
	});

	// One short line for screen readers, rather than announcing every entry as it appears.
	let announcement = $derived.by(() => {
		const active = steps.find((step) => step.state === 'active');
		return active ? `${active.label}${active.note ? `, ${active.note}` : ''}` : 'Finishing up';
	});
</script>

<section aria-label="Analysis progress" class="mx-auto w-full max-w-180 px-6 pt-12 pb-10">
	<p class="sr-only" role="status" aria-live="polite">{announcement}</p>

	<div class="flex items-start gap-3">
		<span
			class="grid size-[34px] shrink-0 place-items-center rounded-pill border border-border-default bg-surface-2 text-text-secondary"
		>
			<Icon name="loader" size={17} class="spin" />
		</span>
		<div>
			<h2 class="type-h4">Spotting issues</h2>
			<p class="text-sm text-text-tertiary">
				Working through the facts you provided. This usually takes a few seconds, and you can stop
				anytime.
			</p>
		</div>
	</div>

	<ol class="mt-6" aria-hidden="true">
		{#each steps as step, index (step.label)}
			<li class="flex gap-3">
				<div class="flex w-[18px] shrink-0 flex-col items-center">
					<span class="h-[7px] w-0.5 {index === 0 ? '' : 'bg-border-default'}"></span>
					<span
						class="grid size-4 place-items-center rounded-pill border-[1.5px] {step.state === 'done'
							? 'border-transparent bg-accent-subtle text-accent-text'
							: step.state === 'active'
								? 'border-border-strong bg-surface-3 text-text-primary'
								: 'border-border-default'}"
					>
						{#if step.state === 'done'}
							<Icon name="check" size={10} />
						{:else if step.state === 'active'}
							<Icon name="loader" size={11} class="spin" />
						{/if}
					</span>
					<span
						class="w-0.5 flex-1 {index === steps.length - 1 ? '' : 'bg-border-default'}"
					></span>
				</div>

				<div class="min-w-0 flex-1 {index === steps.length - 1 ? '' : 'pb-[18px]'}">
					<p class="flex items-baseline gap-2 text-sm">
						<span
							class={step.state === 'done'
								? 'text-text-secondary'
								: step.state === 'active'
									? 'font-medium text-text-primary'
									: 'text-text-muted'}
						>
							{step.label}
						</span>
						{#if step.note}
							<span class="font-mono text-[11px] text-text-tertiary">{step.note}</span>
						{/if}
					</p>
					{#if step.items.length > 0}
						<ul class="mt-1.5 space-y-1">
							{#each step.items as item}
								<li class="enter flex items-center gap-2 text-caption text-text-tertiary">
									<span class="size-[3px] shrink-0 rounded-pill bg-text-muted"></span>
									{item}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</section>
