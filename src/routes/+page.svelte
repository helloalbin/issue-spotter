<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { auth } from '#lib/auth.svelte.js';
	import AnalysisResult from '#lib/components/AnalysisResult.svelte';
	import AttachedPages from '#lib/components/AttachedPages.svelte';
	import Composer from '#lib/components/Composer.svelte';
	import ErrorNotice from '#lib/components/ErrorNotice.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Progress from '#lib/components/Progress.svelte';
	import CompareCard from '#lib/components/CompareCard.svelte';
	import ReadingCard from '#lib/components/ReadingCard.svelte';
	import ResearchCard from '#lib/components/ResearchCard.svelte';
	import ResearchProgress from '#lib/components/ResearchProgress.svelte';
	import { SAMPLES } from '#lib/samples.js';
	import { SITE_NAME } from '#lib/site.js';
	import { workspace } from '#lib/workspace.svelte.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let mounted = $state(false);
	onMount(() => (mounted = true));

	let mainEl = $state<HTMLElement>();

	// A new analysis is brought into view where it starts, so the earlier ones stay above it.
	let seen = 0;
	$effect(() => {
		const count = workspace.thread.length;
		if (count > seen && count > 1) {
			tick().then(() => document.getElementById(`exchange-${count - 1}`)?.scrollIntoView({ block: 'start' }));
		}
		seen = count;
	});

	// While a follow-up is being analysed, show its message and progress at the end of the thread.
	$effect(() => {
		if (workspace.isLoading && workspace.thread.length > 0) {
			tick().then(() => mainEl?.scrollTo({ top: mainEl.scrollHeight }));
		}
	});

	let quota = $derived(workspace.liveQuota ?? data.quota);
	let research = $derived(workspace.researchQuota ?? data.research);
	let compare = $derived(workspace.compareQuota ?? data.compare);
	let outOfSearches = $derived(quota !== null && quota.remaining === 0);
	// Local reset time is only known in the browser, so wait for mount to avoid a hydration mismatch.
	let resetTime = $derived(
		quota && mounted
			? new Date(quota.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
			: 'later today'
	);
</script>

<svelte:head>
	<title>{SITE_NAME}</title>
	<meta
		name="description"
		content="Paste hypothetical case facts and get likely legal issues, doctrines, landmark precedents, and applicable acts with sections."
	/>
</svelte:head>

{#snippet messages()}
	{#if outOfSearches}
		<p class="type-body rounded-lg border border-border-default bg-surface-2 p-3 text-text-secondary">
			{#if quota?.signedIn}
				You have used today's {quota.limit} searches. They reset at {resetTime}. Your text is kept,
				and credits are coming soon.
			{:else if auth.configured}
				You have used today's {quota?.limit} free searches. They reset at {resetTime}. Your text is
				kept.
				<button type="button" onclick={() => auth.openDialog()} class="underline hover:text-text-primary">
					Sign in with Google for more.
				</button>
			{:else}
				You have used today's {quota?.limit} free searches. They reset at {resetTime}. Your text is
				kept, and more access is coming soon.
			{/if}
		</p>
	{/if}

	<div role="status" aria-live="polite">
		{#if workspace.notice}
			<p class="type-body rounded-lg border border-border-default bg-surface-2 p-3 text-text-secondary">
				{workspace.notice}
			</p>
		{/if}
	</div>
{/snippet}

<main id="main" bind:this={mainEl} class="flex-1 overflow-y-auto">
	{#if workspace.thread.length > 0}
		{#each workspace.thread as exchange, index (index)}
			{#if exchange.kind === 'reading'}
				<ReadingCard
					{exchange}
					{index}
					isLast={index === workspace.thread.length - 1 && !workspace.isLoading}
					busy={workspace.isLoading}
					onNext={(action) => workspace.runNext(action)}
					onEdit={() => workspace.editLast()}
				/>
			{:else if exchange.kind === 'compare'}
				<CompareCard
					{exchange}
					{index}
					isLast={index === workspace.thread.length - 1 && !workspace.isLoading}
					busy={workspace.isLoading}
					quota={compare}
					onConfirm={() => workspace.confirmCompare(index)}
					onEdit={() => workspace.editLast()}
				/>
			{:else if exchange.kind === 'research'}
				<ResearchCard
					{exchange}
					{index}
					isLast={index === workspace.thread.length - 1 && !workspace.isLoading}
					onEdit={() => workspace.editLast()}
				/>
			{:else}
				<AnalysisResult
					{exchange}
					{index}
					ordinal={workspace.thread.slice(0, index).filter((earlier) => earlier.kind === 'analysis').length}
					previous={workspace.previousAnalysis(index)?.result ?? null}
					turns={workspace.turnsThrough(index)}
					isLast={index === workspace.thread.length - 1 && !workspace.isLoading}
					onEdit={() => workspace.editLast()}
				/>
			{/if}
		{/each}

		{#if workspace.isLoading}
			{#if workspace.pending}
				<div class="mx-auto w-full max-w-3xl border-t border-border-subtle px-6 pt-8">
					<div class="ml-auto max-w-xl rounded-xl border border-border-subtle bg-surface-2 px-4 py-[13px]">
						<span class="type-meta tracking-widest text-text-tertiary">
							{workspace.identifying ? 'COMPARE CASES' : workspace.researching ? 'DEEP RESEARCH' : 'ADDED TO CASE'}
						</span>
						<p class="type-body mt-2 whitespace-pre-wrap text-text-secondary">{workspace.pending}</p>
						<AttachedPages pages={workspace.draftAttachments} />
					</div>
				</div>
			{/if}
			{#if workspace.identifying}
				<ResearchProgress mode="identify" stage="identifying" />
			{:else if workspace.comparing}
				<ResearchProgress mode="compare" stage={workspace.compareStage} />
			{:else if workspace.researching}
				<ResearchProgress stage={workspace.researchStage} />
			{:else}
				<Progress
					stage={workspace.stage}
					streamed={workspace.streamed}
					closed={workspace.closed}
					followUp={workspace.followUp}
					skills={workspace.runSkills}
				/>
			{/if}
		{/if}
	{:else if workspace.isLoading}
		<Progress
			stage={workspace.stage}
			streamed={workspace.streamed}
			closed={workspace.closed}
			skills={workspace.runSkills}
		/>
	{:else}
		<div class="mx-auto flex min-h-full w-full max-w-170 flex-col px-6">
			<div class="my-auto flex flex-col gap-7.5 py-8">
				<div class="flex flex-col gap-3 text-center">
					<h1 class="type-h1">What are the facts?</h1>
					<p class="type-lead mx-auto max-w-140 text-text-secondary">
						Paste a case summary and {SITE_NAME} surfaces the likely legal issues, governing
						doctrines, landmark precedents, and the acts and sections to check.
					</p>
				</div>

				<div>
					<Composer {quota} {research} {compare} {outOfSearches} />
					<div class="mt-3 space-y-3">{@render messages()}</div>
				</div>

				{#if workspace.errorMessage}
					<div class="flex justify-center">
						<ErrorNotice message={workspace.errorMessage} />
					</div>
				{/if}

				<div class="flex flex-wrap items-center justify-center gap-2">
					<button
						type="button"
						onclick={() => workspace.nextSample()}
						class="flex items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 px-3.5 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-2"
					>
						<Icon name="fileText" size={14} class="text-accent-text" />
						Use sample facts
					</button>
					{#each SAMPLES as sample}
						<button
							type="button"
							onclick={() => workspace.fillSample(sample.facts)}
							class="rounded-pill border border-border-subtle px-3.5 py-2 text-sm text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
						>
							{sample.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</main>

{#if workspace.isLoading || workspace.thread.length > 0}
	<div class="border-t border-border-subtle px-6 py-4">
		<div class="mx-auto w-full max-w-3xl">
			{#if workspace.errorMessage}
				<div class="mb-3 flex justify-center">
					<ErrorNotice message={workspace.errorMessage} />
				</div>
			{/if}
			<Composer docked {quota} {research} {compare} {outOfSearches} />
			<div class="mt-3 space-y-3">{@render messages()}</div>
		</div>
	</div>
{:else}
	<footer class="px-6 pt-4 pb-5 text-center text-caption text-text-tertiary">
		Study aid for issue-spotting practice. Always verify sections and precedents against primary
		sources. Model output can be incomplete or out of date.
	</footer>
{/if}
