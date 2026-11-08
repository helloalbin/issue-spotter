<script lang="ts">
	import { featureHistory, levelOf, skillHistory, topActs } from '#lib/activity.js';
	import type { Activity, FeatureRow } from '#lib/activity.js';
	import { SKILLS } from '#lib/skills.js';

	type Props = { activity: Activity; now: number };
	let { activity, now }: Props = $props();

	type Period = 7 | 30;
	const PERIODS: Period[] = [7, 30];
	let historyDays = $state<Period>(30);
	let skillDays = $state<Period>(30);

	let history = $derived(featureHistory(activity, now, historyDays));
	let used = $derived(history.rows.reduce((sum, row) => sum + row.total, 0));
	let skills = $derived(skillHistory(activity, now, skillDays));
	let mostUsed = $derived(Math.max(1, ...skills.map((skill) => skill.total)));
	let acts = $derived(topActs(activity));
	const skillLabel = (id: string) => SKILLS.find((skill) => skill.id === id)?.label ?? id;

	/** Each day is a column of the same squares as the activity grids, filled from the bottom; every feature is scaled to the busiest day of any feature, so the rows can be compared. */
	const ROWS = 7;
	const LEVEL = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-text-primary'];
	const filled = (count: number) => (count > 0 ? Math.min(ROWS, Math.ceil((count / history.tallest) * ROWS)) : 0);
	const noun = (row: FeatureRow, n: number) => `${n.toLocaleString()} ${row.nouns[n === 1 ? 0 : 1]}`;

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

{#snippet period(value: Period, set: (next: Period) => void, label: string)}
	<div role="group" aria-label={label} class="flex gap-0.5 rounded-md border border-border-subtle bg-surface-2 p-[3px]">
		{#each PERIODS as days}
			<button
				type="button"
				aria-pressed={value === days}
				onclick={() => (set(days), (tip = null))}
				class="rounded-sm px-[11px] py-[5px] text-caption transition {value === days ? 'bg-surface-3 text-text-primary' : 'text-text-tertiary hover:text-text-primary'}"
			>
				{days}d
			</button>
		{/each}
	</div>
{/snippet}

<div bind:this={card} bind:clientWidth={cardWidth} class="relative flex flex-col gap-10" onmouseleave={() => (tip = null)} role="presentation">
	<section class="flex flex-col gap-3" aria-labelledby="history-title">
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-0.5">
				<h3 id="history-title" class="text-lg font-medium text-text-primary">Usage history</h3>
				<p class="text-body text-text-secondary">What you ran, by feature, over time. Counted in this browser only.</p>
			</div>
			{@render period(historyDays, (next) => (historyDays = next), 'Usage history period')}
		</div>

		{#if used === 0}
			<p class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-8 text-center text-body text-text-tertiary">
				No analyses, drafts or other runs in the last {historyDays} days.
			</p>
		{:else}
			<ul class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>li+li]:border-t [&>li+li]:border-border-subtle">
				{#each history.rows as row (row.kind)}
					<li class="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[150px_1fr]">
						<div class="flex flex-col">
							<span class="text-body font-medium text-text-primary">{row.label}</span>
							<span class="text-caption text-text-tertiary tabular-nums">{noun(row, row.total)}{row.total > 0 ? ` · ${row.share}%` : ''}</span>
						</div>
						<div class="grid gap-[3px]" style="grid-template-columns: repeat({row.counts.length}, minmax(0, 1fr))" aria-hidden="true">
							{#each row.counts as count, day}
								{@const lit = filled(count)}
								{@const level = levelOf(count, history.tallest)}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="flex flex-col-reverse gap-[3px]"
									onpointerenter={(event) => show(event, history.labels[day], noun(row, count))}
									onpointerdown={(event) => show(event, history.labels[day], noun(row, count))}
								>
									{#each { length: ROWS } as _, cell}
										<div class="h-[5px] rounded-[2px] {cell < lit ? LEVEL[level] : LEVEL[0]}"></div>
									{/each}
								</div>
							{/each}
						</div>
					</li>
				{/each}
			</ul>
			{#if history.unsplit > 0}
				<p class="text-caption text-text-tertiary">
					{history.unsplit.toLocaleString()} earlier {history.unsplit === 1 ? 'run was' : 'runs were'} recorded before features were counted, so
					{history.unsplit === 1 ? 'it is' : 'they are'} not shown here.
				</p>
			{/if}
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="skills-title">
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-0.5">
				<h3 id="skills-title" class="text-lg font-medium text-text-primary">Skills used</h3>
				<p class="text-body text-text-secondary">Which skills you switched on, and how often.</p>
			</div>
			{@render period(skillDays, (next) => (skillDays = next), 'Skills period')}
		</div>
		{#if skills.length === 0}
			<p class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-8 text-center text-body text-text-tertiary">
				No skills used in the last {skillDays} days.
			</p>
		{:else}
			<ul class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>li+li]:border-t [&>li+li]:border-border-subtle">
				{#each skills as skill, at (skill.id)}
					<li class="flex flex-col gap-2 px-4 py-3">
						<div class="flex items-baseline justify-between gap-4">
							<span class="text-body font-medium text-text-primary">{skillLabel(skill.id)}</span>
							<span class="text-body text-text-primary tabular-nums">{skill.total.toLocaleString()} {skill.total === 1 ? 'time' : 'times'}</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-pill bg-heat-0" role="presentation">
							<div class="h-full rounded-pill {at === 0 ? 'bg-text-primary' : 'bg-heat-3'}" style="width: {Math.max(4, Math.round((skill.total / mostUsed) * 100))}%"></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="acts-title">
		<div class="flex flex-col gap-0.5">
			<h3 id="acts-title" class="text-lg font-medium text-text-primary">Most cited acts</h3>
			<p class="text-body text-text-secondary">The acts that came up most across your analyses.</p>
		</div>
		{#if acts.length === 0}
			<p class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-8 text-center text-body text-text-tertiary">No acts yet.</p>
		{:else}
			<ul class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>li+li]:border-t [&>li+li]:border-border-subtle">
				{#each acts as act, at (act.name)}
					<li class="flex flex-col gap-2 px-4 py-3">
						<div class="flex items-baseline justify-between gap-4">
							<span class="min-w-0 truncate text-body font-medium text-text-primary" title={act.name}>{act.name}</span>
							<span class="shrink-0 text-body text-text-primary tabular-nums">{act.count.toLocaleString()} · {act.pct}%</span>
						</div>
						<div class="h-1.5 overflow-hidden rounded-pill bg-heat-0" role="presentation">
							<div class="h-full rounded-pill {at === 0 ? 'bg-text-primary' : 'bg-heat-3'}" style="width: {Math.max(4, act.pct)}%"></div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

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
