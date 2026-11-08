<script lang="ts">
	import { CONTACT_TOPICS, contactMailto } from '#lib/contact.js';
	import { dialogs } from '#lib/dialogs.svelte.js';
	import { CONTACT_EMAIL } from '#lib/site.js';
	import Icon from './Icon.svelte';

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (dialogs.contactOpen && !dialog.open) dialog.showModal();
		else if (!dialogs.contactOpen && dialog.open) dialog.close();
	});

	function close() {
		dialogs.contactOpen = false;
	}

	let ready = $derived(dialogs.contactMessage.trim().length > 0);

	function send(event: SubmitEvent) {
		event.preventDefault();
		if (!ready) return;
		location.href = contactMailto(dialogs.contactTopic, dialogs.contactMessage, CONTACT_EMAIL);
		close();
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
			placeholder="How can we help? (required)"
			class="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 p-3 text-body text-text-primary placeholder:text-text-tertiary"
		></textarea>

		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="text-caption text-text-tertiary">
				Opens your mail app with this message ready to send.
				<a href="/privacy" class="text-text-secondary underline hover:text-text-primary">Privacy</a>
			</p>
			<button
				type="submit"
				disabled={!ready}
				class="ml-auto rounded-md border border-btn-border bg-btn px-4 py-2 text-body font-medium text-btn-fg transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
			>
				Send message
			</button>
		</div>
	</form>
</dialog>
