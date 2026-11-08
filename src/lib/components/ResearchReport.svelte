<script lang="ts">
	import { headingOf, renderMarkdown, templateFor } from '#lib/report.js';
	import type { ReportLine, ResearchBrief } from '#lib/spotter.js';
	import Icon from './Icon.svelte';

	type Props = { brief: ResearchBrief; index: number };
	let { brief, index }: Props = $props();

	let report = $derived(brief.report!);
	let copied = $state(false);

	/** The sections in the template's order, each with its printed number. */
	let sections = $derived.by(() => {
		let position = 0;
		return templateFor(report.kind).map((slot) => {
			if (slot.number) position += 1;
			return {
				slot,
				heading: headingOf(slot, position),
				position,
				data: report.sections.find((section) => section.id === slot.id)
			};
		});
	});
	/** Every line that quotes a page, for the list of passages. */
	let passages = $derived(
		report.sections
			.flatMap((section) => [...section.lines, ...(section.children ?? []).flatMap((child) => child.lines)])
			.filter((line) => line.check?.quote)
	);
	let markdown = $derived(renderMarkdown(report, brief.sources));

	async function copy() {
		try {
			await navigator.clipboard.writeText(markdown);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			// Clipboard access can be denied; the download still works.
		}
	}

	function download() {
		const name = report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
		const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = `${name || 'research'}.md`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

{#snippet line(item: ReportLine)}
	<span class="text-body leading-relaxed text-text-secondary">
		{#if item.mark}
			<span
				class="mr-1 inline-flex align-text-bottom {item.mark === 'ok' ? 'text-accent-text' : item.mark === 'warn' ? 'text-text-secondary' : 'text-danger'}"
			>
				<Icon name={item.mark === 'ok' ? 'badgeCheck' : item.mark === 'warn' ? 'info' : 'x'} size={13} />
				<span class="sr-only">{item.mark === 'ok' ? 'Checked' : item.mark === 'warn' ? 'Worth a look' : 'Not found'}:</span>
			</span>
		{/if}
		{item.text}
		{#each item.cites as n}
			<a
				href="#source-{index}-{n}"
				class="ml-0.5 align-super font-mono text-[10px] text-accent-text hover:underline"
				aria-label="Source {n}">[{n}]</a
			>
		{/each}
		{#if item.mark}
			<!-- the icon above says how this came out -->
		{:else if item.check?.status === 'confirmed'}
			<span
				class="ml-0.5 inline-flex align-text-bottom text-accent-text"
				title="Confirmed: the page contains the passage quoted below"
			>
				<Icon name="badgeCheck" size={12} />
				<span class="sr-only">Confirmed against the page</span>
			</span>
		{:else if item.check?.status === 'read'}
			<span
				class="ml-0.5 inline-flex align-text-bottom text-text-tertiary"
				title="The PDF was read and a passage quoted below, but the app could not check the quote itself"
			>
				<Icon name="badgeCheck" size={12} />
				<span class="sr-only">PDF read, quote not checked by the app</span>
			</span>
		{:else if item.basis === 'inference'}
			<span
				class="ml-1 rounded-sm border border-border-subtle px-1.5 py-px font-mono text-[10px] text-text-tertiary"
				title={report.kind === 'compare' ? 'Reasoning, not taken from a page. No page can confirm it.' : 'Reasoning about your facts. No page can confirm it.'}>INFERENCE</span
			>
		{/if}
	</span>
{/snippet}

<header class="mt-8">
	<p class="type-meta tracking-widest text-accent-text">
		{report.kind === 'compare' ? 'CASE COMPARISON' : report.kind === 'verify' ? 'CITATION CHECK' : 'RESEARCH REPORT'} · {brief.sources.length}
		{brief.sources.length === 1 ? 'SOURCE' : 'SOURCES'}
	</p>
	<h2 class="type-h3 mt-1">{report.title}</h2>
</header>

{#each sections as { slot, heading, position, data }}
	<section class="mt-8" aria-label={slot.heading}>
		<h3 class="type-h4">{heading}</h3>

		{#if slot.plain}
			{#if (data?.notes ?? []).length > 0}
				<ul class="mt-3 space-y-2">
					{#each data?.notes ?? [] as note}
						<li class="flex gap-2 text-body text-text-secondary">
							<span class="text-text-muted" aria-hidden="true">·</span>{note}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-3 text-body text-text-tertiary">{slot.empty}</p>
			{/if}
		{:else if slot.grouped}
			{#each data?.children ?? [] as child, at}
				<div class="mt-4 border-l-2 border-border-default pl-4">
					<h4 class="text-body font-semibold text-text-primary">
						{position}.{at + 1}
						{child.heading}
					</h4>
					<ul class="mt-2 space-y-2">
						{#each child.lines as item}
							<li class="flex gap-2"><span class="text-text-muted" aria-hidden="true">·</span>{@render line(item)}</li>
						{/each}
					</ul>
				</div>
			{:else}
				<p class="mt-3 text-body text-text-tertiary">{slot.empty}</p>
			{/each}
		{:else if (data?.lines ?? []).length > 0}
			{#if slot.numbered}
				<ol class="mt-3 space-y-2">
					{#each data?.lines ?? [] as item, at}
						<li class="flex gap-3">
							<span class="w-5 shrink-0 font-mono text-caption text-text-tertiary">{at + 1}.</span>{@render line(item)}
						</li>
					{/each}
				</ol>
			{:else}
				<ul class="mt-3 space-y-2">
					{#each data?.lines ?? [] as item}
						<li class="flex gap-2"><span class="text-text-muted" aria-hidden="true">·</span>{@render line(item)}</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<p class="mt-3 text-body text-text-tertiary">{slot.empty}</p>
		{/if}
	</section>
{/each}

{#if report.dropped > 0}
	<p class="mt-6 text-caption text-text-tertiary">
		{report.dropped}
		{report.dropped === 1 ? 'statement was' : 'statements were'} left out because the cited page did
		not contain the passage given for {report.dropped === 1 ? 'it' : 'them'}.
	</p>
{/if}

{#if passages.length > 0}
	<details class="mt-6 rounded-lg border border-border-subtle bg-surface-1 p-3">
		<summary class="cursor-pointer text-sm font-medium text-text-secondary">
			What the pages say ({passages.length})
		</summary>
		<ul class="mt-3 space-y-3">
			{#each passages as item}
				<li class="text-sm">
					<p class="text-text-secondary">{item.text}</p>
					<blockquote class="mt-1 border-l-2 border-border-default pl-3 text-text-tertiary">
						{item.check?.quote}
						{#if item.check?.approx}
							<span class="ml-1 text-[10px] text-text-muted">(closest wording on the page)</span>
						{/if}
						<a
							href="#source-{index}-{item.check?.source}"
							class="ml-1 font-mono text-[10px] text-accent-text hover:underline">[{item.check?.source}]</a
						>
					</blockquote>
				</li>
			{/each}
		</ul>
	</details>
{/if}

<div class="mt-6 flex flex-wrap items-center gap-2">
	<button
		type="button"
		onclick={copy}
		class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
	>
		<Icon name={copied ? 'check' : 'copy'} size={14} />
		{copied ? 'Copied' : 'Copy as Markdown'}
	</button>
	<button
		type="button"
		onclick={download}
		class="flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary"
	>
		<Icon name="fileText" size={14} />
		Download .md
	</button>
</div>
