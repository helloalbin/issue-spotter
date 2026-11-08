<script lang="ts">
	import { icons } from '#lib/icons.js';
	import type { IconName } from '#lib/icons.js';

	type Props = { name: IconName; size?: number; class?: string };
	let { name, size = 16, class: className = '' }: Props = $props();
	const Component = $derived(icons[name]);
</script>

<Component {size} class={className} aria-hidden="true" />
