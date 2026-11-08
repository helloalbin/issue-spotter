<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { mono?: boolean; class?: string; children: Snippet };
	let { mono = false, class: className = '', children }: Props = $props();
</script>

<span
	class="inline-flex items-center gap-1 rounded-pill border border-border-default px-3 py-1 text-caption text-text-tertiary {mono
		? 'font-mono'
		: ''} {className}"
>
	{@render children()}
</span>
