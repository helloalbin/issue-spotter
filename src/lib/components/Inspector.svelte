<script lang="ts">
	import { actLink, caseLink } from '#lib/sources.js';
	import { workspace } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';

	let result = $derived(workspace.result);
	let meta = $derived(workspace.meta);

	let path = $derived(
		result
			? [
					{ label: 'Read the facts', count: null },
					{ label: 'Identified primary issues', count: result.issues.length },
					{ label: 'Matched governing doctrines', count: result.doctrines.length },
					{ label: 'Found landmark precedents', count: result.precedents.length },
					{ label: 'Located acts & sections', count: result.acts.length }
				]
			: []
	);

	let sources = $derived(
		result
			? [
					...result.precedents.map((precedent) => ({
						name: precedent.name,
						kind: 'Case' as const,
						link: caseLink(precedent, result.jurisdiction)
					})),
					...result.acts.map((entry) => ({
						name: entry.act,
						kind: 'Statute' as const,
						link: actLink(entry.act, result.jurisdiction)
					}))
				]
			: []
	);

	let hosts = $derived([...new Set(sources.map((source) => source.link.host))]);
</script>

<button
	type="button"
	aria-label="Close verification pane"
	onclick={() => workspace.togglePane()}
	class="fixed inset-0 z-30 bg-bg/70 lg:hidden"
></button>

<aside
	id="inspector"
	aria-label="Verification"
	class="fixed inset-y-0 right-0 z-40 flex w-82 max-w-full shrink-0 flex-col gap-6 overflow-y-auto border-l border-border-subtle bg-surface-1 px-[18px] py-5 lg:static lg:z-auto"
>
	<div class="flex items-start justify-between">
		<div>
			<h2 class="text-md leading-tight font-semibold tracking-[-0.2px]">Verification</h2>
			<p class="text-[11px] text-text-tertiary">Sources &amp; search path</p>
		</div>
		<button
			type="button"
			onclick={() => workspace.togglePane()}
			aria-label="Close verification pane"
			class="grid size-7 place-items-center rounded-md text-text-tertiary hover:text-text-primary"
		>
			<Icon name="panelRightClose" />
		</button>
	</div>

	<section class="flex flex-col gap-2.5">
		<h3 class="font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">SEARCH PATH</h3>
		<ul class="rounded-lg border border-border-subtle bg-surface-2 px-3 py-1 divide-y divide-border-subtle">
			{#each path as step}
				<li class="flex items-center gap-2.5 py-[9px] text-sm text-text-secondary">
					<span
						class="grid size-4 shrink-0 place-items-center rounded-pill bg-accent-subtle text-accent-text"
					>
						<Icon name="check" size={10} />
					</span>
					<span class="flex-1">{step.label}</span>
					{#if step.count !== null}
						<span class="font-mono text-[11px] text-text-tertiary">{step.count}</span>
					{/if}
				</li>
			{/each}
		</ul>
		<p class="flex items-center gap-[7px] px-0.5 text-[11px] text-text-tertiary">
			<Icon name="sparkles" size={12} />
			{#if meta}
				Analyzed with {meta.model} · {(meta.ms / 1000).toFixed(1)}s
			{:else}
				Analyzed with an AI model
			{/if}
		</p>
	</section>

	<section class="flex flex-col gap-2.5">
		<div class="flex items-center justify-between">
			<h3 class="font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">SOURCES</h3>
			<span class="text-[11px] text-text-tertiary">
				{sources.length}
				{sources.length === 1 ? 'reference' : 'references'}
			</span>
		</div>

		{#if sources.length > 0}
			<p class="flex items-center gap-1.5 font-mono text-[11px] text-text-tertiary">
				<Icon name="globe" size={12} class="text-text-muted" />
				{hosts.join(' · ')}
			</p>
			<ul class="flex flex-col gap-px">
				{#each sources as source}
					<li>
						<a
							href={source.link.href}
							target="_blank"
							rel="noopener noreferrer"
							title={source.name}
							class="group flex items-center gap-2.5 rounded-md px-2 py-[7px] hover:bg-surface-2"
						>
							<span
								class="grid size-[22px] shrink-0 place-items-center rounded-sm border border-border-subtle bg-surface-2 text-text-tertiary"
							>
								<Icon name={source.kind === 'Case' ? 'scale' : 'bookMarked'} size={12} />
							</span>
							<span class="min-w-0 flex-1 truncate text-sm text-text-secondary group-hover:text-text-primary">
								{source.name}
								<span class="sr-only">(searches {source.link.name}, opens in a new tab)</span>
							</span>
							<span class="text-[11px] text-text-tertiary">{source.kind}</span>
						</a>
					</li>
				{/each}
			</ul>
			<p class="px-0.5 text-[11px] leading-snug text-text-tertiary">
				These links open a search. A link does not confirm that a case or section exists or says
				what the analysis claims. Check each one against the judgment or the bare act.
			</p>
		{:else}
			<p class="text-sm text-text-tertiary">No cases or statutes to look up for these facts.</p>
		{/if}
	</section>
</aside>
