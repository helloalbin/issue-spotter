<script lang="ts">
	import { workspace } from '#lib/workspace.svelte.js';
	import { MAX_FACTS } from '#lib/spotter.js';
	import type { QuotaInfo } from '#lib/spotter.js';
	import { SKILLS } from '#lib/skills.js';
	import AddContext from './AddContext.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	type Props = { docked?: boolean; quota: QuotaInfo | null; outOfSearches: boolean };
	let { docked = false, quota, outOfSearches }: Props = $props();

	let drawerOpen = $state(false);
	let drawerMaxHeight = $state(528);
	let addButton = $state<HTMLButtonElement>();
	let wrapper = $state<HTMLDivElement>();
	// While a search runs the facts show as two lines, with a toggle when there is more.
	let expanded = $state(false);
	let clamped = $state(false);
	let clampEl = $state<HTMLParagraphElement>();

	$effect(() => {
		if (!workspace.isLoading) expanded = false;
		else if (clampEl && !expanded) clamped = clampEl.scrollHeight > clampEl.clientHeight + 1;
	});

	function toggleDrawer() {
		if (!drawerOpen) workspace.urlError = '';
		if (!drawerOpen && addButton) {
			// Leave a margin at the top of the screen; the drawer scrolls inside if it needs more.
			drawerMaxHeight = Math.min(528, Math.max(160, addButton.getBoundingClientRect().top - 16));
		}
		drawerOpen = !drawerOpen;
	}

	function closeDrawer(returnFocus = false) {
		drawerOpen = false;
		if (returnFocus) addButton?.focus();
	}

	function onWindowClick(event: MouseEvent) {
		if (drawerOpen && wrapper && !wrapper.contains(event.target as Node)) closeDrawer();
	}

	function onWindowKeydown(event: KeyboardEvent) {
		if (drawerOpen && event.key === 'Escape') closeDrawer(true);
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<form
	onsubmit={(event) => {
		event.preventDefault();
		workspace.submit();
	}}
	class="flex flex-col gap-3.5 rounded-2xl border border-border-default bg-surface-2 focus-within:border-border-strong {workspace.isLoading
		? 'px-4 pt-4 pb-3'
		: 'px-[18px] pt-[18px] pb-3.5'}"
>
	{#if workspace.isLoading}
		<div class="flex flex-col gap-2">
			<p
				bind:this={clampEl}
				class="text-body leading-normal whitespace-pre-wrap text-text-secondary {expanded
					? 'max-h-60 overflow-y-auto'
					: 'line-clamp-2'}"
			>
				{workspace.facts}
			</p>
			{#if clamped || expanded}
				<button
					type="button"
					onclick={() => (expanded = !expanded)}
					aria-expanded={expanded}
					class="flex items-center gap-1 self-start py-0.5 text-sm font-medium text-text-tertiary hover:text-text-primary"
				>
					{expanded ? 'Show less' : 'Show more'}
					<Icon name="chevronDown" size={14} class={expanded ? 'rotate-180' : ''} />
				</button>
			{/if}
		</div>

		<div class="flex items-center justify-between gap-4">
			<span class="type-meta text-text-tertiary">Context locked</span>
			<Button variant="primary" class="gap-[7px] px-4 py-2.5" onclick={() => workspace.stop()}>
				<Icon name="square" size={12} />
				Stop
			</Button>
		</div>
	{:else}
		<label for="facts" class="sr-only">Case facts</label>
		<textarea
			id="facts"
			name="facts"
			bind:value={workspace.facts}
			required
			autocomplete="off"
			rows={docked ? 2 : 5}
			placeholder={docked
				? 'Add more facts to this case…'
				: 'Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord about a broken light and a leaking pipe…'}
			class="w-full resize-none bg-transparent text-md leading-normal text-text-primary outline-none {docked
				? ''
				: 'min-h-33'}"
		></textarea>

		{#if workspace.skills.length > 0 || workspace.draftAttachments.length > 0}
			<ul class="flex flex-wrap gap-2" aria-label="Added to this message">
				{#each workspace.skills as id}
					{@const skill = SKILLS.find((entry) => entry.id === id)}
					{#if skill}
						<li
							class="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
						>
							<Icon name={skill.icon} size={12} class="text-accent-text" />
							{skill.label}
							<button
								type="button"
								onclick={() => workspace.toggleSkill(id)}
								aria-label="Turn off {skill.label}"
								class="grid size-4 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
							>
								<Icon name="x" size={11} />
							</button>
						</li>
					{/if}
				{/each}
				{#each workspace.draftAttachments as page}
					<li
						class="inline-flex max-w-72 items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
					>
						<Icon name="globe" size={12} class="shrink-0 text-accent-text" />
						<a
							href={page.url}
							target="_blank"
							rel="noopener noreferrer"
							title={page.title}
							class="truncate hover:underline"
						>
							{page.title}
						</a>
						{#if page.truncated}
							<span class="shrink-0 text-text-tertiary" title="Only the start of this page is used">· partial</span>
						{/if}
						<button
							type="button"
							onclick={() => workspace.removeAttachment(page.url)}
							aria-label="Remove {page.title}"
							class="grid size-4 shrink-0 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
						>
							<Icon name="x" size={11} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
			<div class="flex items-center gap-2.5">
				<div bind:this={wrapper} class="relative">
					<button
						bind:this={addButton}
						type="button"
						onclick={toggleDrawer}
						aria-label="Add context"
						aria-haspopup="dialog"
						aria-expanded={drawerOpen}
						aria-controls="add-context"
						class="grid size-[34px] place-items-center rounded-md border border-border-default bg-surface-3 text-text-secondary transition hover:text-text-primary"
					>
						<Icon name="plus" size={18} />
					</button>
					{#if drawerOpen}
						<AddContext id="add-context" maxHeight={drawerMaxHeight} onClose={() => closeDrawer(true)} />
					{/if}
				</div>
				<span
					class="type-meta tabular-nums {workspace.overLimit ? 'text-danger' : 'text-text-tertiary'}"
				>
					{workspace.charCount.toLocaleString()} / {MAX_FACTS.toLocaleString()}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<Button variant="ghost" class="px-3 py-[9px]" onclick={() => workspace.clearDraft()}>Clear</Button>
				<Button
					variant="primary"
					type="submit"
					class="gap-[7px] px-4 py-2.5 shadow-button"
					disabled={workspace.overLimit || outOfSearches}
				>
					<Icon name={workspace.followUp ? 'arrowUp' : 'sparkles'} />
					{workspace.followUp ? 'Add facts' : 'Spot issues'}
				</Button>
			</div>
		</div>
	{/if}
</form>

{#if quota || (docked && !workspace.isLoading)}
	<div class="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 text-caption text-text-tertiary">
		{#if docked && !workspace.isLoading}
			<p>Your facts are added to this case and the analysis is updated below. It counts as one search.</p>
		{/if}
		{#if quota}
			<p class="ml-auto tabular-nums">
				{quota.remaining} of {quota.limit}
				{quota.signedIn ? '' : 'free '}searches left today
			</p>
		{/if}
	</div>
{/if}
{#if workspace.showContextTip}
	<p class="mt-2 text-caption text-text-tertiary">
		Tip: say who did what to whom, and what harm, dispute or right is at stake. Legal context helps
		the spotter find the right issues.
	</p>
{/if}
