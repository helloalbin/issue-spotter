<script lang="ts">
	import './layout.css';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth.svelte.js';
	import { speech } from '#lib/speech.svelte.js';
	import { theme } from '#lib/theme.svelte.js';
	import Icon from '#lib/components/Icon.svelte';
	import ContactDialog from '#lib/components/ContactDialog.svelte';
	import Inspector from '#lib/components/Inspector.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import PlansDialog from '#lib/components/PlansDialog.svelte';
	import SignInDialog from '#lib/components/SignInDialog.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { WIDE_SCREEN, workspace } from '#lib/workspace.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let menuOpen = $state(false);

	onMount(() => {
		auth.init();
		speech.init();
		theme.init();

		// The verification pane starts open on wide screens unless the user closed it.
		let saved: string | null = null;
		try {
			saved = localStorage.getItem('pane');
		} catch {
			// No saved choice.
		}
		// Below the breakpoint the pane is an overlay, so it never opens by itself.
		workspace.paneOpen = matchMedia(WIDE_SCREEN).matches ? saved !== 'closed' : false;
	});

	// Whoever is acting changed, so the remaining-searches counter must be read again.
	$effect(() => {
		if (auth.changes > 0) untrack(() => workspace.refreshQuota());
	});

	// The drawer closes whenever the page changes, and so does anything being read aloud.
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
		untrack(() => speech.stop());
	});

	function newAnalysis() {
		workspace.clearAll();
		menuOpen = false;
		if (page.url.pathname !== '/') goto('/');
	}
</script>

<a
	href="#main"
	class="sr-only rounded-md bg-btn px-3 py-2 text-btn-fg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
>
	Skip to content
</a>

<!--
	The frame is fixed to the window: only the content area scrolls. It is `relative` so that visually
	hidden text (position: absolute) is clipped here instead of stretching the document and letting
	the whole page scroll.
-->
<div class="relative flex h-dvh overflow-hidden bg-bg">
	<Sidebar open={menuOpen} onNew={newAnalysis} onClose={() => (menuOpen = false)} />

	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex items-center justify-between px-5 py-4">
			<button
				type="button"
				onclick={() => (menuOpen = true)}
				aria-label="Open menu"
				aria-controls="sidebar"
				aria-expanded={menuOpen}
				class="grid size-[34px] place-items-center rounded-md border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary md:hidden"
			>
				<Icon name="menu" />
			</button>
			<span class="ml-auto flex items-center gap-2.5">
				{#if workspace.latest}
					<button
						type="button"
						onclick={() => workspace.togglePane()}
						aria-label={workspace.paneOpen ? 'Hide verification pane' : 'Show verification pane'}
						aria-expanded={workspace.paneOpen}
						aria-controls="inspector"
						class="grid size-[34px] place-items-center rounded-md border border-border-subtle bg-surface-2 text-text-primary"
					>
						<Icon name="panelRight" />
					</button>
				{/if}
				<ThemeToggle />
			</span>
		</div>

		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
	</div>

	{#if workspace.latest && workspace.paneOpen}
		<Inspector />
	{/if}
</div>

<SignInDialog />
<PlansDialog />
<ContactDialog />
