<script lang="ts">
	import { auth } from '#lib/auth.svelte.js';
	import { SITE_NAME } from '#lib/site.js';
	import GoogleMark from './GoogleMark.svelte';
	import Icon from './Icon.svelte';
	import Logo from './Logo.svelte';

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (auth.dialogOpen && !dialog.open) dialog.showModal();
		else if (!auth.dialogOpen && dialog.open) dialog.close();
	});

	function close() {
		auth.dialogOpen = false;
	}
</script>

<!-- Escape and the close button end up in onclose; a click on the backdrop lands on the dialog itself. -->
<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(event) => event.target === dialog && close()}
	aria-labelledby="signin-title"
	class="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border-default bg-surface-3 p-0 text-text-primary shadow-raised backdrop:bg-bg/70"
>
	<div class="relative p-6 text-center">
		<button
			type="button"
			onclick={close}
			aria-label="Close"
			class="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-text-tertiary hover:text-text-primary"
		>
			<Icon name="x" />
		</button>

		<span class="mx-auto grid size-12 place-items-center rounded-xl bg-accent-subtle">
			<Logo size={32} />
		</span>
		<h2 id="signin-title" class="type-h4 mt-4">Sign in to {SITE_NAME}</h2>
		<p class="type-body mt-2 text-text-secondary">
			Signed-in accounts get more searches each day than anonymous visitors.
		</p>

		<button
			type="button"
			onclick={() => auth.signIn()}
			disabled={!auth.ready || auth.signingIn}
			class="mt-6 flex w-full items-center justify-center gap-3 rounded-md border border-btn-border bg-btn px-4 py-2.5 text-body font-medium text-btn-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
		>
			<GoogleMark />
			{auth.signingIn ? 'Signing in…' : 'Continue with Google'}
		</button>

		{#if auth.error}
			<p role="alert" class="mt-3 text-sm text-danger">{auth.error}</p>
		{/if}

		<p class="mt-4 text-caption text-text-tertiary">
			By continuing, you agree to our
			<a href="/terms" target="_blank" rel="noopener" class="underline hover:text-text-primary">Terms</a> and
			<a href="/privacy" target="_blank" rel="noopener" class="underline hover:text-text-primary">Privacy Policy</a>.
		</p>
	</div>
</dialog>
