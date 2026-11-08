<script lang="ts">
	import { page } from '$app/state';
	import { auth } from '#lib/auth.svelte.js';
	import { CONTACT_EMAIL, SITE_NAME } from '#lib/site.js';
	import type { IconName } from '#lib/icons.js';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';

	type Props = { open: boolean; onNew: () => void; onClose: () => void };
	let { open, onNew, onClose }: Props = $props();

	const learn = [
		{ href: '/learn/how-it-works', label: 'How it works', icon: 'info' },
		{ href: '/learn/guide', label: 'Issue-spotting guide', icon: 'graduationCap' },
		{ href: '/learn/glossary', label: 'Glossary', icon: 'bookMarked' }
	] as const;

	const about = [
		{ href: '/privacy', label: 'Privacy', icon: 'shield' },
		{ href: '/terms', label: 'Terms', icon: 'fileText' }
	] as const;

	const label = $derived(auth.user?.name ?? auth.user?.email ?? '');
</script>

{#snippet item(href: string, text: string, icon: IconName, onclick?: (e: MouseEvent) => void)}
	{@const active = page.url.pathname === href}
	<a
		{href}
		{onclick}
		aria-current={active ? 'page' : undefined}
		class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body transition {active
			? 'bg-surface-2 font-medium text-text-primary'
			: 'text-text-secondary hover:bg-surface-1 hover:text-text-primary'}"
	>
		<Icon name={icon} size={18} class={active ? 'text-text-primary' : 'text-text-tertiary'} />
		{text}
	</a>
{/snippet}

{#if open}
	<button
		type="button"
		aria-label="Close menu"
		onclick={onClose}
		class="fixed inset-0 z-30 bg-bg/70 md:hidden"
	></button>
{/if}

<aside
	id="sidebar"
	class="fixed inset-y-0 left-0 z-40 flex w-68 flex-col justify-between overflow-y-auto border-r border-border-subtle bg-bg px-3 py-4 transition-transform md:static md:translate-x-0 {open
		? 'translate-x-0'
		: 'max-md:invisible max-md:-translate-x-full'}"
>
	<div class="flex flex-col gap-5">
		<div class="flex items-center justify-between p-1.5">
			<a href="/" class="flex items-center gap-2.5">
				<span class="grid size-[30px] place-items-center rounded-md bg-accent-subtle">
					<Logo />
				</span>
				<span>
					<span class="block text-md leading-tight font-[650] tracking-[-0.2px]">{SITE_NAME}</span>
					<span class="block text-[11px] leading-tight text-text-tertiary">Case law practice</span>
				</span>
			</a>
			<button
				type="button"
				onclick={onClose}
				aria-label="Close menu"
				class="grid size-8 place-items-center rounded-md text-text-tertiary hover:text-text-primary md:hidden"
			>
				<Icon name="x" />
			</button>
		</div>

		<nav aria-label="Main" class="flex flex-col gap-0.5">
			{@render item('/', 'New analysis', 'plus', (event) => {
				event.preventDefault();
				onNew();
			})}
			{@render item('/samples', 'Sample cases', 'bookOpen')}
		</nav>

		<div class="flex flex-col gap-1.5">
			<p class="px-2.5 font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">LEARN</p>
			<nav aria-label="Learn" class="flex flex-col gap-0.5">
				{#each learn as entry}
					{@render item(entry.href, entry.label, entry.icon)}
				{/each}
			</nav>
		</div>

		<div class="flex flex-col gap-1.5">
			<p class="px-2.5 font-mono text-[11px] font-semibold tracking-[1.2px] text-text-tertiary">ABOUT</p>
			<nav aria-label="About" class="flex flex-col gap-0.5">
				{#each about as entry}
					{@render item(entry.href, entry.label, entry.icon)}
				{/each}
				<a
					href="mailto:{CONTACT_EMAIL}"
					class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-body text-text-secondary transition hover:bg-surface-1 hover:text-text-primary"
				>
					<Icon name="mail" size={18} class="text-text-tertiary" />
					Contact
				</a>
			</nav>
		</div>
	</div>

	<div class="mt-6 flex flex-col gap-3">
		<div class="flex flex-col gap-[7px] rounded-lg border border-border-subtle bg-surface-2 p-4">
			<p class="flex items-center gap-[7px] text-sm font-semibold">
				<Icon name="shieldCheck" size={15} class="text-accent-text" />
				Learning aid
			</p>
			<p class="text-caption text-text-tertiary">
				Not legal advice. Always verify issues, sections, and precedents against primary sources.
			</p>
		</div>

		{#if auth.configured}
			{#if auth.user}
				<div class="flex items-center gap-3 rounded-md border border-border-subtle bg-surface-2 p-2">
					<span
						class="grid size-9 shrink-0 place-items-center rounded-pill bg-surface-3 text-sm font-semibold"
						aria-hidden="true"
					>
						{label.charAt(0).toUpperCase()}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-sm font-semibold">{auth.user.name ?? auth.user.email}</span>
						{#if auth.user.name && auth.user.email}
							<span class="block truncate text-[11px] text-text-tertiary">{auth.user.email}</span>
						{/if}
					</span>
					<button
						type="button"
						onclick={() => auth.signOut()}
						aria-label="Sign out"
						class="grid size-8 shrink-0 place-items-center rounded-md text-text-tertiary hover:text-text-primary"
					>
						<Icon name="logOut" />
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={() => {
						onClose();
						auth.openDialog();
					}}
					class="flex items-center justify-center gap-2 rounded-md border border-border-subtle bg-surface-2 px-3 py-[11px] text-sm transition hover:bg-surface-3"
				>
					<Icon name="logIn" size={15} class="text-text-tertiary" />
					Sign In for Free
				</button>
			{/if}
		{/if}
	</div>
</aside>
