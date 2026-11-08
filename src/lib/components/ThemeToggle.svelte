<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from './Icon.svelte';

	let light = $state(false);

	onMount(() => {
		light = document.documentElement.dataset.theme === 'light';
	});

	function toggle() {
		light = !light;
		document.documentElement.dataset.theme = light ? 'light' : 'dark';
		try {
			localStorage.setItem('theme', light ? 'light' : 'dark');
		} catch {
			// The theme still applies for this visit.
		}
	}
</script>

<button
	type="button"
	onclick={toggle}
	aria-label={light ? 'Switch to dark theme' : 'Switch to light theme'}
	class="grid size-9 place-items-center rounded-lg border border-border-default bg-surface-2 text-text-secondary transition hover:text-text-primary"
>
	<Icon name={light ? 'moon' : 'sun'} />
</button>
