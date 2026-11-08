<script lang="ts">
	import { page } from '$app/state';
	import Icon from '#lib/components/Icon.svelte';
	import type { IconName } from '#lib/icons.js';
	import { SITE_NAME } from '#lib/site.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/** The sections of settings. Those without a link are not built yet and are shown, unusable, so the menu matches the design. */
	const SECTIONS: { label: string; icon: IconName; href?: string }[] = [
		{ label: 'Appearance', icon: 'sun', href: '/settings/appearance' },
		{ label: 'Usage', icon: 'gauge', href: '/settings/usage' },
		{ label: 'Data controls', icon: 'database', href: '/settings/data' },
		{ label: 'Account', icon: 'circleUser', href: '/settings/account' }
	];

	let query = $state('');
	let shown = $derived(SECTIONS.filter((section) => section.label.toLowerCase().includes(query.trim().toLowerCase())));
</script>

<svelte:head>
	<title>Settings · {SITE_NAME}</title>
</svelte:head>

<main id="main" class="relative flex-1 overflow-y-auto overscroll-contain">
	<div class="mx-auto flex min-h-full w-full max-w-[960px] flex-col md:flex-row">
		<aside class="flex shrink-0 flex-col gap-[18px] border-b border-border-subtle bg-surface-1 px-3.5 py-5 md:w-[300px] md:border-r md:border-b-0">
			<h1 class="text-xl font-bold text-text-primary">Settings</h1>

			<label class="flex items-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-[11px] py-[9px] focus-within:border-border-strong">
				<Icon name="search" size={15} class="shrink-0 text-text-tertiary" />
				<span class="sr-only">Search settings</span>
				<input
					bind:value={query}
					type="search"
					name="settings-search"
					autocomplete="off"
					placeholder="Search settings"
					class="min-w-0 flex-1 bg-transparent text-[13px] text-text-primary outline-none placeholder:text-text-muted"
				/>
			</label>

			<nav aria-label="Settings" class="flex flex-col gap-0.5">
				{#each shown as section}
					{#if section.href}
						{@const active = page.url.pathname === section.href}
						<a
							href={section.href}
							aria-current={active ? 'page' : undefined}
							class="flex items-center gap-[11px] rounded-md px-2.5 py-[9px] text-body transition {active ? 'bg-surface-2 font-medium text-text-primary' : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'}"
						>
							<Icon name={section.icon} size={17} class={active ? 'text-text-primary' : 'text-text-tertiary'} />
							{section.label}
						</a>
					{:else}
						<span aria-disabled="true" title="Coming soon" class="flex cursor-not-allowed items-center gap-[11px] rounded-md px-2.5 py-[9px] text-body text-text-secondary opacity-60">
							<Icon name={section.icon} size={17} class="text-text-tertiary" />
							<span class="flex-1">{section.label}</span>
							<span class="text-[10px] text-text-tertiary">Soon</span>
						</span>
					{/if}
				{:else}
					<p class="px-2.5 py-2 text-caption text-text-tertiary" role="status">No settings match "{query}".</p>
				{/each}
			</nav>
		</aside>

		<div class="flex flex-1 flex-col gap-[26px] px-5 py-7 md:px-8">
			{@render children()}
		</div>
	</div>
</main>
