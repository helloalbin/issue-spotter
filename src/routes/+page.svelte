<script lang="ts">
	type SpotterResult = {
		issues: string[];
		doctrines: string[];
		precedents: string[];
	};

	let facts = $state('');
	let isLoading = $state(false);
	let errorMessage = $state('');
	let result = $state<SpotterResult | null>(null);

	async function submitCase(event: SubmitEvent) {
		event.preventDefault();
		errorMessage = '';
		result = null;

		if (facts.trim().length < 20) {
			errorMessage = 'Please provide a fuller factual summary (at least 20 characters).';
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

			const payload = await response.json();

			if (!response.ok) {
				errorMessage = payload?.error ?? 'Unable to analyze the case summary right now.';
				return;
			}

			result = payload;
		} catch {
			errorMessage = 'Network error. Please try again.';
		} finally {
			isLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Case Law Issue Spotter</title>
	<meta
		name="description"
		content="Paste hypothetical case facts and get likely legal issues, doctrines, and landmark precedents."
	/>
</svelte:head>

<main class="min-h-screen bg-stone-100 px-4 py-10 text-stone-900">
	<div class="mx-auto max-w-4xl rounded-lg border border-stone-300 bg-white p-6 shadow-sm">
		<header class="mb-6">
			<h1 class="text-2xl font-semibold tracking-tight">Case Law Issue Spotter</h1>
			<p class="mt-2 text-sm text-stone-700">
				Paste a raw case summary. The assistant will identify likely legal issues, doctrines, and landmark
				precedents for student-level analysis.
			</p>
		</header>

		<form class="space-y-4" onsubmit={submitCase}>
			<label for="facts" class="block text-sm font-medium">Case Facts</label>
			<textarea
				id="facts"
				bind:value={facts}
				required
				rows="10"
				class="w-full rounded-md border border-stone-300 bg-white p-3 text-sm leading-6 outline-none ring-stone-900/20 transition focus:ring"
				placeholder="Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord..."
			></textarea>

			<div class="flex items-center gap-3">
				<button
					type="submit"
					disabled={isLoading}
					class="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500"
				>
					{isLoading ? 'Analyzing…' : 'Spot Issues'}
				</button>
				<p class="text-xs text-stone-600">No legal advice. For learning and issue-spotting only.</p>
			</div>
		</form>

		{#if errorMessage}
			<p class="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{errorMessage}</p>
		{/if}

		{#if result}
			<section class="mt-8 grid gap-4 md:grid-cols-3">
				<article class="rounded-md border border-stone-200 p-4">
					<h2 class="text-sm font-semibold">Primary Legal Issues</h2>
					<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-800">
						{#each result.issues as item}
							<li>{item}</li>
						{/each}
					</ul>
				</article>

				<article class="rounded-md border border-stone-200 p-4">
					<h2 class="text-sm font-semibold">Relevant Legal Doctrines</h2>
					<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-800">
						{#each result.doctrines as item}
							<li>{item}</li>
						{/each}
					</ul>
				</article>

				<article class="rounded-md border border-stone-200 p-4">
					<h2 class="text-sm font-semibold">Potential Landmark Precedents</h2>
					<ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-800">
						{#each result.precedents as item}
							<li>{item}</li>
						{/each}
					</ul>
				</article>
			</section>
		{/if}
	</div>
</main>
