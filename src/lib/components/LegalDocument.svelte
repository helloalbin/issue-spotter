<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from '#lib/site.js';
	import Icon from './Icon.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	type Props = { title: string; children: Snippet };
	let { title, children }: Props = $props();
</script>

<svelte:head>
	<title>{title} · {SITE_NAME}</title>
</svelte:head>

<div class="min-h-dvh bg-bg">
	<header class="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
		<a href="/" class="flex items-center gap-3 text-text-primary">
			<span class="grid size-8 place-items-center rounded-lg bg-surface-2 text-text-secondary">
				<Icon name="scale" size={18} />
			</span>
			<span class="text-lg font-medium">{SITE_NAME}</span>
		</a>
		<ThemeToggle />
	</header>

	<main class="mx-auto max-w-2xl px-6 pt-6 pb-16">
		<h1 class="type-h1">{title}</h1>
		<p class="type-meta mt-3 text-text-tertiary">Last updated {LEGAL_UPDATED}</p>

		<div class="legal type-body">
			{@render children()}
		</div>

		<footer class="mt-12 border-t border-border-subtle pt-6 text-caption text-text-tertiary">
			<a href="/" class="underline hover:text-text-primary">Back to {SITE_NAME}</a>
			·
			<a href="/privacy" class="underline hover:text-text-primary">Privacy</a>
			·
			<a href="/terms" class="underline hover:text-text-primary">Terms</a>
			·
			<a href="mailto:{CONTACT_EMAIL}" class="underline hover:text-text-primary">{CONTACT_EMAIL}</a>
		</footer>
	</main>
</div>
