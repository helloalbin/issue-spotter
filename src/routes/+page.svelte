<script lang="ts">
	import { MAX_FACTS, MIN_FACTS } from '#lib/spotter.js';
	import type { SpotEvent, SpotterResult } from '#lib/spotter.js';

	const SAMPLE_FACTS =
		'A tenant slipped on a wet staircase in a rented apartment building after repeated written complaints to the landlord about the leak. The tenant suffered a fractured ankle and missed two months of work.';

	let facts = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let notice = $state('');
	let stage = $state<'verifying' | 'analyzing' | null>(null);
	let result = $state<SpotterResult | null>(null);

	let charCount = $derived(facts.length);
	let overLimit = $derived(facts.length > MAX_FACTS);
	let statusText = $derived(
		stage === 'verifying'
			? 'Checking that this is a legal fact pattern…'
			: stage === 'analyzing'
				? 'Spotting issues, doctrines, precedents and acts…'
				: ''
	);
	let summary = $derived(
		result
			? `${result.issues.length} issues · ${result.doctrines.length} doctrines · ${result.precedents.length} precedents · ${result.acts.length} acts`
			: ''
	);

	function fillSample() {
		facts = SAMPLE_FACTS;
		errorMessage = '';
		notice = '';
	}

	function clearAll() {
		facts = '';
		errorMessage = '';
		notice = '';
		result = null;
	}

	function handleEvent(event: SpotEvent) {
		if ('stage' in event) {
			stage = event.stage;
		} else if ('result' in event) {
			result = {
				issues: Array.isArray(event.result?.issues) ? event.result.issues : [],
				doctrines: Array.isArray(event.result?.doctrines) ? event.result.doctrines : [],
				precedents: Array.isArray(event.result?.precedents) ? event.result.precedents : [],
				acts: Array.isArray(event.result?.acts) ? event.result.acts : []
			};
		} else if ('notLegal' in event) {
			notice = "This doesn't look like a legal fact pattern. Update the facts and try again.";
		} else if ('error' in event) {
			errorMessage = event.error;
		}
	}

	async function submitCase(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		notice = '';
		result = null;

		if (facts.trim().length < MIN_FACTS) {
			errorMessage = `Please provide a fuller factual summary (at least ${MIN_FACTS} characters).`;
			return;
		}
		if (facts.length > MAX_FACTS) {
			errorMessage = `Please keep the factual summary under ${MAX_FACTS.toLocaleString()} characters.`;
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/spot', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ facts })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				errorMessage = payload?.error ?? 'Unable to analyze the case summary right now.';
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let finished = false;

			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split('\n');
				buffer = done ? '' : (lines.pop() ?? '');

				for (const line of lines) {
					if (!line.trim()) continue;
					const parsed: SpotEvent = JSON.parse(line);
					if (!('stage' in parsed)) finished = true;
					handleEvent(parsed);
				}

				if (done) break;
			}

			if (!finished) {
				errorMessage = 'The analysis ended unexpectedly. Please try again.';
			}
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			isLoading = false;
			stage = null;
		}
	}
</script>

<svelte:head>
	<title>Case Law Issue Spotter</title>
	<meta
		name="description"
		content="Paste hypothetical case facts and get likely legal issues, doctrines, landmark precedents, and applicable acts with sections."
	/>
</svelte:head>

<main class="min-h-screen bg-stone-200/60 px-4 py-10 text-stone-900">
	<div class="mx-auto max-w-6xl">
		<header class="overflow-hidden rounded-xl bg-stone-900 text-stone-50 shadow-md">
			<div class="px-6 py-8 sm:px-10">
				<p class="inline-block rounded-full border border-stone-700 px-3 py-1 text-xs text-stone-300">
					For law students &middot; learning aid, not legal advice
				</p>
				<h1 class="mt-3 text-3xl font-semibold tracking-tight">Case Law Issue Spotter</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-stone-300">
					Paste a raw case summary. The assistant identifies likely legal issues, governing
					doctrines, landmark precedents, and the acts and sections a student should reach for
					first.
				</p>
			</div>
		</header>

		<div class="mt-6 rounded-xl border border-stone-300 bg-white p-6 shadow-sm sm:p-8">
			<form class="space-y-4" onsubmit={submitCase}>
				<div class="flex items-baseline justify-between gap-4">
					<label for="facts" class="text-sm font-semibold">Case facts</label>
					<span class="text-xs tabular-nums" class:text-red-700={overLimit} class:text-stone-500={!overLimit}>
						{charCount.toLocaleString()} / {MAX_FACTS.toLocaleString()}
					</span>
				</div>
				<textarea
					id="facts"
					bind:value={facts}
					required
					rows="8"
					class="w-full rounded-lg border border-stone-300 bg-white p-3 text-sm leading-6 outline-none transition placeholder:text-stone-400 focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10"
					placeholder="Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord..."
				></textarea>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="submit"
						disabled={isLoading || overLimit}
						class="rounded-lg bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:bg-stone-400"
					>
						{isLoading ? 'Analyzing…' : 'Spot issues'}
					</button>
					<button
						type="button"
						onclick={fillSample}
						class="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100"
					>
						Use sample facts
					</button>
					<button
						type="button"
						onclick={clearAll}
						class="rounded-lg px-4 py-2 text-sm text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
					>
						Clear
					</button>
				</div>
			</form>

			{#if errorMessage}
				<p class="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
					{errorMessage}
				</p>
			{/if}
		</div>

		{#if isLoading}
			<div class="mt-6 grid gap-4 md:grid-cols-3" aria-hidden="true">
				{#each ['Issues', 'Doctrines', 'Precedents'] as label}
					<div class="rounded-xl border border-stone-300 bg-white p-5 shadow-sm">
						<div class="h-4 w-24 animate-pulse rounded bg-stone-200"></div>
						<div class="mt-4 space-y-2">
							<div class="h-3 animate-pulse rounded bg-stone-100"></div>
							<div class="h-3 w-11/12 animate-pulse rounded bg-stone-100"></div>
							<div class="h-3 w-4/5 animate-pulse rounded bg-stone-100"></div>
						</div>
						<span class="sr-only">Loading {label}…</span>
					</div>
				{/each}
			</div>
		{/if}

		{#if result && !isLoading}
			<p class="mt-6 text-sm text-stone-600">{summary}</p>

			<section class="mt-3 grid gap-4 md:grid-cols-3">
				<article class="rounded-xl border border-stone-300 border-t-4 border-t-stone-900 bg-white p-5 shadow-sm">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold">Primary legal issues</h2>
						<span class="rounded-full bg-stone-900 px-2 py-0.5 text-xs font-medium text-white">
							{result.issues.length}
						</span>
					</div>
					{#if result.issues.length > 0}
						<ol class="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-stone-800">
							{#each result.issues as item}
								<li>{item}</li>
							{/each}
						</ol>
					{:else}
						<p class="mt-3 text-sm text-stone-500">No distinct issues identified.</p>
					{/if}
				</article>

				<article class="rounded-xl border border-stone-300 border-t-4 border-t-amber-700 bg-white p-5 shadow-sm">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold">Relevant doctrines</h2>
						<span class="rounded-full bg-amber-700 px-2 py-0.5 text-xs font-medium text-white">
							{result.doctrines.length}
						</span>
					</div>
					{#if result.doctrines.length > 0}
						<ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-stone-800">
							{#each result.doctrines as item}
								<li>{item}</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-3 text-sm text-stone-500">No doctrines identified.</p>
					{/if}
				</article>

				<article class="rounded-xl border border-stone-300 border-t-4 border-t-stone-500 bg-white p-5 shadow-sm">
					<div class="flex items-center justify-between">
						<h2 class="text-sm font-semibold">Landmark precedents</h2>
						<span class="rounded-full bg-stone-500 px-2 py-0.5 text-xs font-medium text-white">
							{result.precedents.length}
						</span>
					</div>
					{#if result.precedents.length > 0}
						<ul class="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-stone-800">
							{#each result.precedents as item}
								<li>{item}</li>
							{/each}
						</ul>
					{:else}
						<p class="mt-3 text-sm text-stone-500">No precedents identified.</p>
					{/if}
				</article>
			</section>

			<section class="mt-4 rounded-xl border border-stone-300 bg-white p-5 shadow-sm sm:p-6">
				<div class="flex flex-wrap items-center justify-between gap-2">
					<div>
						<h2 class="text-base font-semibold">Applicable acts &amp; sections</h2>
						<p class="mt-1 text-sm text-stone-600">
							Statutes worth opening first — check the exact section wording in a bare act before citing.
						</p>
					</div>
					<span class="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-medium text-white">
						{result.acts.length} {result.acts.length === 1 ? 'act' : 'acts'}
					</span>
				</div>

				{#if result.acts.length > 0}
					<div class="mt-4 grid gap-4 lg:grid-cols-2">
						{#each result.acts as entry}
							<article class="rounded-lg bg-stone-100/70 p-4 ring-1 ring-stone-200">
								<h3 class="text-sm font-semibold leading-6">{entry.act}</h3>
								{#if entry.relevance}
									<p class="mt-1 text-sm leading-6 text-stone-700">{entry.relevance}</p>
								{/if}
								{#if entry.sections.length > 0}
									<ul class="mt-3 flex flex-wrap gap-1.5">
										{#each entry.sections as section}
											<li
												class="rounded-md border border-stone-300 bg-white px-2 py-1 font-mono text-xs text-stone-800"
											>
												{section}
											</li>
										{/each}
									</ul>
								{:else}
									<p class="mt-2 text-xs text-stone-500">Sections not specified — read the act for the closest provision.</p>
								{/if}
							</article>
						{/each}
					</div>
				{:else}
					<p
						class="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600"
					>
						No specific statute identified for these facts. The issues above may turn on case law
						and general principles instead.
					</p>
				{/if}
			</section>
		{/if}

		<footer class="mt-8 pb-4 text-center text-xs leading-5 text-stone-500">
			Study aid for issue-spotting practice. Always verify sections and precedents against primary
			sources — model output can be incomplete or out of date.
		</footer>
	</div>
</main>
