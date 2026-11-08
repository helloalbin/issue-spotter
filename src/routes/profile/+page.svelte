<script lang="ts">
	import { onMount } from 'svelte';
	import { formatDuration, topShare, totalsOf } from '#lib/activity.js';
	import { activityStore } from '#lib/activity.svelte.js';
	import { auth } from '#lib/auth.svelte.js';
	import ActivityChart from '#lib/components/ActivityChart.svelte';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { IconName } from '#lib/icons.js';
	import { SITE_NAME } from '#lib/site.js';
	import { SKILLS } from '#lib/skills.js';
	import { workspace } from '#lib/workspace.svelte.js';

	/** The activity is read from this browser, so nothing is drawn until the page is in one. */
	let now = $state(0);
	let confirming = $state(false);
	onMount(() => (now = Date.now()));

	// Whoever is acting decides whose tally is shown.
	$effect(() => {
		auth.user;
		if (now) activityStore.sync();
	});

	const PLANS = { free: 'Free', investigative: 'Investigative', researcher: 'Researcher' } as const;
	let name = $derived(auth.user?.name ?? auth.user?.email ?? '');
	let handle = $derived(auth.user?.email?.split('@')[0] ?? '');
	let data = $derived(activityStore.data);
	let totals = $derived(totalsOf(data, now));
	let jurisdiction = $derived(topShare(data.jurisdictions));
	let act = $derived(topShare(data.acts));
	let resolved = $derived(auth.changes > 0);
	let empty = $derived(totals.analyses === 0);
	const skillCount = SKILLS.filter((skill) => skill.available).length;

	const SOURCES: { name: string; sub: string; icon: IconName }[] = [
		{ name: 'Indian Kanoon', sub: 'Case law & statutes', icon: 'scale' },
		{ name: 'Supreme Court of India', sub: 'Judgments', icon: 'landmark' },
		{ name: 'India Code', sub: 'Central Acts', icon: 'bookMarked' },
		{ name: 'High Courts', sub: 'Judgments', icon: 'gavel' }
	];

	const stats = $derived([
		{ label: 'Analyses run', value: totals.analyses.toLocaleString() },
		{ label: 'Issues spotted', value: totals.issues.toLocaleString() },
		{ label: 'Longest run', value: formatDuration(totals.longestMs) },
		{ label: 'Longest streak', value: `${totals.longestStreak} ${totals.longestStreak === 1 ? 'day' : 'days'}` },
		{ label: 'Current streak', value: `${totals.currentStreak} ${totals.currentStreak === 1 ? 'day' : 'days'}` }
	]);
</script>

<svelte:head>
	<title>Profile · {SITE_NAME}</title>
</svelte:head>

<main id="main" class="relative flex-1 overflow-y-auto overscroll-contain">
	<div class="mx-auto flex w-full max-w-[820px] flex-col gap-[30px] px-5 pt-[22px] pb-12 sm:px-10">
		{#if !resolved || !now}
			<p class="py-24 text-center text-body text-text-tertiary" aria-live="polite">Loading your profile…</p>
		{:else if !auth.user}
			<section class="flex flex-col items-center gap-3 py-20 text-center">
				<h1 class="type-h2 font-semibold">Your profile</h1>
				<p class="max-w-sm text-body text-text-secondary">
					Sign in to see your activity: analyses run, streaks and the acts you work with most.
				</p>
				{#if auth.configured}
					<Button variant="primary" class="mt-2 gap-2 px-4 py-2.5" onclick={() => auth.openDialog()}>
						<Icon name="logIn" />
						Sign In for Free
					</Button>
				{/if}
			</section>
		{:else}
			<section class="flex flex-col items-center gap-3 text-center" aria-label="Profile">
				<span
					class="grid size-[76px] place-items-center rounded-pill bg-linear-135 from-avatar-from to-avatar-to text-[30px] font-semibold text-avatar-fg"
					aria-hidden="true"
				>
					{name.charAt(0).toUpperCase()}
				</span>
				<h1 class="type-h2 font-semibold">{name}</h1>
				<p class="flex items-center gap-2">
					<span class="text-[13px] text-text-tertiary">@{handle}</span>
					<span class="rounded-pill border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] text-text-secondary">
						{PLANS[workspace.tier]}
					</span>
				</p>
			</section>

			<dl class="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-subtle bg-border-subtle sm:grid-cols-5" aria-label="Your numbers">
				{#each stats as stat}
					<div class="flex flex-col-reverse items-center gap-[3px] bg-surface-1 px-2.5 py-4 text-center [&:last-child]:col-span-2 sm:[&:last-child]:col-span-1">
						<dt class="text-caption text-text-tertiary">{stat.label}</dt>
						<dd class="text-lg font-semibold text-text-primary tabular-nums">{stat.value}</dd>
					</div>
				{/each}
			</dl>

			{#if empty}
				<p class="-mt-2 text-center text-body text-text-tertiary">
					Nothing here yet. Your activity appears after your first analysis.
				</p>
			{/if}

			<ActivityChart activity={data} {now} />

			<section class="flex flex-col gap-3" aria-labelledby="sources-title">
				<h2 id="sources-title" class="text-md font-semibold text-text-primary">Sources we read</h2>
				<ul class="grid gap-2.5 sm:grid-cols-2">
					{#each SOURCES as source}
						{@const count = data.sites[source.name] ?? 0}
						<li class="flex items-center gap-[11px] rounded-lg border border-border-subtle bg-surface-1 px-3.5 py-3">
							<span class="grid size-[34px] shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-2 text-text-secondary">
								<Icon name={source.icon} size={17} />
							</span>
							<span class="flex min-w-0 flex-1 flex-col gap-px">
								<span class="truncate text-body text-text-primary">{source.name}</span>
								<span class="truncate text-caption text-text-tertiary">{source.sub}</span>
							</span>
							<span class="flex shrink-0 items-center gap-1.5 text-caption {count > 0 ? 'text-success-text' : 'text-text-tertiary'}">
								<span class="size-[7px] rounded-pill {count > 0 ? 'bg-success' : 'bg-heat-2'}" aria-hidden="true"></span>
								{count > 0 ? `${count.toLocaleString()} ${count === 1 ? 'page' : 'pages'} read` : 'Not read yet'}
							</span>
						</li>
					{/each}
				</ul>
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="insights-title">
				<h2 id="insights-title" class="text-md font-semibold text-text-primary">Insights</h2>
				<dl class="flex flex-col rounded-lg border border-border-subtle bg-surface-1 px-4 py-1 [&>div+div]:border-t [&>div+div]:border-border-subtle">
					{#each [
						{ k: 'Primary jurisdiction', v: jurisdiction ? jurisdiction.name : '—' },
						{ k: 'Most cited act', v: act ? `${act.name} · ${act.pct}%` : '—' },
						{ k: 'Citations checked', v: totals.citations.toLocaleString() },
						{ k: 'Skills used', v: `${totals.skillsUsed} of ${skillCount}` }
					] as row}
						<div class="flex items-baseline justify-between gap-6 py-[13px]">
							<dt class="text-body text-text-secondary">{row.k}</dt>
							<dd class="text-right text-body text-text-primary">{row.v}</dd>
						</div>
					{/each}
				</dl>
			</section>

			<section class="flex flex-col items-start gap-2 border-t border-border-subtle pt-5" aria-label="Data on this device">
				<p class="text-caption leading-snug text-text-tertiary">
					These numbers are kept in this browser only. They do not follow you to another device, and
					clearing this site's data removes them. Nothing here is sent to us.
				</p>
				{#if confirming}
					<p class="flex flex-wrap items-center gap-3 text-sm text-text-secondary" role="alert">
						Clear all of your activity data on this device?
						<Button variant="primary" class="px-3 py-1.5" onclick={() => (activityStore.reset(), (confirming = false))}>Yes, clear it</Button>
						<Button variant="ghost" class="px-3 py-1.5" onclick={() => (confirming = false)}>Cancel</Button>
					</p>
				{:else}
					<Button variant="ghost" class="-ml-3 px-3 py-1.5" onclick={() => (confirming = true)} disabled={empty && totals.citations === 0}>
						Reset my activity data
					</Button>
				{/if}
			</section>
		{/if}
	</div>
</main>
