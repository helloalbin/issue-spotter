<script lang="ts">
	import { tick } from 'svelte';
	import { auth } from '#lib/auth.svelte.js';
	import type { IconName } from '#lib/icons.js';
	import { portal } from '#lib/portal.js';
	import { CONTACT_EMAIL } from '#lib/site.js';
	import { workspace } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';

	/** The name and plan on show, and the menu that opens from them: account, help and sign out. */
	type Props = { onNavigate?: () => void };
	let { onNavigate }: Props = $props();

	const PLANS = { free: 'Free', investigative: 'Investigative', researcher: 'Researcher' } as const;
	let name = $derived(auth.user?.name ?? auth.user?.email ?? '');
	let plan = $derived(PLANS[workspace.tier]);

	let open = $state(false);
	let helpOpen = $state(false);
	let wide = $state(true);
	let row = $state<HTMLButtonElement>();
	let menu = $state<HTMLDivElement>();
	let helpRow = $state<HTMLElement>();
	let place = $state({ left: 0, bottom: 0, width: 248 });
	let helpPlace = $state({ left: 0, top: 0 });

	/** Account items that are not built yet are shown, so the menu matches the design, but cannot be used. */
	const account: { label: string; icon: IconName; href?: string }[] = [
		{ label: 'Upgrade plan', icon: 'sparkles' },
		{ label: 'Profile', icon: 'circleUser', href: '/profile' },
		{ label: 'Settings', icon: 'settings', href: '/settings' }
	];

	const help: { label: string; icon: IconName; href: string }[] = [
		{ label: 'FAQs', icon: 'info', href: '/learn/how-it-works' },
		{ label: 'Privacy Policy', icon: 'lock', href: '/privacy' },
		{ label: 'Terms of Service', icon: 'fileText', href: '/terms' },
		{ label: 'Contact Us', icon: 'mail', href: `mailto:${CONTACT_EMAIL}` }
	];

	/** The menu sits directly above the account row, as wide as it is. */
	function position() {
		if (!row) return;
		const rect = row.getBoundingClientRect();
		place = { left: rect.left, bottom: innerHeight - rect.top + 8, width: rect.width };
		wide = matchMedia('(min-width: 768px)').matches;
	}

	/** The submenu opens to the right of the menu, level with the Help row, kept inside the window. */
	function positionHelp() {
		if (!helpRow || !menu) return;
		const rect = helpRow.getBoundingClientRect();
		const menuRect = menu.getBoundingClientRect();
		// Its real height once it is on screen, else an estimate for the first placement.
		const height = document.getElementById('help-submenu')?.offsetHeight ?? help.length * 40 + 16;
		helpPlace = { left: menuRect.right + 18, top: Math.max(8, Math.min(rect.top - 8, innerHeight - height - 8)) };
	}

	async function toggle() {
		if (open) return close(true);
		position();
		open = true;
		await tick();
		menu?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled])')?.focus();
	}

	function close(returnFocus = false) {
		open = false;
		helpOpen = false;
		if (returnFocus) row?.focus();
	}

	async function showHelp() {
		helpOpen = true;
		await tick();
		positionHelp();
		await tick();
		positionHelp();
	}

	function onWindowClick(event: MouseEvent) {
		if (!open) return;
		const target = event.target as Node;
		if (row?.contains(target) || menu?.contains(target) || document.getElementById('help-submenu')?.contains(target)) return;
		close();
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			if (helpOpen) {
				helpOpen = false;
				helpRow?.focus();
			} else close(true);
		} else if (event.key === 'ArrowRight' && document.activeElement === helpRow) {
			void showHelp();
		} else if (event.key === 'ArrowLeft' && helpOpen) {
			helpOpen = false;
			helpRow?.focus();
		} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			const scope = (event.target as HTMLElement).closest('[role="menu"]');
			const items = [...(scope?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled])') ?? [])];
			const at = items.indexOf(document.activeElement as HTMLElement);
			if (items.length > 0) {
				event.preventDefault();
				items[(at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
			}
		}
	}

	const itemClass =
		'flex w-full items-center gap-[11px] rounded-md px-2.5 py-[9px] text-left text-body text-text-secondary outline-none transition hover:bg-surface-2 hover:text-text-primary focus-visible:bg-surface-2 focus-visible:text-text-primary';
	const panelClass = 'z-50 flex flex-col gap-0.5 rounded-xl border border-border-default bg-surface-3 p-2 shadow-overlay';
</script>

<svelte:window onclick={onWindowClick} onkeydown={onKeydown} onresize={() => open && (position(), helpOpen && positionHelp())} />

{#snippet avatar(size: string)}
	<span
		class="grid shrink-0 place-items-center rounded-pill bg-linear-135 from-avatar-from to-avatar-to font-semibold text-avatar-fg {size}"
		aria-hidden="true"
	>
		{name.charAt(0).toUpperCase()}
	</span>
{/snippet}

<button
	bind:this={row}
	type="button"
	onclick={toggle}
	aria-haspopup="menu"
	aria-expanded={open}
	class="flex w-full items-center gap-2.5 rounded-md border border-border-subtle bg-surface-2 p-2 text-left transition hover:bg-surface-3"
>
	{@render avatar('size-[34px] text-[15px]')}
	<span class="min-w-0 flex-1">
		<span class="block truncate text-sm leading-tight font-semibold text-text-primary">{name}</span>
		<span class="block truncate text-caption leading-tight text-text-tertiary">{plan}</span>
	</span>
	<Icon name="chevronRight" size={16} class="shrink-0 text-text-tertiary" />
</button>

{#if open}
	<div
		use:portal
		bind:this={menu}
		role="menu"
		aria-label="Account"
		style="left: {place.left}px; bottom: {place.bottom}px; width: {place.width}px"
		class="fixed {panelClass}"
	>
		<div class="flex items-center gap-2.5 px-2 pt-2 pb-2.5">
			{@render avatar('size-9 text-[15px]')}
			<span class="flex min-w-0 flex-1 flex-col gap-px">
				<span class="truncate text-sm font-semibold text-text-primary">{name}</span>
				<span class="truncate text-caption text-text-tertiary">{plan}</span>
			</span>
		</div>
		<div class="h-px bg-border-subtle"></div>

		{#each account as entry}
			{#if entry.href}
				<a href={entry.href} role="menuitem" onclick={() => (close(), onNavigate?.())} onmouseenter={() => (helpOpen = false)} class={itemClass}>
					<Icon name={entry.icon} size={17} class="text-text-tertiary" />
					<span class="flex-1">{entry.label}</span>
				</a>
			{:else}
				<button type="button" role="menuitem" aria-disabled="true" title="Coming soon" onmouseenter={() => (helpOpen = false)} class="{itemClass} cursor-not-allowed opacity-60 hover:bg-transparent hover:text-text-secondary">
					<Icon name={entry.icon} size={17} class="text-text-tertiary" />
					<span class="flex-1">{entry.label}</span>
					<span class="text-[10px] text-text-tertiary">Soon</span>
				</button>
			{/if}
		{/each}

		<button
			bind:this={helpRow}
			type="button"
			role="menuitem"
			aria-haspopup="menu"
			aria-expanded={helpOpen}
			onclick={() => (helpOpen ? (helpOpen = false) : showHelp())}
			onmouseenter={() => wide && showHelp()}
			class="{itemClass} {helpOpen ? 'bg-surface-2 text-text-primary' : ''}"
		>
			<Icon name="lifeBuoy" size={17} class="text-text-tertiary" />
			<span class="flex-1">Help</span>
			<Icon name="chevronRight" size={15} class="text-text-tertiary {helpOpen && !wide ? 'rotate-90' : ''}" />
		</button>

		{#if helpOpen && !wide}
			<div role="menu" aria-label="Help" id="help-submenu" class="flex flex-col gap-0.5 pl-3">
				{#each help as entry}
					<a href={entry.href} role="menuitem" onclick={() => (close(), onNavigate?.())} class={itemClass}>
						<Icon name={entry.icon} size={16} class="text-text-tertiary" />
						{entry.label}
					</a>
				{/each}
			</div>
		{/if}

		<div class="h-px bg-border-subtle"></div>
		<button
			type="button"
			role="menuitem"
			onclick={() => {
				close();
				auth.signOut();
			}}
			onmouseenter={() => (helpOpen = false)}
			class={itemClass}
		>
			<Icon name="logOut" size={17} class="text-text-tertiary" />
			Sign out
		</button>
	</div>

	{#if helpOpen && wide}
		<div
			use:portal
			id="help-submenu"
			role="menu"
			aria-label="Help"
			style="left: {helpPlace.left}px; top: {helpPlace.top}px"
			class="fixed w-53 {panelClass}"
		>
			{#each help as entry}
				<a href={entry.href} role="menuitem" onclick={() => (close(), onNavigate?.())} class={itemClass}>
					<Icon name={entry.icon} size={16} class="text-text-tertiary" />
					{entry.label}
				</a>
			{/each}
		</div>
	{/if}
{/if}
