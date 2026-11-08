import { auth } from '#lib/auth.svelte.js';
import { MIN_FOLLOW_UP, caseText } from '#lib/case.js';
import { SAMPLES } from '#lib/samples.js';
import type { ActiveSkill } from '#lib/skills.js';
import { MAX_ATTACHMENTS, MAX_CONTEXT_CHARS, MAX_FACTS, MIN_FACTS, looksLegal } from '#lib/spotter.js';
import type {
	AnalysisMeta,
	Attachment,
	QuotaInfo,
	SpotEvent,
	SourceMatch,
	SpotSection,
	SpotterResult,
	Streamed
} from '#lib/spotter.js';

/** The width at which the verification pane sits beside the results instead of over them. */
export const WIDE_SCREEN = '(min-width: 1024px)';

/** One message the user sent and the analysis it produced. */
export type Exchange = {
	/** What the user typed, exactly. */
	added: string;
	/** The pages attached with this message. */
	attachments: Attachment[];
	/** The analysis of the whole case up to and including this message. */
	result: SpotterResult;
	meta: AnalysisMeta | null;
	/** Verified links by reference key, filled in after the result when verification is on. */
	sources: Record<string, SourceMatch>;
	/** Whether this analysis's references are being checked against real pages. */
	verification: 'idle' | 'running' | 'done';
};

function emptyStreamed(): Streamed {
	return { summary: [], counterArguments: [], issues: [], doctrines: [], precedents: [], acts: [] };
}

/**
 * The conversation. It lives outside any page so that opening a Learn page and coming back keeps
 * it. Each message the user adds is analysed together with everything before it, and its analysis
 * is appended below the earlier ones, which stay where they are.
 */
class Workspace {
	/** The draft: what is about to be sent. */
	facts = $state('');
	/** Skills switched on for the next analyses. They stay on until switched off. */
	skills = $state<ActiveSkill[]>([]);
	/** The skills the analysis in progress was started with, which decide what its progress shows. */
	runSkills = $state<ActiveSkill[]>([]);
	/** Pages attached to the message being written. */
	draftAttachments = $state<Attachment[]>([]);
	/** Adding a page fetches it, which takes a moment and can fail. */
	urlStatus = $state<'idle' | 'loading'>('idle');
	urlError = $state('');
	/** Every message sent so far, each with its analysis, oldest first. */
	thread = $state<Exchange[]>([]);
	/** The message being analysed right now, shown as a bubble once there is a conversation. */
	pending = $state<string | null>(null);
	isLoading = $state(false);
	errorMessage = $state('');
	notice = $state('');
	stage = $state<'verifying' | 'analyzing' | null>(null);
	/** Live updates from the stream win over the value loaded with the page. */
	liveQuota = $state<QuotaInfo | null>(null);
	/** Entries found so far while the analysis is still being written, by section. */
	streamed = $state<Streamed>(emptyStreamed());
	/** Sections the model has finished writing. */
	closed = $state<SpotSection[]>([]);
	/** The verification pane beside the results. */
	paneOpen = $state(true);

	/** The most recent analysis, which the verification pane describes. */
	latest = $derived(this.thread.at(-1) ?? null);
	/** Whether the next message adds to a conversation instead of starting one. */
	followUp = $derived(this.thread.length > 0);
	/** The messages of the case so far. */
	turns = $derived(this.thread.map((exchange) => exchange.added));
	/** Every page attached so far, in the order they were added. */
	attachments = $derived([...this.thread.flatMap((exchange) => exchange.attachments), ...this.draftAttachments]);

	/** The whole case, which is what the limit applies to, not just the draft. */
	charCount = $derived(caseText(this.turns, this.facts).length);
	overLimit = $derived(this.charCount > MAX_FACTS);
	showContextTip = $derived(
		this.facts.trim().length >= 40 && !looksLegal(caseText(this.turns, this.facts))
	);

	#sampleIndex = 0;
	#abort: AbortController | null = null;
	/** Tells one search from the next, so a stopped search cannot touch the state of a newer one. */
	#run = 0;
	/** The model and time reported for the analysis being written, attached when it completes. */
	#meta: AnalysisMeta | null = null;

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

	/** Empties what is about to be sent. The conversation is untouched. */
	clearDraft() {
		this.facts = '';
		this.errorMessage = '';
		this.notice = '';
	}

	/** Starts over: forgets the conversation. */
	clearAll() {
		this.#abort?.abort();
		this.#run += 1;
		this.isLoading = false;
		this.stage = null;
		this.pending = null;
		this.facts = '';
		this.errorMessage = '';
		this.notice = '';
		this.thread = [];
		this.draftAttachments = [];
		this.urlError = '';
	}

	toggleSkill(skill: ActiveSkill) {
		this.skills = this.skills.includes(skill)
			? this.skills.filter((active) => active !== skill)
			: [...this.skills, skill];
	}

	/**
	 * Fetches a page from an allowed legal site on the server and attaches its text to the message
	 * being written. Returns whether it was added.
	 */
	async addUrl(raw: string): Promise<boolean> {
		const url = raw.trim();
		this.urlError = '';
		if (!url) return false;
		if (this.attachments.length >= MAX_ATTACHMENTS) {
			this.urlError = `You can attach up to ${MAX_ATTACHMENTS} pages to a case.`;
			return false;
		}

		this.urlStatus = 'loading';
		try {
			const response = await fetch('/api/source', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify({ url })
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok) {
				this.urlError = payload?.error ?? 'That page could not be added.';
				if (payload?.code === 'auth_invalid') await auth.signOut();
				return false;
			}

			const page: Attachment = payload.attachment;
			if (this.attachments.some((existing) => existing.url === page.url)) {
				this.urlError = 'That page is already attached.';
				return false;
			}
			const total = this.attachments.reduce((sum, existing) => sum + existing.text.length, 0);
			if (total + page.text.length > MAX_CONTEXT_CHARS) {
				this.urlError = 'The attached pages are already as long as one case can hold. Remove one first.';
				return false;
			}

			this.draftAttachments.push(page);
			return true;
		} catch {
			this.urlError = 'Network error. Please try again.';
			return false;
		} finally {
			this.urlStatus = 'idle';
		}
	}

	/** Takes back a page attached to the message being written. */
	removeAttachment(url: string) {
		this.draftAttachments = this.draftAttachments.filter((page) => page.url !== url);
	}

	/**
	 * Takes the last message back into the composer to rewrite it. Its analysis goes with it; the
	 * earlier exchanges stay.
	 */
	editLast() {
		const last = this.thread.pop();
		if (!last) return;
		this.facts = last.added;
		this.draftAttachments = last.attachments;
		this.errorMessage = '';
		this.notice = '';
	}

	#handleEvent(event: SpotEvent, added: string) {
		if ('quota' in event) {
			this.liveQuota = event.quota;
		} else if ('stage' in event) {
			if (event.stage === 'sourcing') {
				const latest = this.thread.at(-1);
				if (latest) latest.verification = 'running';
			} else {
				this.stage = event.stage;
			}
		} else if ('sources' in event) {
			const latest = this.thread.at(-1);
			if (latest) {
				latest.sources = Object.fromEntries(event.sources.map((match) => [match.key, match]));
				latest.verification = 'done';
			}
		} else if ('item' in event) {
			if (event.item.section === 'acts') this.streamed.acts.push(event.item.value);
			else if (event.item.section === 'precedents') this.streamed.precedents.push(event.item.value);
			else if (event.item.section === 'counterArguments') {
				this.streamed.counterArguments.push(event.item.value);
			} else this.streamed[event.item.section].push(event.item.value);
		} else if ('meta' in event) {
			this.#meta = event.meta;
		} else if ('sectionDone' in event) {
			if (!this.closed.includes(event.sectionDone)) this.closed.push(event.sectionDone);
		} else if ('result' in event) {
			this.thread.push({
				added,
				attachments: this.draftAttachments,
				meta: this.#meta,
				sources: {},
				verification: 'idle',
				result: {
					...(Array.isArray(event.result?.summary) && { summary: event.result.summary }),
					...(Array.isArray(event.result?.counterArguments) && {
						counterArguments: event.result.counterArguments
					}),
					jurisdiction:
						typeof event.result?.jurisdiction === 'string' ? event.result.jurisdiction : undefined,
					issues: Array.isArray(event.result?.issues) ? event.result.issues : [],
					doctrines: Array.isArray(event.result?.doctrines) ? event.result.doctrines : [],
					precedents: Array.isArray(event.result?.precedents) ? event.result.precedents : [],
					acts: Array.isArray(event.result?.acts) ? event.result.acts : []
				}
			});
			this.facts = '';
			this.draftAttachments = [];
			this.pending = null;
			// The answer is complete. Anything the server sends after it (verified links) fills in
			// later, so the results are shown now instead of waiting for it.
			this.isLoading = false;
			this.stage = null;
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

		// With a conversation on screen, what is typed continues that case instead of starting a new one.
		const added = this.facts;
		const followUp = this.followUp;
		const text = caseText(this.turns, added);

		if (added.trim().length < (followUp ? MIN_FOLLOW_UP : MIN_FACTS)) {
			this.errorMessage = followUp
				? 'Add a few more words about what happened.'
				: `Please provide a fuller factual summary (at least ${MIN_FACTS} characters).`;
			return;
		}
		if (text.length > MAX_FACTS) {
			this.errorMessage = followUp
				? `The case and what you added come to more than ${MAX_FACTS.toLocaleString()} characters. Shorten what you added, or start a new analysis.`
				: `Please keep the factual summary under ${MAX_FACTS.toLocaleString()} characters.`;
			return;
		}

		this.isLoading = true;
		this.pending = added;
		this.streamed = emptyStreamed();
		this.runSkills = [...this.skills];
		this.closed = [];
		this.#meta = null;
		this.#abort?.abort();
		const run = (this.#run += 1);
		this.#abort = new AbortController();
		let answered = false;

		try {
			const response = await fetch('/api/spot', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: {
					'content-type': 'application/json',
					...(await auth.headers())
				},
				body: JSON.stringify({
					facts: text,
					skills: this.runSkills,
					context: this.attachments.map(({ url, title, text, truncated }) => ({
						url,
						title,
						text,
						truncated
					}))
				})
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
					if (run !== this.#run) return;
					const parsed: SpotEvent = JSON.parse(line);
					if ('result' in parsed) answered = true;
					if (answered || 'notLegal' in parsed || 'error' in parsed) finished = true;
					this.#handleEvent(parsed, added);
				}

				if (done) break;
			}

			if (!finished) {
				this.errorMessage = 'The analysis ended unexpectedly. Please try again.';
			}
		} catch (error) {
			if (run !== this.#run) return;
			if ((error as Error)?.name === 'AbortError') {
				// Stopping while the answer is still being written. After it, nothing is left to stop.
				if (!answered) {
					this.notice =
						'Search stopped. Your text is kept, and the search still counts toward today.';
				}
			} else if (!answered) {
				this.errorMessage = 'Network error. Please try again.';
			}
		} finally {
			if (run === this.#run) {
				this.#abort = null;
				this.isLoading = false;
				this.stage = null;
				this.pending = null;
				// The stream may have ended mid-verification; the search links simply stay.
				const latest = this.thread.at(-1);
				if (latest && latest.verification === 'running') latest.verification = 'done';
			}
		}
	}
}

export const workspace = new Workspace();
