<script lang="ts">
	import { onMount } from 'svelte';
	import {
		FIREBASE_API_KEY,
		FIREBASE_APP_ID,
		FIREBASE_AUTH_DOMAIN,
		FIREBASE_AUTH_EMULATOR_URL,
		FIREBASE_PROJECT_ID
	} from '$app/env/public';
	import type { Auth } from 'firebase/auth';
	import { MAX_FACTS, MIN_FACTS, looksLegal } from '#lib/spotter.js';
	import type { QuotaInfo, SpotEvent, SpotterResult } from '#lib/spotter.js';
	import AnalysisResult from '#lib/components/AnalysisResult.svelte';
	import Button from '#lib/components/Button.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import Progress from '#lib/components/Progress.svelte';
	import Sidebar from '#lib/components/Sidebar.svelte';
	import SignInDialog from '#lib/components/SignInDialog.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { SAMPLES } from '#lib/samples.js';
	import { SITE_NAME } from '#lib/site.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const authConfigured = Boolean(
		FIREBASE_API_KEY && FIREBASE_AUTH_DOMAIN && FIREBASE_PROJECT_ID && FIREBASE_APP_ID
	);
	// The emulator is a development tool and is never used in a production build.
	const emulatorUrl = import.meta.env.PROD ? undefined : FIREBASE_AUTH_EMULATOR_URL;

	let facts = $state('');
	// The facts behind the analysis on screen. The composer is emptied once a result arrives.
	let submittedFacts = $state('');
	let menuOpen = $state(false);
	let signInOpen = $state(false);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let notice = $state('');
	// Live updates from the stream win over the value loaded with the page.
	let liveQuota = $state<QuotaInfo | null>(null);
	let quota = $derived(liveQuota ?? data.quota);
	let mounted = $state(false);
	let user = $state<{ name: string | null; email: string | null } | null>(null);
	let authReady = $state(false);
	let signingIn = $state(false);
	let firebase: typeof import('#lib/firebase.js') | null = null;
	let auth: Auth | null = null;

	onMount(async () => {
		mounted = true;
		if (!authConfigured) return;

		firebase = await import('#lib/firebase.js');
		auth = firebase.getFirebaseAuth({
			apiKey: FIREBASE_API_KEY!,
			authDomain: FIREBASE_AUTH_DOMAIN!,
			projectId: FIREBASE_PROJECT_ID!,
			appId: FIREBASE_APP_ID!,
			emulatorUrl
		});
		authReady = true;
		firebase.onAuthStateChanged(auth, (current) => {
			user = current ? { name: current.displayName, email: current.email } : null;
			refreshQuota();
		});
	});
	let stage = $state<'verifying' | 'analyzing' | null>(null);
	let result = $state<SpotterResult | null>(null);

	let charCount = $derived(facts.length);
	let overLimit = $derived(facts.length > MAX_FACTS);
	let outOfSearches = $derived(quota !== null && quota.remaining === 0);
	// Local reset time is only known in the browser, so wait for mount to avoid a hydration mismatch.
	let resetTime = $derived(
		quota && mounted
			? new Date(quota.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
			: 'later today'
	);
	let showContextTip = $derived(facts.trim().length >= 40 && !looksLegal(facts));
	/** The Firebase ID token (refreshed by the SDK when needed) as a request header, if signed in. */
	async function authHeaders(): Promise<Record<string, string>> {
		const token = await auth?.currentUser?.getIdToken();
		return token ? { authorization: `Bearer ${token}` } : {};
	}

	/** Re-reads the remaining searches for whoever is signed in (or the anonymous visitor). */
	async function refreshQuota() {
		try {
			const response = await fetch('/api/me', { headers: await authHeaders() });
			if (response.ok) liveQuota = (await response.json()).quota;
		} catch {
			// The counter keeps its last value.
		}
	}

	async function signIn() {
		if (!firebase || !auth) return;
		errorMessage = '';
		signingIn = true;
		try {
			await firebase.signInWithPopup(auth, new firebase.GoogleAuthProvider());
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
				errorMessage = 'Sign-in failed. Please try again.';
			}
		} finally {
			signingIn = false;
		}
	}

	async function signOutUser() {
		if (firebase && auth) await firebase.signOut(auth);
	}

	function fillSample(sampleFacts: string) {
		facts = sampleFacts;
		errorMessage = '';
		notice = '';
	}

	function clearAll() {
		facts = '';
		errorMessage = '';
		notice = '';
		result = null;
		submittedFacts = '';
	}

	function newAnalysis() {
		clearAll();
		menuOpen = false;
	}

	/** Puts the analysed facts back in the composer for editing. */
	function editFacts() {
		facts = submittedFacts;
		result = null;
	}

	function handleEvent(event: SpotEvent) {
		if ('quota' in event) {
			liveQuota = event.quota;
		} else if ('stage' in event) {
			stage = event.stage;
		} else if ('result' in event) {
			submittedFacts = facts;
			facts = '';
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
					'content-type': 'application/json',
					...(await authHeaders())
				},
				body: JSON.stringify({ facts })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				if (payload?.code === 'quota_exceeded') {
					liveQuota = payload.quota;
				} else if (payload?.code === 'auth_invalid') {
					errorMessage = payload.error;
					await signOutUser();
				} else {
					errorMessage = payload?.error ?? 'Unable to analyze the case summary right now.';
				}
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
					if (!('stage' in parsed) && !('quota' in parsed)) finished = true;
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
	<title>{SITE_NAME}</title>
	<meta
		name="description"
		content="Paste hypothetical case facts and get likely legal issues, doctrines, landmark precedents, and applicable acts with sections."
	/>
</svelte:head>

{#snippet messages()}
	{#if errorMessage}
		<p
			role="alert"
			class="type-body rounded-lg border border-danger-border bg-danger-subtle p-3 text-danger"
		>
			{errorMessage}
		</p>
	{/if}

	{#if outOfSearches}
		<p class="type-body rounded-lg border border-border-default bg-surface-2 p-3 text-text-secondary">
			{#if quota?.signedIn}
				You have used today's {quota.limit} searches. They reset at {resetTime}. Your text is kept,
				and credits are coming soon.
			{:else if authConfigured}
				You have used today's {quota?.limit} free searches. They reset at {resetTime}. Your text is
				kept.
				<button
					type="button"
					onclick={() => (signInOpen = true)}
					class="underline hover:text-text-primary"
				>
					Sign in with Google for more.
				</button>
			{:else}
				You have used today's {quota?.limit} free searches. They reset at {resetTime}. Your text is
				kept, and more access is coming soon.
			{/if}
		</p>
	{/if}

	<div role="status" aria-live="polite">
		{#if notice}
			<p class="type-body rounded-lg border border-border-default bg-surface-2 p-3 text-text-secondary">
				{notice}
			</p>
		{/if}
	</div>
{/snippet}

{#snippet composer(docked: boolean)}
	<form
		onsubmit={submitCase}
		class="rounded-2xl border border-border-default bg-surface-1 p-4 shadow-raised focus-within:border-border-strong"
	>
		<label for="facts" class="sr-only">Case facts</label>
		<textarea
			id="facts"
			name="facts"
			bind:value={facts}
			readonly={isLoading}
			required
			autocomplete="off"
			rows={docked ? 2 : 5}
			placeholder={docked
				? 'Paste new facts to start another analysis…'
				: 'Example: A tenant slipped on a wet staircase in a rented apartment building after repeated complaints to the landlord about a broken light and a leaking pipe…'}
			class="type-body w-full resize-none bg-transparent text-text-primary outline-none"
		></textarea>

		<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
			<span class="type-meta tabular-nums {overLimit ? 'text-danger' : 'text-text-tertiary'}">
				{isLoading ? 'Context locked' : `${charCount.toLocaleString()} / ${MAX_FACTS.toLocaleString()}`}
			</span>
			{#if quota}
				<span class="text-caption tabular-nums text-text-tertiary">
					{quota.remaining} of {quota.limit}
					{quota.signedIn ? '' : 'free '}searches left today
				</span>
			{/if}
			<span class="ml-auto flex items-center gap-2">
				<Button variant="ghost" onclick={clearAll}>Clear</Button>
				<Button variant="primary" type="submit" disabled={isLoading || overLimit || outOfSearches}>
					{isLoading ? 'Analyzing…' : 'Spot issues'}
				</Button>
			</span>
		</div>
	</form>

	{#if showContextTip}
		<p class="mt-3 text-caption text-text-tertiary">
			Tip: say who did what to whom, and what harm, dispute or right is at stake. Legal context
			helps the spotter find the right issues.
		</p>
	{/if}
{/snippet}

<a
	href="#main"
	class="sr-only rounded-md bg-btn px-3 py-2 text-btn-fg focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
>
	Skip to content
</a>

<div class="flex h-dvh overflow-hidden bg-bg">
	<Sidebar
		open={menuOpen}
		{user}
		{authConfigured}
		onNew={newAnalysis}
		onClose={() => (menuOpen = false)}
		onSignIn={() => {
			menuOpen = false;
			signInOpen = true;
		}}
		onSignOut={signOutUser}
	/>

	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex items-center justify-between px-4 py-3">
			<button
				type="button"
				onclick={() => (menuOpen = true)}
				aria-label="Open menu"
				aria-controls="sidebar"
				aria-expanded={menuOpen}
				class="grid size-9 place-items-center rounded-lg border border-border-default bg-surface-2 text-text-secondary hover:text-text-primary md:hidden"
			>
				<Icon name="menu" />
			</button>
			<span class="ml-auto"><ThemeToggle /></span>
		</div>

		<main id="main" class="flex-1 overflow-y-auto">
			{#if isLoading}
				<Progress {stage} />
			{:else if result}
				<AnalysisResult facts={submittedFacts} {result} onEdit={editFacts} />
			{:else}
				<div class="mx-auto flex min-h-full w-full max-w-2xl flex-col px-6 pb-6">
					<div class="my-auto py-10">
						<h1 class="type-h1 text-center">What are the facts?</h1>
						<p class="type-lead mx-auto mt-3 max-w-xl text-center text-text-secondary">
							Paste a case summary and {SITE_NAME} surfaces the likely legal issues, governing
							doctrines, landmark precedents, and the acts and sections to check.
						</p>

						<div class="mt-8">{@render composer(false)}</div>
						<div class="mt-3 space-y-3">{@render messages()}</div>

						<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
							<span class="text-caption text-text-tertiary">Try a sample</span>
							{#each SAMPLES as sample}
								<button
									type="button"
									onclick={() => fillSample(sample.facts)}
									class="rounded-pill border border-border-default px-3 py-1.5 text-sm text-text-tertiary transition hover:bg-surface-2 hover:text-text-primary"
								>
									{sample.label}
								</button>
							{/each}
						</div>
					</div>

					<footer class="text-center text-caption text-text-tertiary">
						Study aid for issue-spotting practice. Always verify sections and precedents against
						primary sources. Model output can be incomplete or out of date.
						<span class="mt-1 block">
							<a href="/privacy" class="underline hover:text-text-primary">Privacy</a>
							·
							<a href="/terms" class="underline hover:text-text-primary">Terms</a>
						</span>
					</footer>
				</div>
			{/if}
		</main>

		{#if isLoading || result}
			<div class="border-t border-border-subtle px-6 py-4">
				<div class="mx-auto w-full max-w-3xl">
					{@render composer(true)}
					<div class="mt-3 space-y-3">{@render messages()}</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<SignInDialog
	open={signInOpen}
	ready={authReady}
	{signingIn}
	onSignIn={signIn}
	onClose={() => (signInOpen = false)}
/>
