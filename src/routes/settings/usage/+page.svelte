<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { recentDays } from '#lib/activity.js';
	import { activityStore } from '#lib/activity.svelte.js';
	import { auth } from '#lib/auth.svelte.js';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import RecentUsageChart from '#lib/components/RecentUsageChart.svelte';
	import { SITE_NAME } from '#lib/site.js';
	import { describeReset, leftShare, limitRows } from '#lib/usage.js';
	import { workspace } from '#lib/workspace.svelte.js';

	/** The times and the history are the browser's, so nothing is drawn until the page is in one. */
	let now = $state(0);
	onMount(() => (now = Date.now()));

	// Read the limits afresh whenever someone is signed in here, so the figures are not stale.
	$effect(() => {
		if (auth.user && now) untrack(() => workspace.refreshQuota());
	});
	$effect(() => {
		auth.user;
		if (now) activityStore.sync();
	});

	const PLANS = { free: 'Free', investigative: 'Investigative', researcher: 'Researcher' } as const;
	let resolved = $derived(auth.changes > 0);
	let rows = $derived(limitRows({ searches: workspace.liveQuota, research: workspace.researchQuota, compare: workspace.compareQuota, verify: workspace.verifyQuota }));
	let recent = $derived(recentDays(activityStore.data, now, 30));
</script>

<svelte:head>
	<title>Usage · Settings · {SITE_NAME}</title>
</svelte:head>

<h2 class="type-h2 font-bold">Usage</h2>

{#if !resolved || !now}
	<p class="py-16 text-center text-body text-text-tertiary" aria-live="polite">Loading your usage…</p>
{:else if !auth.user}
	<section class="flex flex-col items-start gap-3 py-2">
		<p class="max-w-md text-body text-text-secondary">Sign in to see your plan limits and how much you have used.</p>
		{#if auth.configured}
			<Button variant="primary" class="gap-2 px-4 py-2.5" onclick={() => auth.openDialog()}>
				<Icon name="logIn" />
				Sign In for Free
			</Button>
		{/if}
	</section>
{:else}
	<section class="flex flex-col gap-3" aria-labelledby="limits-title">
		<div class="flex flex-col gap-0.5">
			<h3 id="limits-title" class="text-lg font-medium text-text-primary">Plan limits</h3>
			<p class="text-body text-text-secondary">
				Searches come back every day, and the rest every month. You are on the
				<span class="rounded-pill border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary">{PLANS[workspace.tier]}</span>
				plan.
			</p>
		</div>

		{#if rows.length === 0}
			<p class="rounded-xl border border-border-subtle bg-surface-1 px-4 py-6 text-body text-text-tertiary" aria-live="polite">Reading your limits…</p>
		{:else}
			<ul class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>li+li]:border-t [&>li+li]:border-border-subtle">
				{#each rows as row (row.key)}
					{@const share = leftShare(row)}
					<li class="flex flex-col gap-2 px-4 py-3">
						<div class="flex items-baseline justify-between gap-4">
							<div class="flex min-w-0 flex-col">
								<span class="text-body font-medium text-text-primary">{row.label}</span>
								<span class="text-caption text-text-tertiary">{row.detail}</span>
							</div>
							<span class="shrink-0 text-body tabular-nums {row.remaining === 0 ? 'text-danger' : 'text-text-primary'}">
								{row.remaining === 0 ? 'Limit reached' : `${row.remaining.toLocaleString()} of ${row.limit.toLocaleString()} left`}
							</span>
						</div>
						<div
							role="progressbar"
							aria-label="{row.label}: {row.remaining} of {row.limit} left"
							aria-valuemin="0"
							aria-valuemax={row.limit}
							aria-valuenow={row.remaining}
							class="h-1.5 overflow-hidden rounded-pill bg-heat-0"
						>
							<div class="h-full rounded-pill bg-text-primary" style="width: {Math.round(share * 100)}%"></div>
						</div>
						<span class="text-caption text-text-tertiary">{describeReset(row.resetsAt, now)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="recent-title">
		<div class="flex flex-col gap-0.5">
			<h3 id="recent-title" class="text-lg font-medium text-text-primary">Recent usage</h3>
			<p class="text-body text-text-secondary">The analyses you ran in the last 30 days. They are counted in this browser only.</p>
		</div>
		<div class="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface-1 px-4 pt-3.5 pb-4">
			<p class="text-2xl font-medium text-text-primary tabular-nums">
				{recent.total.toLocaleString()}
				<span class="text-body font-normal text-text-tertiary">{recent.total === 1 ? 'analysis' : 'analyses'}</span>
			</p>
			{#if recent.total === 0}
				<p class="py-6 text-center text-caption text-text-tertiary">No analyses in the last 30 days yet.</p>
			{:else}
				<RecentUsageChart activity={activityStore.data} {now} />
			{/if}
		</div>
		<a href="/profile" class="inline-flex w-fit items-center gap-1 text-body text-text-secondary hover:text-text-primary">
			View your profile
			<Icon name="chevronRight" size={15} />
		</a>
	</section>
{/if}
