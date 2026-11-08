import { auth } from '#lib/auth.svelte.js';
import { SAMPLES } from '#lib/samples.js';
import { MAX_FACTS, MIN_FACTS, looksLegal } from '#lib/spotter.js';
import type {
	AnalysisMeta,
	QuotaInfo,
	SpotEvent,
	SpotSection,
	SpotterResult,
	Streamed
} from '#lib/spotter.js';

/** The width at which the verification pane sits beside the results instead of over them. */
export const WIDE_SCREEN = '(min-width: 1024px)';

/**
 * The analysis in progress. It lives outside any page so that opening a Learn page and coming back
 * keeps the facts and the result.
 */
class Workspace {
	facts = $state('');
	/** The facts behind the analysis on screen. The composer is emptied once a result arrives. */
	submittedFacts = $state('');
	isLoading = $state(false);
	errorMessage = $state('');
	notice = $state('');
	stage = $state<'verifying' | 'analyzing' | null>(null);
	result = $state<SpotterResult | null>(null);
	/** Live updates from the stream win over the value loaded with the page. */
	liveQuota = $state<QuotaInfo | null>(null);
	/** Entries found so far while the analysis is still being written, by section. */
	streamed = $state<Streamed>({ issues: [], doctrines: [], precedents: [], acts: [] });
	/** The model and time behind the result on screen. */
	meta = $state<AnalysisMeta | null>(null);
	/** The verification pane beside the results. */
	paneOpen = $state(true);
	/** Sections the model has finished writing. */
	closed = $state<SpotSection[]>([]);

	charCount = $derived(this.facts.length);
	overLimit = $derived(this.facts.length > MAX_FACTS);
	showContextTip = $derived(this.facts.trim().length >= 40 && !looksLegal(this.facts));

	#sampleIndex = 0;
	#abort: AbortController | null = null;

	/** Re-reads the remaining searches for whoever is signed in (or the anonymous visitor). */
	async refreshQuota() {
		try {
			const response = await fetch('/api/me', { headers: await auth.headers() });
			if (response.ok) this.liveQuota = (await response.json()).quota;
		} catch {
			// The counter keeps its last value.
		}
	}

	fillSample(sampleFacts: string) {
		this.facts = sampleFacts;
		this.errorMessage = '';
		this.notice = '';
	}

	/** Loads the next sample in turn, for the "Use sample facts" shortcut. */
	nextSample() {
		this.fillSample(SAMPLES[this.#sampleIndex % SAMPLES.length].facts);
		this.#sampleIndex += 1;
	}

	clearAll() {
		this.facts = '';
		this.errorMessage = '';
		this.notice = '';
		this.result = null;
		this.submittedFacts = '';
	}

	/** Puts the analysed facts back in the composer for editing. */
	editFacts() {
		this.facts = this.submittedFacts;
		this.result = null;
	}

	#handleEvent(event: SpotEvent) {
		if ('quota' in event) {
			this.liveQuota = event.quota;
		} else if ('stage' in event) {
			this.stage = event.stage;
		} else if ('item' in event) {
			if (event.item.section === 'acts') this.streamed.acts.push(event.item.value);
			else if (event.item.section === 'precedents') this.streamed.precedents.push(event.item.value);
			else this.streamed[event.item.section].push(event.item.value);
		} else if ('meta' in event) {
			this.meta = event.meta;
		} else if ('sectionDone' in event) {
			if (!this.closed.includes(event.sectionDone)) this.closed.push(event.sectionDone);
		} else if ('result' in event) {
			this.submittedFacts = this.facts;
			this.facts = '';
			this.result = {
				jurisdiction:
					typeof event.result?.jurisdiction === 'string' ? event.result.jurisdiction : undefined,
				issues: Array.isArray(event.result?.issues) ? event.result.issues : [],
				doctrines: Array.isArray(event.result?.doctrines) ? event.result.doctrines : [],
				precedents: Array.isArray(event.result?.precedents) ? event.result.precedents : [],
				acts: Array.isArray(event.result?.acts) ? event.result.acts : []
			};
		} else if ('notLegal' in event) {
			this.notice = "This doesn't look like a legal fact pattern. Update the facts and try again.";
		} else if ('error' in event) {
			this.errorMessage = event.error;
		}
	}

	togglePane() {
		this.paneOpen = !this.paneOpen;
		// Only a choice made on a wide screen is remembered; on a narrow one the pane is an overlay.
		if (!matchMedia(WIDE_SCREEN).matches) return;
		try {
			localStorage.setItem('pane', this.paneOpen ? 'open' : 'closed');
		} catch {
			// The choice still applies for this visit.
		}
	}

	/** Stops the search in progress. The provider stops writing, but the search still counts. */
	stop() {
		this.#abort?.abort();
	}

	async submit() {
		if (this.isLoading) return;
		this.errorMessage = '';
		this.notice = '';
		this.result = null;

		if (this.facts.trim().length < MIN_FACTS) {
			this.errorMessage = `Please provide a fuller factual summary (at least ${MIN_FACTS} characters).`;
			return;
		}
		if (this.facts.length > MAX_FACTS) {
			this.errorMessage = `Please keep the factual summary under ${MAX_FACTS.toLocaleString()} characters.`;
			return;
		}

		this.isLoading = true;
		this.streamed = { issues: [], doctrines: [], precedents: [], acts: [] };
		this.closed = [];
		this.meta = null;
		this.#abort = new AbortController();

		try {
			const response = await fetch('/api/spot', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: {
					'content-type': 'application/json',
					...(await auth.headers())
				},
				body: JSON.stringify({ facts: this.facts })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				if (payload?.code === 'quota_exceeded') {
					this.liveQuota = payload.quota;
				} else if (payload?.code === 'auth_invalid') {
					this.errorMessage = payload.error;
					await auth.signOut();
				} else {
					this.errorMessage = payload?.error ?? 'Unable to analyze the case summary right now.';
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
					if ('result' in parsed || 'notLegal' in parsed || 'error' in parsed) finished = true;
					this.#handleEvent(parsed);
				}

				if (done) break;
			}

			if (!finished) {
				this.errorMessage = 'The analysis ended unexpectedly. Please try again.';
			}
		} catch (error) {
			if ((error as Error)?.name === 'AbortError') {
				this.notice = 'Search stopped. Your text is kept, and the search still counts toward today.';
			} else {
				this.errorMessage = 'Network error. Please try again.';
			}
		} finally {
			this.#abort = null;
			this.isLoading = false;
			this.stage = null;
		}
	}
}

export const workspace = new Workspace();
