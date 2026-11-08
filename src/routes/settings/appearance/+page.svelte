<script lang="ts">
	import { MODES } from '#lib/theme.js';
	import type { Mode } from '#lib/theme.js';
	import { theme } from '#lib/theme.svelte.js';
	import { SITE_NAME } from '#lib/site.js';

	const LABELS: Record<Mode, string> = { light: 'Light', system: 'System', dark: 'Dark' };

	/** Left and right arrows move the choice, as in any group of radio buttons. */
	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const at = MODES.indexOf(theme.mode);
		const next = MODES[(at + (event.key === 'ArrowRight' ? 1 : -1) + MODES.length) % MODES.length];
		theme.set(next);
		(event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus();
	}
</script>

<svelte:head>
	<title>Appearance · Settings · {SITE_NAME}</title>
</svelte:head>

<h2 class="type-h2 font-bold">Appearance</h2>

<section class="flex flex-col gap-3.5" aria-labelledby="visual-style">
	<h3 id="visual-style" class="text-[13px] font-semibold text-text-secondary">Visual style</h3>

	<div class="flex flex-wrap items-center justify-between gap-4">
		<span id="mode-label" class="text-body text-text-secondary">Mode</span>
		<!-- svelte-ignore a11y_interactive_supports_focus -->
		<div role="radiogroup" aria-labelledby="mode-label" onkeydown={onKeydown} class="flex gap-2.5">
			{#each MODES as mode}
				{@const selected = theme.mode === mode}
				<button
					type="button"
					role="radio"
					aria-checked={selected}
					tabindex={selected ? 0 : -1}
					data-mode={mode}
					onclick={() => theme.set(mode)}
					class="flex flex-col items-center gap-[7px] rounded-md outline-offset-4"
				>
					<!-- A miniature of each theme, drawn with that theme's own tokens whichever one is showing. -->
					<span class="flex h-12 w-[72px] overflow-hidden rounded-md border {selected ? 'border-accent-text' : 'border-border-default'}" aria-hidden="true">
						{#if mode === 'system'}
							<span data-scope="light" class="h-full w-1/2 bg-bg"></span>
							<span data-scope="dark" class="h-full w-1/2 bg-bg"></span>
						{:else}
							<span data-scope={mode} class="flex h-full w-full bg-bg">
								<span class="h-full w-5 bg-surface-2"></span>
							</span>
						{/if}
					</span>
					<span class="text-caption {selected ? 'font-semibold text-text-primary' : 'text-text-tertiary'}">{LABELS[mode]}</span>
				</button>
			{/each}
		</div>
	</div>
</section>
