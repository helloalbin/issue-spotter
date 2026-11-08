<script lang="ts">
	import Button from '#lib/components/Button.svelte';
	import Chip from '#lib/components/Chip.svelte';

	const colors = {
		Surfaces: ['bg', 'surface-1', 'surface-2', 'surface-3'],
		Text: ['text-primary', 'text-secondary', 'text-tertiary', 'text-muted'],
		Borders: ['border-subtle', 'border-default', 'border-strong'],
		'Accent · silver': ['accent', 'accent-hover', 'accent-fg', 'accent-subtle', 'accent-text'],
		Status: ['danger', 'danger-fg', 'danger-subtle', 'danger-border', 'success', 'success-subtle', 'success-text']
	};

	const type = [
		['type-display', 'fs-4xl · 38 · 700', 'Case Law Issue Spotter'],
		['type-h1', 'fs-3xl · 30 · 700', 'Primary legal issues'],
		['type-h2', 'fs-2xl · 24 · 700', 'Relevant doctrines'],
		['type-h3', 'fs-xl · 20 · 600', 'Applicable acts & sections'],
		['type-h4', 'fs-lg · 18 · 600', 'Landmark precedents'],
		['type-lead', 'fs-md · 16 · 400', 'Paste a case summary and the assistant spots likely issues.'],
		['type-body', 'fs-body · 14 · 400', 'Body text, the default reading size for descriptions and lists.'],
		['type-label', 'fs-sm · 13 · 500', 'Field label'],
		['type-meta', 'fs-caption · 12 · 500 mono', 'META · 0 / 12,000']
	];

	const spacing = [
		['space-xs', 'p-1', 'w-1'],
		['space-sm', 'p-2', 'w-2'],
		['space-md', 'p-3', 'w-3'],
		['space-lg', 'p-4', 'w-4'],
		['space-xl', 'p-6', 'w-6'],
		['space-2xl', 'p-8', 'w-8'],
		['space-3xl', 'p-12', 'w-12']
	];

	const radii = [
		['radius-sm', 'rounded-sm'],
		['radius-md', 'rounded-md'],
		['radius-lg', 'rounded-lg'],
		['radius-xl', 'rounded-xl'],
		['radius-2xl', 'rounded-2xl'],
		['radius-pill', 'rounded-pill']
	];
</script>

<svelte:head>
	<title>Design system</title>
</svelte:head>

<main id="main" class="relative flex-1 overflow-y-auto overscroll-contain">
<div class="mx-auto max-w-5xl space-y-12 px-6 py-12">
	<header class="flex items-start justify-between gap-6">
		<div>
			<p class="type-meta text-text-tertiary">DESIGN SYSTEM</p>
			<h1 class="type-h1 mt-2">Tokens and primitives</h1>
			<p class="type-body mt-2 max-w-xl text-text-secondary">
				Development reference. Every value here comes from a token in layout.css; use the theme
				toggle to check both.
			</p>
		</div>
	</header>

	<section class="space-y-6">
		<h2 class="type-h3">Color</h2>
		{#each Object.entries(colors) as [group, names]}
			<div>
				<p class="type-meta mb-3 text-text-tertiary tracking-widest">{group.toUpperCase()}</p>
				<ul class="flex flex-wrap gap-4">
					{#each names as name}
						<li class="w-28">
							<div
								class="h-14 rounded-lg border border-border-default"
								style="background: var(--{name})"
							></div>
							<p class="type-label mt-2">{name}</p>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>

	<section class="space-y-4">
		<h2 class="type-h3">Typography</h2>
		<div class="space-y-5 rounded-xl border border-border-default bg-surface-1 p-6 shadow-raised">
			{#each type as [cls, spec, sample]}
				<div class="grid gap-1 sm:grid-cols-[11rem_1fr] sm:items-baseline sm:gap-6">
					<p class="type-meta text-text-tertiary">{spec}</p>
					<p class={cls}>{sample}</p>
				</div>
			{/each}
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="type-h3">Spacing · 4px base</h2>
		<ul class="space-y-3 rounded-xl border border-border-default bg-surface-1 p-6 shadow-raised">
			{#each spacing as [name, , width]}
				<li class="flex items-center gap-6">
					<span class="type-meta w-24 text-text-secondary">{name}</span>
					<span class="h-3 rounded-sm bg-text-secondary {width}"></span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-4">
		<h2 class="type-h3">Radius</h2>
		<ul class="flex flex-wrap gap-6">
			{#each radii as [name, cls]}
				<li class="text-center">
					<div class="size-16 border border-border-default bg-surface-2 {cls}"></div>
					<p class="type-meta mt-2 text-text-secondary">{name}</p>
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-4">
		<h2 class="type-h3">Elevation and depth</h2>
		<ul class="grid gap-4 sm:grid-cols-4">
			{#each [['bg', 'page', 'bg-bg'], ['surface-1', 'card', 'bg-surface-1'], ['surface-2', 'input / raised', 'bg-surface-2'], ['surface-3', 'overlay', 'bg-surface-3']] as [name, role, cls]}
				<li class="flex h-28 flex-col justify-end rounded-xl border border-border-default p-4 shadow-raised {cls}">
					<span class="type-meta">{name}</span>
					<span class="text-caption text-text-tertiary">{role}</span>
				</li>
			{/each}
		</ul>
		<ul class="flex gap-4">
			{#each ['border-subtle', 'border-default', 'border-strong'] as name}
				<li class="type-meta rounded-lg border bg-surface-1 px-4 py-3" style="border-color: var(--{name})">
					{name}
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-4">
		<h2 class="type-h3">Primitives</h2>
		<div class="flex flex-wrap items-center gap-3">
			<Button variant="primary">Spot issues</Button>
			<Button>Use sample facts</Button>
			<Button variant="ghost">Clear</Button>
			<Button variant="primary" disabled>Analyzing…</Button>
			<Chip>Landlord &amp; tenant</Chip>
			<Chip mono>Section 73</Chip>
		</div>
	</section>
</div>
</main>
