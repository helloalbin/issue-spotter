<script lang="ts">
	import { levelOf, recentDays } from '#lib/activity.js';
	import type { Activity } from '#lib/activity.js';

	type Props = { activity: Activity; now: number };
	let { activity, now }: Props = $props();

	let recent = $derived(recentDays(activity, now, 30));
	let tallest = $derived(Math.max(1, ...recent.days.map((day) => day.count)));
	const ROWS = 7;
	const LEVEL = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-text-primary'];
	const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'analysis' : 'analyses'}`;
	/** Each day is a column of the same squares as the activity grid, filled from the bottom. */
	const filled = (count: number) => (count > 0 ? Math.min(ROWS, Math.ceil((count / tallest) * ROWS)) : 0);

	let card = $state<HTMLDivElement>();
	let cardWidth = $state(0);
	let tipWidth = $state(0);
	let tip = $state<{ x: number; y: number; title: string; value: string } | null>(null);
	let tipLeft = $derived(tip ? Math.max(tipWidth / 2, Math.min(cardWidth - tipWidth / 2, tip.x)) : 0);

	function show(event: Event, title: string, value: string) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const outer = card!.getBoundingClientRect();
		tip = { x: box.left - outer.left + box.width / 2, y: box.top - outer.top, title, value };
	}
</script>

<div bind:this={card} bind:clientWidth={cardWidth} class="relative" onmouseleave={() => (tip = null)} role="presentation">
	<div class="grid gap-[3px]" style="grid-template-columns: repeat({recent.days.length}, minmax(0, 1fr))" aria-hidden="true">
		{#each recent.days as day}
			{@const count = filled(day.count)}
			{@const level = levelOf(day.count, tallest)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="flex flex-col-reverse gap-[3px]"
				onpointerenter={(event) => show(event, day.label, plural(day.count))}
				onpointerdown={(event) => show(event, day.label, plural(day.count))}
			>
				{#each { length: ROWS } as _, row}
					<div class="h-[11px] rounded-[2px] {row < count ? LEVEL[level] : LEVEL[0]}"></div>
				{/each}
			</div>
		{/each}
	</div>
	<table class="sr-only">
		<caption>Analyses per day over the last 30 days</caption>
		<thead><tr><th>Day</th><th>Analyses</th></tr></thead>
		<tbody>
			{#each recent.days.filter((day) => day.count > 0) as day}
				<tr><td>{day.label}</td><td>{day.count}</td></tr>
			{:else}
				<tr><td colspan="2">No analyses in the last 30 days.</td></tr>
			{/each}
		</tbody>
	</table>

	{#if tip}
		<div
			bind:clientWidth={tipWidth}
			class="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-px rounded-md border border-border-default bg-surface-3 px-3 py-[9px] whitespace-nowrap shadow-overlay"
			style="left: {tipLeft}px; top: {tip.y - 6}px"
			role="status"
		>
			<span class="text-[13px] text-text-primary">{tip.title}</span>
			<span class="text-caption text-text-tertiary">{tip.value}</span>
		</div>
	{/if}
</div>
