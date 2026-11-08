<script lang="ts">
	import Icon from './Icon.svelte';

	type Props = { message: string };
	let { message }: Props = $props();
</script>

<!-- The design's error: a compact neutral notice, with only the icon in the danger color. -->
<p
	role="alert"
	class="inline-flex max-w-full items-center gap-2.5 rounded-md border border-border-default bg-surface-2 px-4 py-[11px] text-body leading-[18px] font-medium text-text-secondary"
>
	<Icon name="triangleAlert" size={18} class="shrink-0 text-danger" />
	{message}
</p>
