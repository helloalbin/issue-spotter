<script lang="ts">
	import { dialogs } from '#lib/dialogs.svelte.js';
	import { PLANS, PRICE_NOTE, priceLabel } from '#lib/plans.js';
	import type { Plan } from '#lib/plans.js';
	import { workspace } from '#lib/workspace.svelte.js';
	import Icon from './Icon.svelte';

	let dialog = $state<HTMLDialogElement>();

	$effect(() => {
		if (!dialog) return;
		if (dialogs.plansOpen && !dialog.open) dialog.showModal();
		else if (!dialogs.plansOpen && dialog.open) dialog.close();
	});

	function close() {
		dialogs.plansOpen = false;
	}

	function ask(plan: Plan) {
		dialogs.openContact('Billing', `I would like the ${plan.name} plan.`);
	}
</script>

<dialog
	bind:this={dialog}
	onclose={close}
	onclick={(event) => event.target === dialog && close()}
	aria-labelledby="plans-title"
	class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-border-default bg-surface-3 p-0 text-text-primary shadow-raised backdrop:bg-bg/70"
>
	<div class="relative p-6 sm:p-8">
		<button type="button" onclick={close} aria-label="Close" class="absolute top-3 right-3 grid size-8 place-items-center rounded-md text-text-tertiary hover:text-text-primary">
			<Icon name="x" />
		</button>
		<h2 id="plans-title" class="type-h3 text-center">Upgrade your plan</h2>

		<div class="mt-6 grid gap-4 md:grid-cols-3">
			{#each PLANS as plan (plan.id)}
				{@const current = plan.id === workspace.tier}
				<section class="flex flex-col gap-4 rounded-xl border bg-surface-1 p-5 {plan.id === 'investigative' ? 'border-border-strong' : 'border-border-subtle'}" aria-labelledby="plan-{plan.id}">
					<div class="flex flex-col gap-1">
						<span class="type-meta tracking-widest text-text-tertiary">{plan.name.toUpperCase()}</span>
						<h3 id="plan-{plan.id}" class="text-lg font-medium text-text-primary">{plan.tagline}</h3>
						<p class="text-caption text-text-tertiary">{plan.blurb}</p>
					</div>
					<p class="flex items-baseline gap-1">
						<span class="text-3xl font-semibold text-text-primary">{priceLabel(plan)}</span>
						<span class="text-caption text-text-tertiary">/month{plan.price ? ' approx.' : ''}</span>
					</p>
					{#if current}
						<span class="rounded-md border border-border-default bg-surface-2 px-4 py-2 text-center text-body text-text-tertiary">Current plan</span>
					{:else if plan.price}
						<button type="button" onclick={() => ask(plan)} class="rounded-md border border-btn-border bg-btn px-4 py-2 text-body font-medium text-btn-fg transition hover:bg-accent-hover">
							Ask about {plan.name}
						</button>
					{:else}
						<span class="rounded-md border border-border-default bg-surface-2 px-4 py-2 text-center text-body text-text-tertiary">Included</span>
					{/if}
					<ul class="flex flex-col gap-2.5 text-body text-text-secondary">
						{#each plan.features as feature}
							<li class="flex gap-2">
								<Icon name="check" size={16} class="mt-0.5 shrink-0 text-text-tertiary" />
								<span>{feature}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
		</div>

		<p class="mx-auto mt-5 max-w-2xl text-center text-caption text-text-tertiary">{PRICE_NOTE}</p>
	</div>
</dialog>
