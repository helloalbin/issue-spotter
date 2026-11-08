<script lang="ts">
	import './layout.css';
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { auth } from '#lib/auth.svelte.js';
	import Icon from '#lib/components/Icon.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import SignInDialog from '#lib/components/SignInDialog.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { workspace } from '#lib/workspace.svelte.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let menuOpen = $state(false);

	onMount(() => auth.init());

	// Whoever is acting changed, so the remaining-searches counter must be read again.
	$effect(() => {
		if (auth.changes > 0) untrack(() => workspace.refreshQuota());
	});

	// The drawer closes whenever the page changes.
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
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

<div class="flex h-dvh overflow-hidden bg-bg">
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
				<ThemeToggle />
				{#if auth.user}
					<span
						class="grid size-[30px] place-items-center rounded-pill border border-border-subtle bg-linear-135 from-avatar-from to-avatar-to text-sm font-semibold text-avatar-fg"
						aria-hidden="true"
					>
						{(auth.user.name ?? auth.user.email ?? '').charAt(0).toUpperCase()}
					</span>
				{/if}
			</span>
		</div>

		<div class="flex min-h-0 flex-1 flex-col">
			{@render children()}
		</div>
	</div>
</div>

<SignInDialog />
