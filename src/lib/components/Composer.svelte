<script lang="ts">
	import { workspace } from '#lib/workspace.svelte.js';
	import { MAX_FACTS } from '#lib/spotter.js';
	import type { QuotaInfo } from '#lib/spotter.js';
	import AddContext from './AddContext.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	type Props = { docked?: boolean; quota: QuotaInfo | null; outOfSearches: boolean };
	let { docked = false, quota, outOfSearches }: Props = $props();

	let drawerOpen = $state(false);
	let drawerMaxHeight = $state(528);
	let addButton = $state<HTMLButtonElement>();
	let wrapper = $state<HTMLDivElement>();

	function toggleDrawer() {
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
	class="flex flex-col gap-3.5 rounded-2xl border border-border-default bg-surface-2 px-[18px] pt-[18px] pb-3.5 focus-within:border-border-strong"
>
	<label for="facts" class="sr-only">Case facts</label>
	<textarea
		id="facts"
		name="facts"
		bind:value={workspace.facts}
		readonly={workspace.isLoading}
		required
		autocomplete="off"
		rows={docked ? 2 : 5}
		placeholder={docked
			? 'Paste new facts to start another analysis…'
			: 'Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord about a broken light and a leaking pipe…'}
		class="w-full resize-none bg-transparent text-md leading-normal text-text-primary outline-none {docked ? '' : 'min-h-33'}"
	></textarea>

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
					<AddContext id="add-context" maxHeight={drawerMaxHeight} />
				{/if}
			</div>
			<span
				class="type-meta tabular-nums {workspace.overLimit ? 'text-danger' : 'text-text-tertiary'}"
			>
				{workspace.isLoading
					? 'Context locked'
					: `${workspace.charCount.toLocaleString()} / ${MAX_FACTS.toLocaleString()}`}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<Button variant="ghost" class="px-3 py-[9px]" onclick={() => workspace.clearAll()}>Clear</Button>
			<Button
				variant="primary"
				type="submit"
				class="gap-[7px] px-4 py-2.5 shadow-button"
				disabled={workspace.isLoading || workspace.overLimit || outOfSearches}
			>
				<Icon name="sparkles" />
				{workspace.isLoading ? 'Analyzing…' : 'Spot issues'}
			</Button>
		</div>
	</div>
</form>

{#if quota}
	<p class="mt-2 text-right text-caption tabular-nums text-text-tertiary">
		{quota.remaining} of {quota.limit}
		{quota.signedIn ? '' : 'free '}searches left today
	</p>
{/if}
{#if workspace.showContextTip}
	<p class="mt-2 text-caption text-text-tertiary">
		Tip: say who did what to whom, and what harm, dispute or right is at stake. Legal context helps
		the spotter find the right issues.
	</p>
{/if}
