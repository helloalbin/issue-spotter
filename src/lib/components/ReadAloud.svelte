<script lang="ts">
	import { RATES } from '#lib/speech.js';
	import { speech } from '#lib/speech.svelte.js';
	import Icon from './Icon.svelte';

	/**
	 * The "Read aloud" action of a result. `script` is built only when the button is pressed. While
	 * this result is being read the button becomes pause or resume, a stop button and a speed menu.
	 */
	type Props = { id: string; script: () => string };
	let { id, script }: Props = $props();

	let active = $derived(speech.activeId === id);
	let paused = $derived(active && speech.status === 'paused');
	let menuOpen = $state(false);
	let wrapper = $state<HTMLDivElement>();

	const rateLabel = (rate: number) => `${rate}×`;
	const buttonClass =
		'flex items-center gap-2 rounded-md border border-border-default px-3 py-1.5 text-sm text-text-secondary transition hover:bg-surface-2 hover:text-text-primary';

	function onWindowClick(event: MouseEvent) {
		if (menuOpen && wrapper && !wrapper.contains(event.target as Node)) menuOpen = false;
	}
	function onWindowKeydown(event: KeyboardEvent) {
		if (menuOpen && event.key === 'Escape') menuOpen = false;
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

{#if speech.supported}
	{#if !active}
		<button type="button" onclick={() => speech.toggle(id, script())} class={buttonClass}>
			<Icon name="volume2" size={14} />
			Read aloud
		</button>
	{:else}
		<div class="flex items-center gap-1.5" role="group" aria-label="Read aloud controls">
			<button type="button" onclick={() => speech.toggle(id, script())} class={buttonClass}>
				<Icon name={paused ? 'play' : 'pause'} size={14} />
				{paused ? 'Resume' : 'Pause'}
			</button>
			<button type="button" onclick={() => speech.stop()} aria-label="Stop reading" title="Stop" class="{buttonClass} px-2.5">
				<Icon name="square" size={12} />
			</button>
			<div bind:this={wrapper} class="relative">
				<button
					type="button"
					onclick={() => (menuOpen = !menuOpen)}
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					aria-label="Reading speed, {rateLabel(speech.rate)}"
					class="{buttonClass} px-2.5 tabular-nums"
				>
					{rateLabel(speech.rate)}
				</button>
				{#if menuOpen}
					<div role="menu" aria-label="Reading speed" class="absolute bottom-full left-0 z-20 mb-2 flex w-28 flex-col rounded-lg border border-border-default bg-surface-3 p-1 shadow-overlay">
						{#each RATES as rate}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={speech.rate === rate}
								onclick={() => (speech.setRate(rate), (menuOpen = false))}
								class="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm tabular-nums hover:bg-surface-2 {speech.rate === rate ? 'text-text-primary' : 'text-text-secondary'}"
							>
								{rateLabel(rate)}
								{#if speech.rate === rate}<Icon name="check" size={13} class="text-accent-text" />{/if}
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
	<span class="sr-only" role="status">{active ? (paused ? 'Paused' : 'Reading aloud') : ''}</span>
{/if}
