<script lang="ts">
	import Icon from './Icon.svelte';

	/** maxHeight is what fits above the button, so the drawer scrolls instead of leaving the screen. */
	type Props = { id: string; maxHeight: number };
	let { id, maxHeight }: Props = $props();

	const sources = [
		{ label: 'Upload files', hint: 'PDF, DOCX, or images', icon: 'paperclip' },
		{ label: 'Add a URL', hint: 'Case, statute, or article link', icon: 'link' }
	] as const;

	const skills = [
		{ label: 'Draft', icon: 'squarePen' },
		{ label: 'Deep research', icon: 'telescope' },
		{ label: 'Compare cases', icon: 'gitCompare' },
		{ label: 'Counter-args', icon: 'swords' },
		{ label: 'Verify cites', icon: 'badgeCheck' },
		{ label: 'Summarize', icon: 'list' }
	] as const;
</script>

<!--
	The drawer from the design. Attaching files or links and applying skills are not wired to the
	backend yet, so every control is shown disabled and labelled instead of pretending to work.
-->
<div
	{id}
	style="max-height: {maxHeight}px"
	role="dialog"
	aria-label="Add context"
	class="absolute bottom-full left-0 z-20 mb-2 flex w-76 max-w-[calc(100vw-3rem)] flex-col gap-1 rounded-xl border border-border-default bg-surface-3 p-2 leading-tight shadow-overlay overflow-y-auto"
>
	<div class="px-2.5 pt-2 pb-1.5">
		<p class="text-sm font-semibold text-text-primary">Add context</p>
		<p class="text-[11px] text-text-tertiary">Attach context, link a source, or apply a skill.</p>
	</div>

	{#each sources as source}
		<button
			type="button"
			disabled
			class="flex items-center gap-[11px] rounded-md px-2.5 py-[9px] text-left opacity-60"
		>
			<span
				class="grid size-[30px] shrink-0 place-items-center rounded-md border border-border-subtle bg-surface-2 text-text-secondary"
			>
				<Icon name={source.icon} />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block text-sm font-medium text-text-primary">{source.label}</span>
				<span class="mt-px block text-[11px] text-text-tertiary">{source.hint}</span>
			</span>
			<span class="text-[11px] text-text-tertiary">Soon</span>
		</button>
	{/each}

	<div class="mt-1 flex flex-col gap-3 border-t border-border-subtle pt-3">
		<div class="flex items-center justify-between px-0.5">
			<p class="font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">SKILLS</p>
			<p class="text-[11px] text-text-tertiary">Coming soon</p>
		</div>
		<div class="grid grid-cols-2 gap-2">
			{#each skills as skill}
				<button
					type="button"
					disabled
					class="flex h-16 flex-col items-center justify-center gap-[7px] rounded-md border border-border-subtle px-2 py-3 text-text-secondary opacity-60"
				>
					<Icon name={skill.icon} size={18} class="text-text-tertiary" />
					<span class="text-caption leading-none font-medium">{skill.label}</span>
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
				id="{id}-url"
				type="url"
				name="source-url"
				inputmode="url"
				autocomplete="off"
				spellcheck="false"
				disabled
				placeholder="https://indiankanoon.org/…"
				class="min-w-0 flex-1 rounded-md border border-border-default bg-surface-2 px-[11px] py-[9px] text-sm text-text-primary opacity-60"
			/>
			<button
				type="button"
				disabled
				class="rounded-md border border-border-default bg-surface-1 px-3.5 py-[9px] text-sm text-text-secondary opacity-60"
			>
				Add
			</button>
		</div>
	</div>
</div>
