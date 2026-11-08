<script lang="ts">
	import { onMount } from 'svelte';
	import { activityStore } from '#lib/activity.svelte.js';
	import { auth } from '#lib/auth.svelte.js';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { clearPreferences, exportData, storageSummary } from '#lib/data-controls.js';
	import type { StorageItem } from '#lib/data-controls.js';
	import { SITE_NAME } from '#lib/site.js';
	import { speech } from '#lib/speech.svelte.js';
	import { theme } from '#lib/theme.svelte.js';

	/** What is kept is the browser's, so nothing is read until the page is in one. */
	let items = $state<StorageItem[]>([]);
	let mounted = $state(false);
	function refresh() {
		items = storageSummary(localStorage, auth.user?.email);
	}
	onMount(() => {
		mounted = true;
		refresh();
	});
	// A different person acting means a different activity entry.
	$effect(() => {
		auth.user;
		if (mounted) refresh();
	});

	let status = $state('');
	let confirming = $state<'activity' | 'preferences' | null>(null);
	let activityHere = $derived(items.find((item) => item.name === 'legalspotter:activity')?.present === true);
	let prefsHere = $derived(items.some((item) => item.present === true && item.name !== 'legalspotter:activity'));

	function exportIt() {
		const { fileName, text } = exportData(localStorage, auth.user?.email, new Date());
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		URL.revokeObjectURL(url);
		status = `Downloaded ${fileName}.`;
	}

	function resetActivity() {
		activityStore.reset();
		confirming = null;
		refresh();
		status = 'Your activity numbers were cleared from this browser.';
	}

	function resetPreferences() {
		clearPreferences(localStorage);
		theme.reset();
		speech.resetPrefs();
		confirming = null;
		refresh();
		status = 'Your saved preferences were cleared. Appearance now follows your device.';
	}

	const rowClass = 'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3.5';
	/** A destructive action in the danger colours. A plain button, because Button's own colours would override these. */
	const dangerButton = 'inline-flex items-center justify-center rounded-md border border-danger-border bg-danger-subtle px-3.5 py-1.5 text-sm text-danger transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<svelte:head>
	<title>Data controls · Settings · {SITE_NAME}</title>
</svelte:head>

<h2 class="type-h2 font-bold">Data controls</h2>

<p class="-mt-3 max-w-xl text-body text-text-secondary">
	{SITE_NAME} keeps very little about you, and most of it only in this browser. Here you can see it,
	take a copy and clear it.
</p>

<div class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>div+div]:border-t [&>div+div]:border-border-subtle">
	<div class={rowClass}>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-body font-medium text-text-primary">Export data</span>
			<span class="text-caption text-text-tertiary">A file with your activity numbers and saved preferences, as this browser holds them.</span>
		</div>
		<Button variant="secondary" class="px-3.5 py-1.5 text-sm" onclick={exportIt}>Export</Button>
	</div>

	<div class={rowClass}>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-body font-medium text-text-primary">Reset activity data</span>
			<span class="text-caption text-text-tertiary">Clears the numbers on your Profile and Usage pages from this browser.</span>
		</div>
		{#if confirming === 'activity'}
			<span class="flex flex-wrap items-center gap-2" role="alert">
				<span class="text-sm text-text-secondary">Clear it?</span>
				<button type="button" class={dangerButton} onclick={resetActivity}>Yes, clear</button>
				<Button variant="ghost" class="px-3 py-1.5 text-sm" onclick={() => (confirming = null)}>Cancel</Button>
			</span>
		{:else}
			<button type="button" class={dangerButton} onclick={() => (confirming = 'activity')} disabled={!activityHere}>Reset</button>
		{/if}
	</div>

	<div class={rowClass}>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<span class="text-body font-medium text-text-primary">Reset preferences</span>
			<span class="text-caption text-text-tertiary">Forgets your appearance, reading speed and pane choices. Your activity numbers stay.</span>
		</div>
		{#if confirming === 'preferences'}
			<span class="flex flex-wrap items-center gap-2" role="alert">
				<span class="text-sm text-text-secondary">Forget them?</span>
				<button type="button" class={dangerButton} onclick={resetPreferences}>Yes, reset</button>
				<Button variant="ghost" class="px-3 py-1.5 text-sm" onclick={() => (confirming = null)}>Cancel</Button>
			</span>
		{:else}
			<button type="button" class={dangerButton} onclick={() => (confirming = 'preferences')} disabled={!prefsHere}>Reset</button>
		{/if}
	</div>
</div>

{#if status}
	<p class="-mt-3 text-caption text-text-secondary" role="status">{status}</p>
{/if}

<section class="flex flex-col gap-3" aria-labelledby="storage-title">
	<div class="flex flex-col gap-0.5">
		<h3 id="storage-title" class="text-lg font-medium text-text-primary">Cookies and storage</h3>
		<p class="text-body text-text-secondary">
			What {SITE_NAME} keeps on this device. There are no advertising or analytics cookies.
		</p>
	</div>
	<ul class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>li+li]:border-t [&>li+li]:border-border-subtle">
		{#each items as item (item.name)}
			<li class="flex flex-col gap-0.5 px-4 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<code class="min-w-0 truncate text-[13px] text-text-primary">{item.name}</code>
					<span class="shrink-0 text-caption text-text-tertiary">
						{item.where}{item.present === true ? ` · here now, ${item.bytes} bytes` : item.present === false ? ' · not set' : ''}
					</span>
				</div>
				<span class="text-caption text-text-tertiary">{item.purpose}</span>
			</li>
		{/each}
		{#if auth.user}
			<li class="flex flex-col gap-0.5 px-4 py-3">
				<div class="flex items-baseline justify-between gap-4">
					<span class="text-[13px] text-text-primary">Sign-in session</span>
					<span class="shrink-0 text-caption text-text-tertiary">Browser storage</span>
				</div>
				<span class="text-caption text-text-tertiary">Kept by Firebase so you stay signed in. Signing out removes it.</span>
			</li>
		{/if}
	</ul>
</section>

<section class="flex flex-col gap-3" aria-labelledby="text-title">
	<div class="flex flex-col gap-0.5">
		<h3 id="text-title" class="text-lg font-medium text-text-primary">How your text is used</h3>
		<p class="max-w-xl text-body text-text-secondary">
			The facts, files and citations you give are sent to our AI model provider to produce each
			result. We do not save your case text in our own database and we do not use it to train any
			model of our own. The provider handles it under its own terms and may keep it for a period we do
			not control, so do not enter confidential or identifying information about real clients.
		</p>
	</div>
	<a href="/privacy" class="inline-flex w-fit items-center gap-1 text-body text-text-secondary hover:text-text-primary">
		Read the Privacy page
		<Icon name="chevronRight" size={15} />
	</a>
</section>
