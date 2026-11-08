<script lang="ts">
	import { workspace } from '#lib/workspace.svelte.js';
	import { MAX_FACTS } from '#lib/spotter.js';
	import type { QuotaInfo } from '#lib/spotter.js';
	import { SKILLS } from '#lib/skills.js';
	import AddContext from './AddContext.svelte';
	import Button from './Button.svelte';
	import Icon from './Icon.svelte';

	type Props = {
		docked?: boolean;
		quota: QuotaInfo | null;
		/** Deep research is counted by the month, apart from searches. */
		research?: QuotaInfo | null;
		/** Case comparisons are counted by the month too. */
		compare?: QuotaInfo | null;
		/** Citation checks are counted by the month too. */
		verify?: QuotaInfo | null;
		outOfSearches: boolean;
	};
	let { docked = false, quota, research = null, compare = null, verify = null, outOfSearches }: Props = $props();
	let outOfResearch = $derived(
		(workspace.researchMode && research !== null && research.remaining === 0) ||
			(workspace.compareMode && compare !== null && compare.remaining === 0) ||
			(workspace.verifyMode && verify !== null && verify.remaining === 0)
	);

	// The primary button says what pressing it will do.
	let fileOnly = $derived(
		!workspace.facts.trim() && workspace.draftAttachments.some((attachment) => attachment.kind === 'file')
	);
	let primaryLabel = $derived(
		workspace.verifyMode
			? 'Check citations'
			: workspace.compareMode
			? 'Find cases'
			: workspace.researchMode
			? 'Research'
			: fileOnly
			? 'Send file'
			: workspace.skills.includes('draft')
				? 'Draft'
				: workspace.followUp
					? 'Add facts'
					: 'Spot issues'
	);
	let primaryIcon = $derived(
		workspace.verifyMode ? 'badgeCheck' : workspace.compareMode ? 'gitCompare' : workspace.researchMode ? 'telescope' : fileOnly ? 'arrowUp' : workspace.skills.includes('draft') ? 'squarePen' : workspace.followUp ? 'arrowUp' : 'sparkles'
	) as 'arrowUp' | 'squarePen' | 'sparkles' | 'telescope' | 'gitCompare' | 'badgeCheck';

	/** Clear empties what is typed and any message above it, so it has nothing to do without them. */
	let canClear = $derived(workspace.facts.trim() !== '' || workspace.errorMessage !== '' || workspace.notice !== '');

	/** A file was sent on its own and the app is waiting to hear what to do with it. */
	let awaitingFile = $derived(workspace.thread.some((exchange) => exchange.kind === 'reading'));

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
	ondragover={(event) => {
		if (!workspace.isLoading && event.dataTransfer?.types.includes('Files')) event.preventDefault();
	}}
	ondrop={async (event) => {
		if (workspace.isLoading) return;
		event.preventDefault();
		for (const file of [...(event.dataTransfer?.files ?? [])]) await workspace.addFile(file);
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
			required={workspace.draftAttachments.length === 0}
			autocomplete="off"
			rows={docked ? 2 : 5}
			placeholder={workspace.verifyMode
				? 'Paste the citations to check, one per line, with the point each is cited for…'
				: workspace.compareMode
				? 'Name the two cases, for example: Pankaj Bansal v. Union of India and Ram Kishor Arora v. Directorate of Enforcement…'
				: docked
				? workspace.followUp
					? workspace.researchMode
						? 'What should I research within your case?…'
						: 'Add more facts to this case…'
					: awaitingFile
						? 'Tell me what you want to do with the file…'
						: 'Describe the facts of a case to analyse…'
				: 'Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord about a broken light and a leaking pipe…'}
			class="w-full resize-none bg-transparent text-md leading-normal text-text-primary outline-none {docked
				? ''
				: 'min-h-33'}"
		></textarea>

		{#if workspace.fileError}
			<p role="alert" class="text-caption text-danger">{workspace.fileError}</p>
		{/if}
		{#if workspace.fileNotice}
			<div
				role="alert"
				class="flex gap-2.5 rounded-lg border border-border-default bg-surface-1 p-3 text-caption leading-snug text-text-secondary"
			>
				<Icon name="triangleAlert" size={16} class="mt-px shrink-0 text-danger" />
				<p class="flex-1">{workspace.fileNotice}</p>
				<button
					type="button"
					onclick={() => (workspace.fileNotice = '')}
					aria-label="Dismiss"
					class="grid size-5 shrink-0 place-items-center rounded-md text-text-tertiary hover:text-text-primary"
				>
					<Icon name="x" size={12} />
				</button>
			</div>
		{/if}

		{#if workspace.skills.length > 0 || workspace.researchMode || workspace.compareMode || workspace.verifyMode || workspace.draftAttachments.length > 0 || workspace.fileStatus}
			<ul class="flex flex-wrap gap-2" aria-label="Added to this message">
				{#if workspace.verifyMode}
					<li
						class="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
					>
						<Icon name="badgeCheck" size={12} class="text-accent-text" />
						Verify cites
						<button
							type="button"
							onclick={() => workspace.toggleVerify()}
							aria-label="Turn off Verify cites"
							class="grid size-4 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
						>
							<Icon name="x" size={11} />
						</button>
					</li>
				{/if}
				{#if workspace.compareMode}
					<li
						class="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
					>
						<Icon name="gitCompare" size={12} class="text-accent-text" />
						Compare cases
						<button
							type="button"
							onclick={() => workspace.toggleCompare()}
							aria-label="Turn off Compare cases"
							class="grid size-4 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
						>
							<Icon name="x" size={11} />
						</button>
					</li>
				{/if}
				{#if workspace.researchMode}
					<li
						class="inline-flex items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
					>
						<Icon name="telescope" size={12} class="text-accent-text" />
						Deep research
						<button
							type="button"
							onclick={() => workspace.toggleResearch()}
							aria-label="Turn off Deep research"
							class="grid size-4 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
						>
							<Icon name="x" size={11} />
						</button>
					</li>
				{/if}
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
				{#each workspace.draftAttachments as page (page.id)}
					<li
						class="inline-flex max-w-72 items-center gap-1.5 rounded-pill border border-border-default bg-surface-1 py-1 pr-1.5 pl-2.5 text-caption text-text-secondary"
					>
						<Icon
							name={page.kind === 'file' ? 'fileText' : 'globe'}
							size={12}
							class="shrink-0 text-accent-text"
						/>
						{#if page.kind === 'page' && page.url}
							<a
								href={page.url}
								target="_blank"
								rel="noopener noreferrer"
								title={page.title}
								class="truncate hover:underline"
							>
								{page.title}
							</a>
						{:else}
							<span class="truncate" title={page.title}>{page.title}</span>
						{/if}
						{#if page.truncated}
							<span class="shrink-0 text-text-tertiary" title="Only the start is used">· partial</span>
						{/if}
						<button
							type="button"
							onclick={() => workspace.removeAttachment(page.id)}
							aria-label="Remove {page.title}"
							class="grid size-4 shrink-0 place-items-center rounded-pill text-text-tertiary hover:text-text-primary"
						>
							<Icon name="x" size={11} />
						</button>
					</li>
				{/each}
				{#if workspace.fileStatus}
					<li
						class="inline-flex items-center gap-1.5 rounded-pill border border-border-subtle py-1 pr-2.5 pl-2.5 text-caption text-text-tertiary"
						role="status"
					>
						<Icon name="loader" size={12} class="spin" />
						Reading {workspace.fileStatus}…
					</li>
				{/if}
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
				<Button variant="ghost" class="px-3 py-[9px]" onclick={() => workspace.clearDraft()} disabled={!canClear}>
					Clear
				</Button>
				<Button
					variant="primary"
					type="submit"
					class="gap-[7px] px-4 py-2.5 shadow-button"
					disabled={workspace.researchMode || workspace.compareMode || workspace.verifyMode ? outOfResearch : workspace.overLimit || outOfSearches}
				>
					<Icon name={primaryIcon} />
					{primaryLabel}
				</Button>
			</div>
		</div>
	{/if}
</form>

{#if quota || (docked && !workspace.isLoading)}
	<div class="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 text-caption text-text-tertiary">
		{#if docked && !workspace.isLoading}
			<p>
				{#if workspace.verifyMode}
					Paste up to five citations, with the point each is cited for if you can. It checks each case exists, that your details match it, and that it says what you cite it for.
				{:else if workspace.compareMode}
					Name the two cases, by party names or part of a citation. You confirm them before anything is compared.
				{:else if workspace.researchMode}
					Name a point within your case to research on court and statute sites. It uses one of your deep research for the month.
				{:else if !workspace.followUp}
					{awaitingFile
						? 'Your message is sent with the file. It counts as one search.'
						: 'Describe the facts to start an analysis. It counts as one search.'}
				{:else if workspace.skills.includes('draft')}
					Your facts are added to this case and the draft is rewritten below. It counts as one search.
				{:else}
					Your facts are added to this case and the analysis is updated below. It counts as one search.
				{/if}
			</p>
		{/if}
		{#if workspace.verifyMode && verify}
			<p class="ml-auto tabular-nums">
				{verify.remaining} of {verify.limit} citation checks left this month
			</p>
		{:else if workspace.compareMode && compare}
			<p class="ml-auto tabular-nums">
				{compare.remaining} of {compare.limit} comparisons left this month
			</p>
		{:else if workspace.researchMode && research}
			<p class="ml-auto tabular-nums">
				{research.remaining} of {research.limit} deep research left this month
			</p>
		{:else if quota}
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
