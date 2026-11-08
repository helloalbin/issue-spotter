<script lang="ts">
	type Props = { size?: number };
	let { size = 17 }: Props = $props();
</script>

<!-- The mark from the design's brand block: three streaks and a chevron on a 120-unit grid. -->
<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 120 120"
	fill="none"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path
		class="stroke-accent-text"
		stroke-width="4"
		d="M61.41 53.59l-32.52 32.52m16.97-35.35l-21.22 21.21m39.6-2.83l-21.21 21.22"
	/>
	<path class="stroke-accent-text" stroke-width="6.5" d="M53.64 41.15l25.45-4.24-4.24 25.45" />
</svg>
