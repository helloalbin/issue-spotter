<script lang="ts">
	import { heatmap, weekly } from '#lib/activity.js';
	import type { Activity } from '#lib/activity.js';

	type Props = { activity: Activity; now: number };
	let { activity, now }: Props = $props();

	type View = 'daily' | 'weekly' | 'cumulative';
	const VIEWS: { id: View; label: string }[] = [
		{ id: 'daily', label: 'Daily' },
		{ id: 'weekly', label: 'Weekly' },
		{ id: 'cumulative', label: 'Cumulative' }
	];
	let view = $state<View>('daily');

	let map = $derived(heatmap(activity, now));
	let year = $derived(weekly(activity, now));
	/** Each week's bar for the view on show: runs that week, or the running total, with the words for its tooltip. */
	let shown = $derived(
		year.bars.map((bar) =>
			view === 'cumulative'
				? { title: bar.through, value: bar.total, row: bar.label }
				: { title: bar.label, value: bar.count, row: bar.label }
		)
	);
	let tallest = $derived(Math.max(1, ...shown.map((bar) => bar.value)));
	/** Days with activity, for people who cannot see colour. */
	let activeDays = $derived(map.columns.flat().filter((cell) => cell.count > 0));

	const LEVEL = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-text-primary'];
	const plural = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'analysis' : 'analyses'}`;
	const dateLabel = (key: string) => {
		const [y, m, d] = key.split('-').map(Number);
		const sameYear = y === new Date(now).getFullYear();
		return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
	};

	let card = $state<HTMLDivElement>();
	let tip = $state<{ x: number; y: number; title: string; value: string } | null>(null);
	let tipWidth = $state(0);
	let cardWidth = $state(0);
	/** The tooltip centred over what is pointed at, but kept inside the card whatever its wording. */
	let tipLeft = $derived(tip ? Math.max(tipWidth / 2, Math.min(cardWidth - tipWidth / 2, tip.x)) : 0);

	/** Shows the tooltip above whatever the pointer is on, inside the card. */
	function show(event: Event, title: string, value: string) {
		const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const outer = card!.getBoundingClientRect();
		tip = { x: box.left - outer.left + box.width / 2, y: box.top - outer.top, title, value };
	}
</script>

<div class="flex flex-col gap-3.5">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-md font-semibold text-text-primary">Analysis activity</h2>
		<div role="tablist" aria-label="Activity view" class="flex gap-0.5 rounded-md border border-border-subtle bg-surface-2 p-[3px]">
			{#each VIEWS as entry}
				<button
					type="button"
					role="tab"
					aria-selected={view === entry.id}
					onclick={() => ((view = entry.id), (tip = null))}
					class="rounded-sm px-[11px] py-[5px] text-caption transition {view === entry.id ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-primary'}"
				>
					{entry.label}
				</button>
			{/each}
		</div>
	</div>

	<div bind:this={card} bind:clientWidth={cardWidth} class="relative rounded-lg border border-border-subtle bg-surface-1 p-4" onmouseleave={() => (tip = null)} role="presentation">
		{#if view === 'daily'}
			<div class="overflow-x-auto">
				<div class="flex min-w-[640px] flex-col gap-2.5" role="img" aria-label="{plural(map.total)} in the last 12 months, on {activeDays.length} {activeDays.length === 1 ? 'day' : 'days'}">
					<div class="grid px-0.5" style="grid-template-columns: repeat({map.columns.length}, minmax(0, 1fr))" aria-hidden="true">
						{#each map.months as month}
							<span class="text-[10px] leading-none whitespace-nowrap text-text-muted" style="grid-column: {month.column + 1}">{month.label}</span>
						{/each}
					</div>
					<div class="grid gap-[3px]" style="grid-template-rows: repeat(7, 11px); grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)" aria-hidden="true">
						{#each map.columns as column}
							{#each column as cell}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="rounded-[2px] {cell.future ? 'invisible' : LEVEL[cell.level]}"
									onpointerenter={(event) => !cell.future && show(event, dateLabel(cell.date), plural(cell.count))}
									onpointerdown={(event) => !cell.future && show(event, dateLabel(cell.date), plural(cell.count))}
								></div>
							{/each}
						{/each}
					</div>
				</div>
			</div>
			<table class="sr-only">
				<caption>Analyses per day over the last 12 months</caption>
				<thead><tr><th>Day</th><th>Analyses</th></tr></thead>
				<tbody>
					{#each activeDays as cell}
						<tr><td>{dateLabel(cell.date)}</td><td>{cell.count}</td></tr>
					{:else}
						<tr><td colspan="2">No analyses yet.</td></tr>
					{/each}
				</tbody>
			</table>
		{:else}
			<div class="overflow-x-auto">
				<div class="flex min-w-[640px] flex-col gap-2.5" aria-hidden="true">
					<div class="grid px-0.5" style="grid-template-columns: repeat({shown.length}, minmax(0, 1fr))">
						{#each year.months as month}
							<span class="text-[10px] leading-none whitespace-nowrap text-text-muted" style="grid-column: {month.column + 1}">{month.label}</span>
						{/each}
					</div>
					<div class="grid h-24 gap-[3px]" style="grid-template-columns: repeat({shown.length}, minmax(0, 1fr))">
						{#each shown as bar}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="flex items-end rounded-[2px] bg-heat-0"
								onpointerenter={(event) => show(event, bar.title, plural(bar.value))}
								onpointerdown={(event) => show(event, bar.title, plural(bar.value))}
							>
								<div
									class="w-full rounded-[2px] {bar.value === tallest ? 'bg-text-primary' : 'bg-heat-3'}"
									style="height: {bar.value > 0 ? Math.max(6, (bar.value / tallest) * 100) : 0}%"
								></div>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<table class="sr-only">
				<caption>{view === 'weekly' ? 'Analyses per week' : 'Analyses in total, by week'}, last 12 months</caption>
				<thead><tr><th>Week</th><th>{view === 'weekly' ? 'Analyses' : 'Total so far'}</th></tr></thead>
				<tbody>
					{#each shown as bar}
						<tr><td>{bar.row}</td><td>{bar.value}</td></tr>
					{/each}
				</tbody>
			</table>
		{/if}

		{#if tip}
			<div
				class="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-px rounded-md border border-border-default bg-surface-3 px-3 py-[9px] whitespace-nowrap shadow-overlay"
				bind:clientWidth={tipWidth}
				style="left: {tipLeft}px; top: {tip.y - 6}px"
				role="status"
			>
				<span class="text-[13px] text-text-primary">{tip.title}</span>
				<span class="text-caption text-text-tertiary">{tip.value}</span>
			</div>
		{/if}
	</div>
</div>
