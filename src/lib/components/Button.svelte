<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'ghost';
		children: Snippet;
	};

	let { variant = 'secondary', type = 'button', class: className = '', children, ...rest }: Props =
		$props();

	const variants = {
		primary:
			'border border-btn-border bg-btn text-btn-fg font-medium hover:bg-accent-hover disabled:opacity-50',
		secondary:
			'border border-border-default bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary disabled:opacity-50',
		ghost: 'text-text-tertiary hover:text-text-primary disabled:opacity-50'
	};
</script>

<button
	{type}
	class="inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-body transition disabled:cursor-not-allowed {variants[
		variant
	]} {className}"
	{...rest}
>
	{@render children()}
</button>
