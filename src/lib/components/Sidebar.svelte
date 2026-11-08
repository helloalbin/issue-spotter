<script lang="ts">
	import { CONTACT_EMAIL, SITE_NAME } from '#lib/site.js';
	import Icon from './Icon.svelte';

	type Props = {
		open: boolean;
		user: { name: string | null; email: string | null } | null;
		authConfigured: boolean;
		onNew: () => void;
		onClose: () => void;
		onSignIn: () => void;
		onSignOut: () => void;
	};

	let { open, user, authConfigured, onNew, onClose, onSignIn, onSignOut }: Props = $props();

	const label = $derived(user?.name ?? user?.email ?? '');
</script>

{#if open}
	<button
		type="button"
		aria-label="Close menu"
		onclick={onClose}
		class="fixed inset-0 z-30 bg-black/50 md:hidden"
	></button>
{/if}

<aside
	id="sidebar"
	class="fixed inset-y-0 left-0 z-40 flex w-68 flex-col justify-between border-r border-border-subtle bg-bg p-3 transition-transform md:static md:translate-x-0 {open
		? 'translate-x-0'
		: 'max-md:invisible max-md:-translate-x-full'}"
>
	<div>
		<div class="flex items-center justify-between px-2 py-3">
			<a href="/" class="flex items-center gap-3">
				<span class="grid size-8 place-items-center rounded-lg bg-surface-2 text-text-secondary">
					<Icon name="scale" size={18} />
				</span>
				<span>
					<span class="block text-base leading-tight font-medium">{SITE_NAME}</span>
					<span class="block text-[11px] leading-tight text-text-tertiary">Case law practice</span>
				</span>
			</a>
			<button
				type="button"
				onclick={onClose}
				aria-label="Close menu"
				class="grid size-8 place-items-center rounded-lg text-text-tertiary hover:text-text-primary md:hidden"
			>
				<Icon name="x" />
			</button>
		</div>

		<nav aria-label="Main" class="mt-4 space-y-1">
			<a
				href="/"
				onclick={(event) => {
					event.preventDefault();
					onNew();
				}}
				class="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm"
			>
				<Icon name="plus" />
				New analysis
			</a>
		</nav>

		<p class="mt-6 mb-2 px-3 font-mono text-[11px] tracking-widest text-text-tertiary">ABOUT</p>
		<nav aria-label="About" class="space-y-1 text-sm text-text-secondary">
			<a href="/privacy" class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-1 hover:text-text-primary">
				<Icon name="shield" />
				Privacy
			</a>
			<a href="/terms" class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-1 hover:text-text-primary">
				<Icon name="fileText" />
				Terms
			</a>
			<a
				href="mailto:{CONTACT_EMAIL}"
				class="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-surface-1 hover:text-text-primary"
			>
				<Icon name="mail" />
				Contact
			</a>
		</nav>
	</div>

	<div class="space-y-3">
		<div class="rounded-xl border border-border-subtle bg-surface-1 p-3">
			<p class="flex items-center gap-2 text-[13px] font-medium">
				<Icon name="shield" size={14} />
				Learning aid
			</p>
			<p class="mt-2 text-xs leading-5 text-text-tertiary">
				Not legal advice. Always verify issues, sections, and precedents against primary sources.
			</p>
		</div>

		{#if authConfigured}
			{#if user}
				<div class="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-1 p-2">
					<span
						class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[13px] font-medium"
						aria-hidden="true"
					>
						{label.charAt(0).toUpperCase()}
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate text-[13px] font-medium">{user.name ?? user.email}</span>
						{#if user.name && user.email}
							<span class="block truncate text-[11px] text-text-tertiary">{user.email}</span>
						{/if}
					</span>
					<button
						type="button"
						onclick={onSignOut}
						aria-label="Sign out"
						class="grid size-8 shrink-0 place-items-center rounded-lg text-text-tertiary hover:text-text-primary"
					>
						<Icon name="logOut" />
					</button>
				</div>
			{:else}
				<button
					type="button"
					onclick={onSignIn}
					class="flex w-full items-center justify-center gap-2 rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-[13px] font-medium transition hover:bg-surface-3"
				>
					<Icon name="logIn" />
					Sign in
				</button>
			{/if}
		{/if}
	</div>
</aside>
