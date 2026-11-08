<script lang="ts">
	import { activityStore } from '#lib/activity.svelte.js';
	import { auth } from '#lib/auth.svelte.js';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import { clearPreferences } from '#lib/data-controls.js';
	import { CONTACT_EMAIL, SITE_NAME } from '#lib/site.js';
	import { speech } from '#lib/speech.svelte.js';
	import { theme } from '#lib/theme.svelte.js';
	import { workspace } from '#lib/workspace.svelte.js';

	const PLANS = { free: 'Free', investigative: 'Investigative', researcher: 'Researcher' } as const;
	let resolved = $derived(auth.changes > 0);

	let confirming = $state(false);
	let deleting = $state(false);
	let message = $state('');

	async function deleteAccount() {
		deleting = true;
		message = '';
		const failure = await auth.deleteAccount();
		deleting = false;
		if (failure) {
			message = failure;
			return;
		}
		// The account is gone, so the tally and choices kept for it in this browser go too.
		activityStore.reset();
		clearPreferences(localStorage);
		theme.reset();
		speech.resetPrefs();
		confirming = false;
		message = 'Your account was deleted and what this browser kept for it was cleared.';
	}

	const rowClass = 'flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3.5';
	const dangerButton = 'inline-flex items-center justify-center rounded-md border border-danger-border bg-danger-subtle px-3.5 py-1.5 text-sm text-danger transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50';
</script>

<svelte:head>
	<title>Account · Settings · {SITE_NAME}</title>
</svelte:head>

<h2 class="type-h2 font-bold">Account</h2>

{#if !resolved}
	<p class="py-16 text-center text-body text-text-tertiary" aria-live="polite">Loading your account…</p>
{:else if !auth.user}
	{#if message}
		<p class="text-body text-text-secondary" role="status">{message}</p>
	{:else}
		<section class="flex flex-col items-start gap-3 py-2">
			<p class="max-w-md text-body text-text-secondary">Sign in to see your account.</p>
			{#if auth.configured}
				<Button variant="primary" class="gap-2 px-4 py-2.5" onclick={() => auth.openDialog()}>
					<Icon name="logIn" />
					Sign In for Free
				</Button>
			{/if}
		</section>
	{/if}
{:else}
	<section class="flex flex-col gap-3" aria-labelledby="general-title">
		<h3 id="general-title" class="text-lg font-medium text-text-primary">General</h3>
		<dl class="flex flex-col rounded-xl border border-border-subtle bg-surface-1 [&>div+div]:border-t [&>div+div]:border-border-subtle">
			<div class={rowClass}>
				<dt class="text-body text-text-secondary">Name</dt>
				<dd class="min-w-0 truncate text-body text-text-primary">{auth.user.name ?? 'Not shared by Google'}</dd>
			</div>
			<div class={rowClass}>
				<dt class="text-body text-text-secondary">Email</dt>
				<dd class="min-w-0 truncate text-body text-text-primary">{auth.user.email ?? 'Not shared by Google'}</dd>
			</div>
			<div class={rowClass}>
				<dt class="text-body text-text-secondary">Plan</dt>
				<dd class="text-body text-text-primary">{PLANS[workspace.tier]}</dd>
			</div>
		</dl>
		<p class="text-caption text-text-tertiary">
			Your name and email come from your Google account and are changed there. To correct anything
			else we hold, write to <a href="mailto:{CONTACT_EMAIL}" class="underline">{CONTACT_EMAIL}</a>.
		</p>
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="delete-title">
		<h3 id="delete-title" class="text-lg font-medium text-text-primary">Delete account</h3>
		<div class="flex flex-col rounded-xl border border-border-subtle bg-surface-1">
			<div class={rowClass}>
				<div class="flex min-w-0 flex-1 flex-col gap-0.5">
					<span class="text-body font-medium text-text-primary">Delete your account</span>
					<span class="max-w-md text-caption text-text-tertiary">
						Removes your sign-in, name and email from {SITE_NAME} and clears your activity numbers and
						choices from this browser. Google will ask you to confirm first. Your Google account is not
						touched.
					</span>
				</div>
				{#if confirming}
					<span class="flex flex-wrap items-center gap-2" role="alert">
						<span class="text-sm text-text-secondary">This cannot be undone.</span>
						<button type="button" class={dangerButton} onclick={deleteAccount} disabled={deleting}>
							{deleting ? 'Deleting…' : 'Yes, delete'}
						</button>
						<Button variant="ghost" class="px-3 py-1.5 text-sm" onclick={() => (confirming = false)} disabled={deleting}>Cancel</Button>
					</span>
				{:else}
					<button type="button" class={dangerButton} onclick={() => (confirming = true)}>Delete</button>
				{/if}
			</div>
		</div>
		<p class="max-w-xl text-caption text-text-tertiary">
			The small daily and monthly usage counters are not removed. They are tied to an account number,
			not to your name, and they keep the limits from being reset by deleting and signing up again. See the
			<a href="/privacy" class="underline">Privacy page</a>.
		</p>
		{#if message}
			<p class="text-caption text-text-secondary" role="status">{message}</p>
		{/if}
	</section>
{/if}
