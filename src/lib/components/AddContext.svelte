<script lang="ts">
	import { ACCEPTED_TYPES } from '#lib/file-types.js';
	import { SKILLS } from '#lib/skills.js';
	import type { ActiveSkill } from '#lib/skills.js';
	import { workspace } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';

	/** maxHeight is what fits above the button, so the drawer scrolls instead of leaving the screen. */
	type Props = { id: string; maxHeight: number; onClose: () => void };
	let { id, maxHeight, onClose }: Props = $props();

	let url = $state('');
	let urlInput = $state<HTMLInputElement>();
	let fileInput = $state<HTMLInputElement>();

	let selected = $derived(workspace.skills.length + (workspace.researchMode ? 1 : 0));
	let adding = $derived(workspace.urlStatus === 'loading');

	/** Reads each chosen file in turn. The composer shows what happened to each, so the drawer closes. */
	async function pickFiles(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		onClose();
		for (const file of files) await workspace.addFile(file);
	}

	async function addUrl() {
		if (adding || !url.trim()) return;
		if (await workspace.addUrl(url)) {
			url = '';
			onClose();
		}
	}
</script>

<!--
	The drawer from the design. Skills that change the analysis (Summarize, Counter-args) toggle, and
	a link to a page on an allowed legal site or an uploaded PDF, Word file or image can be added as
	background. The skills that are not built yet are shown disabled and labelled.
-->
<div
	{id}
	style="max-height: {maxHeight}px"
	role="dialog"
	aria-label="Add context"
	class="absolute bottom-full left-0 z-20 mb-2 flex w-76 max-w-[calc(100vw-3rem)] flex-col gap-1 overflow-y-auto rounded-xl border border-border-default bg-surface-3 p-2 leading-tight shadow-overlay"
>
	<div class="px-2.5 pt-2 pb-1.5">
		<p class="text-sm font-semibold text-text-primary">Add context</p>
		<p class="text-[11px] text-text-tertiary">Attach context, link a source, or apply a skill.</p>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		name="attachment"
		accept={ACCEPTED_TYPES}
		multiple
		onchange={pickFiles}
		class="hidden"
		tabindex="-1"
		aria-hidden="true"
	/>
	<button
		type="button"
		onclick={() => fileInput?.click()}
		class="flex items-center gap-[11px] rounded-md px-2.5 py-[9px] text-left transition hover:bg-surface-2"
	>
		<span
			class="grid size-[30px] shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-2 text-text-secondary"
		>
			<Icon name="paperclip" />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-sm font-medium text-text-primary">Upload files</span>
			<span class="mt-px block text-[11px] text-text-tertiary">PDF, DOCX, or images</span>
		</span>
	</button>

	<button
		type="button"
		onclick={() => urlInput?.focus()}
		class="flex items-center gap-[11px] rounded-md px-2.5 py-[9px] text-left transition hover:bg-surface-2"
	>
		<span
			class="grid size-[30px] shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-2 text-text-secondary"
		>
			<Icon name="link" />
		</span>
		<span class="min-w-0 flex-1">
			<span class="block text-sm font-medium text-text-primary">Add a URL</span>
			<span class="mt-px block text-[11px] text-text-tertiary">Case or statute page</span>
		</span>
	</button>

	<div class="mt-1 flex flex-col gap-3 border-t border-border-subtle pt-3">
		<div class="flex items-center justify-between px-0.5">
			<p class="font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">SKILLS</p>
			<p class="text-[11px] text-text-tertiary">{selected > 0 ? `${selected} selected` : `${SKILLS.filter((skill) => skill.available).length} available`}</p>
		</div>
		<div class="grid grid-cols-2 gap-2">
			{#each SKILLS as skill}
				{@const research = skill.id === 'deep-research'}
				{@const on = research
					? workspace.researchMode
					: workspace.skills.includes(skill.id as ActiveSkill)}
				{@const usable = skill.available && (!research || workspace.followUp || workspace.researchMode)}
				<button
					type="button"
					disabled={!usable}
					aria-pressed={usable ? on : undefined}
					onclick={() => (research ? workspace.toggleResearch() : workspace.toggleSkill(skill.id as ActiveSkill))}
					title={!skill.available
						? 'Coming soon'
						: !usable
							? 'Spot the issues in a case first, then research a point within it'
							: undefined}
					class="relative flex h-16 flex-col items-center justify-center gap-[7px] rounded-md border px-2 py-3 transition {on
						? 'border-border-strong bg-surface-2 text-text-primary'
						: 'border-border-subtle text-text-secondary'} {usable ? 'hover:bg-surface-2' : 'opacity-60'}"
				>
					<Icon name={skill.icon} size={18} class={on ? 'text-accent-text' : 'text-text-tertiary'} />
					<span class="text-caption leading-none font-medium">{skill.label}</span>
					{#if !skill.available}
						<span class="absolute top-1 right-1.5 text-[10px] text-text-tertiary">Soon</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	<div class="mt-1 flex flex-col gap-1.5 border-t border-border-subtle px-2.5 pt-2 pb-1.5">
		<label
			for="{id}-url"
			class="font-mono text-[10px] font-semibold tracking-[1px] text-text-tertiary"
		>
			OR PASTE A LINK
		</label>
		<div class="flex gap-2">
			<input
				bind:this={urlInput}
				bind:value={url}
				id="{id}-url"
				type="url"
				name="source-url"
				inputmode="url"
				autocomplete="off"
				spellcheck="false"
				placeholder="https://indiankanoon.org/…"
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						addUrl();
					}
				}}
				class="min-w-0 flex-1 rounded-md border border-border-default bg-surface-2 px-[11px] py-[9px] text-sm text-text-primary"
			/>
			<button
				type="button"
				onclick={addUrl}
				disabled={adding || !url.trim()}
				class="rounded-md border border-border-default bg-surface-1 px-3.5 py-[9px] text-sm text-text-secondary transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
			>
				{adding ? 'Adding…' : 'Add'}
			</button>
		</div>
		{#if workspace.urlError}
			<p role="alert" class="text-caption leading-snug text-danger">{workspace.urlError}</p>
		{:else}
			<p class="text-[11px] leading-snug text-text-tertiary">
				Pages from Indian Kanoon, India Code and the Supreme Court of India.
			</p>
		{/if}
	</div>
</div>
