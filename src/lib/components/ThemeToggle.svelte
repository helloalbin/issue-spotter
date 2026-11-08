<script lang="ts">
	import { theme } from '#lib/theme.svelte.js';
	import Icon from './Icon.svelte';

	let light = $derived(theme.resolved === 'light');
</script>

<button
	type="button"
	onclick={() => theme.toggle()}
	aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
	class="grid size-[34px] place-items-center rounded-md border border-border-default bg-surface-2 text-text-secondary transition hover:text-text-primary"
>
	<Icon name={light ? 'sun' : 'moon'} />
</button>
