<script lang="ts">
	import { auth } from '#lib/auth.svelte.js';
	import { CONTACT_TOPICS, MAX_MESSAGE, contactMailto, parseContact } from '#lib/contact.js';
	import { dialogs } from '#lib/dialogs.svelte.js';
	import { CONTACT_EMAIL } from '#lib/site.js';
	import Icon from './Icon.svelte';

	let dialog = $state<HTMLDialogElement>();
	let email = $state('');
	let sending = $state(false);
	let sentTo = $state('');
	let error = $state('');

	$effect(() => {
		if (!dialog) return;
		if (dialogs.contactOpen && !dialog.open) {
			// A fresh form each time it opens, with the signed-in address filled in.
			sentTo = '';
			error = '';
			email = auth.user?.email ?? email;
			dialog.showModal();
		} else if (!dialogs.contactOpen && dialog.open) dialog.close();
	});

	function close() {
		dialogs.contactOpen = false;
	}

	let ready = $derived(dialogs.contactMessage.trim().length > 0 && email.trim().length > 0 && !sending);

	async function send(event: SubmitEvent) {
		event.preventDefault();
		const parsed = parseContact({ topic: dialogs.contactTopic, message: dialogs.contactMessage, email });
		if (!parsed.ok) {
			error = parsed.error;
			return;
		}
		sending = true;
		error = '';
		try {
			const response = await fetch('/api/contact', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify(parsed.input)
			});
			if (response.ok) {
				sentTo = parsed.input.email;
				dialogs.contactMessage = '';
				dialogs.contactTopic = null;
			} else {
				const body = (await response.json().catch(() => ({}))) as { error?: string };
				error = body.error ?? 'The message could not be sent.';
			}
		} catch {
			error = 'The message could not be sent. Check your connection and try again.';
		} finally {
			sending = false;
		}
	}
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(event) => event.target === dialog && close()}
	aria-labelledby="contact-title"
	class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border-default bg-surface-3 p-0 text-text-primary shadow-raised backdrop:bg-bg/70"
>
	<form onsubmit={send} class="flex flex-col gap-4 p-6">
		<div class="flex items-center justify-between">
			<h2 id="contact-title" class="type-h4">Contact us</h2>
			<button type="button" onclick={close} aria-label="Close" class="grid size-8 place-items-center rounded-md text-text-tertiary hover:text-text-primary">
				<Icon name="x" />
			</button>
		</div>

		{#if sentTo}
			<div class="flex flex-col gap-3 py-4" role="status">
				<p class="text-body text-text-primary">Message sent.</p>
				<p class="text-body text-text-secondary">We will reply to {sentTo}.</p>
				<button type="button" onclick={close} class="mt-2 w-fit rounded-md border border-border-default bg-surface-2 px-4 py-2 text-body text-text-secondary hover:bg-surface-3 hover:text-text-primary">Close</button>
			</div>
		{:else}
			<div class="flex flex-wrap gap-2" role="group" aria-label="What is this about?">
				{#each CONTACT_TOPICS as topic}
					<button
						type="button"
						aria-pressed={dialogs.contactTopic === topic}
						onclick={() => (dialogs.contactTopic = dialogs.contactTopic === topic ? null : topic)}
						class="inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-caption transition {dialogs.contactTopic === topic
							? 'border-border-strong bg-surface-2 text-text-primary'
							: 'border-border-default text-text-tertiary hover:text-text-primary'}"
					>
						{#if dialogs.contactTopic === topic}<Icon name="check" size={12} />{:else}<Icon name="plus" size={12} />{/if}
						{topic}
					</button>
				{/each}
			</div>

			<label class="sr-only" for="contact-message">How can we help?</label>
			<textarea
				id="contact-message"
				bind:value={dialogs.contactMessage}
				required
				rows="5"
				maxlength={MAX_MESSAGE}
				placeholder="How can we help? (required)"
				class="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 p-3 text-body text-text-primary placeholder:text-text-tertiary"
			></textarea>

			<label class="sr-only" for="contact-email">Your email, so we can reply</label>
			<input
				id="contact-email"
				type="email"
				bind:value={email}
				required
				autocomplete="email"
				placeholder="Your email, so we can reply (required)"
				class="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2.5 text-body text-text-primary placeholder:text-text-tertiary"
			/>

			{#if error}
				<p role="alert" class="text-sm text-danger">
					{error}
					<a href={contactMailto(dialogs.contactTopic, dialogs.contactMessage, CONTACT_EMAIL)} class="underline">Open your mail app instead</a>
				</p>
			{/if}

			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="text-caption text-text-tertiary">
					We use your email only to reply.
					<a href="/privacy" class="text-text-secondary underline hover:text-text-primary">Privacy</a>
				</p>
				<button
					type="submit"
					disabled={!ready}
					class="ml-auto rounded-md border border-btn-border bg-btn px-4 py-2 text-body font-medium text-btn-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
				>
					{sending ? 'Sending…' : 'Send message'}
				</button>
			</div>
		{/if}
	</form>
</dialog>
