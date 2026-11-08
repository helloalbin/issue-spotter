import { auth } from '#lib/auth.svelte.js';
import { MIN_FOLLOW_UP, caseText } from '#lib/case.js';
import { SAMPLES } from '#lib/samples.js';
import { toggleSkills } from '#lib/skills.js';
import type { ActiveSkill } from '#lib/skills.js';
import {
	MAX_ATTACHMENTS,
	MAX_CONTEXT_CHARS,
	MAX_FACTS,
	MIN_FACTS,
	looksLegal,
	previousOf
} from '#lib/spotter.js';
import type {
	AnalysisMeta,
	Attachment,
	CaseCandidate,
	CompareEvent,
	QuotaInfo,
	ResearchBrief,
	VerifyEvent,
	ResearchEvent,
	SpotEvent,
	SourceMatch,
	SpotSection,
	SpotterResult,
	Streamed
} from '#lib/spotter.js';

/** The width at which the verification pane sits beside the results instead of over them. */
export const WIDE_SCREEN = '(min-width: 1024px)';

type ExchangeBase = {
	/** What the user typed, exactly. Empty when they sent only a file. */
	added: string;
	/** The pages and files attached with this message. */
	attachments: Attachment[];
};

/** A message and the analysis it produced. */
export type AnalysisExchange = ExchangeBase & {
	kind: 'analysis';
	/** The analysis of the whole case up to and including this message. */
	result: SpotterResult;
	meta: AnalysisMeta | null;
	/** Verified links by reference key, filled in after the result when verification is on. */
	sources: Record<string, SourceMatch>;
	/** Whether this analysis's references are being checked against real pages. */
	verification: 'idle' | 'running' | 'done';
};

/** A file sent with no message: the app says what it understood and asks what to do next. */
export type ReadingExchange = ExchangeBase & { kind: 'reading' };

/** A deep research brief on a topic within the case. It adds nothing to the case text. */
export type ResearchExchange = ExchangeBase & {
	kind: 'research';
	topic: string;
	brief: ResearchBrief;
};

/**
 * Two cases to compare: first the ones the app found, for the user to confirm, then the comparison
 * once they have. It adds nothing to the case text.
 */
export type CompareExchange = ExchangeBase & {
	kind: 'compare';
	/** What the user typed to name the cases. */
	input: string;
	cases: CaseCandidate[];
	state: 'confirm' | 'comparing' | 'done';
	brief?: ResearchBrief;
};

/** Citations pasted to be checked, and the report on them. */
export type VerifyExchange = ExchangeBase & {
	kind: 'verify';
	input: string;
	brief: ResearchBrief;
};

export type Exchange = AnalysisExchange | ReadingExchange | ResearchExchange | CompareExchange | VerifyExchange;

/** What the app offers to do after reading a file the user sent on its own. */
export type NextAction = {
	id: 'issues' | 'counter-arguments' | 'draft';
	label: string;
	/** The message sent for the user when they pick it. */
	message: string;
};

export const NEXT_ACTIONS: NextAction[] = [
	{ id: 'issues', label: 'Spot the legal issues', message: 'Spot the legal issues in the attached file.' },
	{ id: 'counter-arguments', label: 'Find the counter-arguments', message: 'Find the counter-arguments to what the attached file says.' },
	{ id: 'draft', label: 'Draft a petition or complaint', message: 'Draft the appropriate petition or complaint from the attached file.' }
];

function emptyStreamed(): Streamed {
	return {
		draft: [],
		draftNotes: [],
		update: [],
		openQuestions: [],
		summary: [],
		counterArguments: [],
		issues: [],
		doctrines: [],
		precedents: [],
		acts: []
	};
}

/** "an invoice", "a recipe", "an image": the right article for what the file turned out to be. */
function withArticle(kind: string): string {
	return /^[aeiou]/i.test(kind) ? `an ${kind}` : `a ${kind}`;
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
	/** The file being read, by name: extracting and understanding it takes a moment. */
	fileStatus = $state<string | null>(null);
	fileError = $state('');
	/** Said when a file is not legal material at all; the file is not attached. */
	fileNotice = $state('');
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
	/** Whether the next message is a topic to research in depth instead of facts to analyse. */
	researchMode = $state(false);
	/** Deep research runs in progress, which is a different job from analysing. */
	researching = $state(false);
	researchStage = $state<'checking' | 'searching' | 'reading' | 'writing' | null>(null);
	/** Whether the next message names two cases to compare. */
	compareMode = $state(false);
	/** Finding the two cases, which comes before the user confirms them. */
	identifying = $state(false);
	/** The comparison itself is running. */
	comparing = $state(false);
	compareStage = $state<'opening' | 'treatment' | 'reading' | 'writing' | null>(null);
	/** Whether the next message is citations to check. */
	verifyMode = $state(false);
	verifying = $state(false);
	verifyStage = $state<'reading' | 'finding' | 'opening' | 'checking' | null>(null);
	/** Remaining citation checks this month. */
	verifyQuota = $state<QuotaInfo | null>(null);
	/** Remaining comparisons this month. */
	compareQuota = $state<QuotaInfo | null>(null);
	/** Remaining deep research this month; the value loaded with the page until a run updates it. */
	researchQuota = $state<QuotaInfo | null>(null);

	/** The most recent analysis, which the verification pane describes. */
	latest = $derived(this.#analysisAt(this.thread.length - 1));
	/** Whether the next message adds to an analysis already on screen instead of starting one. */
	followUp = $derived(this.latest !== null);
	/** The messages the user typed, for the case text. A file sent alone has none. */
	turns = $derived(this.thread.map((exchange) => exchange.added).filter((added) => added.trim()));
	/** Every page attached so far, in the order they were added. */
	attachments = $derived([...this.thread.flatMap((exchange) => exchange.attachments), ...this.draftAttachments]);

	/** The whole case, which is what the limit applies to, not just the draft. */
	charCount = $derived(caseText(this.turns, this.facts).length);
	overLimit = $derived(this.charCount > MAX_FACTS);
	showContextTip = $derived(
		this.facts.trim().length >= 40 && !looksLegal(caseText(this.turns, this.facts))
	);

	/** The latest analysis at or before a place in the thread, skipping files that were only read. */
	#analysisAt(index: number): AnalysisExchange | null {
		for (let at = Math.min(index, this.thread.length - 1); at >= 0; at--) {
			const exchange = this.thread[at];
			if (exchange.kind === 'analysis') return exchange;
		}
		return null;
	}

	/** The analysis before the one at this place, which an update is compared against. */
	previousAnalysis(index: number): AnalysisExchange | null {
		return this.#analysisAt(index - 1);
	}

	/** The messages typed up to and including this place, for exporting that analysis. */
	turnsThrough(index: number): string[] {
		return this.thread
			.slice(0, index + 1)
			.map((exchange) => exchange.added)
			.filter((added) => added.trim());
	}

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
			if (response.ok) {
				const payload = await response.json();
				this.liveQuota = payload.quota;
				this.researchQuota = payload.research ?? null;
				this.compareQuota = payload.compare ?? null;
				this.verifyQuota = payload.verify ?? null;
			}
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
		this.researchMode = false;
		this.compareMode = false;
		this.verifyMode = false;
		this.verifying = false;
		this.verifyStage = null;
		this.researching = false;
		this.identifying = false;
		this.comparing = false;
		this.compareStage = null;
		this.researchStage = null;
		this.draftAttachments = [];
		this.urlError = '';
		this.fileError = '';
		this.fileNotice = '';
	}

	toggleSkill(skill: ActiveSkill) {
		this.skills = toggleSkills(this.skills, skill);
	}

	/** Deep research needs a case to dig into, so it can only be switched on once there is one. */
	toggleResearch() {
		if (!this.researchMode && !this.followUp) return;
		this.researchMode = !this.researchMode;
		if (this.researchMode) {
			this.compareMode = false;
			this.verifyMode = false;
		}
		this.errorMessage = '';
		this.notice = '';
	}

	/** Comparing two cases needs no case of its own: the user names the two. */
	toggleCompare() {
		this.compareMode = !this.compareMode;
		if (this.compareMode) {
			this.researchMode = false;
			this.verifyMode = false;
		}
		this.errorMessage = '';
		this.notice = '';
	}

	/** Checking citations needs no case: the user pastes them. */
	toggleVerify() {
		this.verifyMode = !this.verifyMode;
		if (this.verifyMode) {
			this.researchMode = false;
			this.compareMode = false;
		}
		this.errorMessage = '';
		this.notice = '';
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
			if (this.attachments.some((existing) => existing.id === page.id)) {
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

	/**
	 * Reads an uploaded file: checks its type, pulls the text out in the browser, and asks the server
	 * what it is. A legal document is attached; anything else is turned away with a message.
	 * Returns whether it was attached.
	 */
	async addFile(file: File): Promise<boolean> {
		this.fileError = '';
		this.fileNotice = '';
		if (this.attachments.length >= MAX_ATTACHMENTS) {
			this.fileError = `You can attach up to ${MAX_ATTACHMENTS} items to a case.`;
			return false;
		}

		this.fileStatus = file.name;
		try {
			// The PDF and Word readers are large, so they load only when a file is added.
			const { extractFile, ExtractError } = await import('#lib/extract.js');
			let extracted;
			try {
				extracted = await extractFile(file);
			} catch (error) {
				if (!(error instanceof ExtractError)) console.error('Reading a file failed:', error);
				this.fileError = error instanceof ExtractError ? error.message : 'That file could not be read.';
				return false;
			}

			const response = await fetch('/api/file', {
				method: 'POST',
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify(extracted)
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok) {
				this.fileError = payload?.error ?? 'That file could not be read right now.';
				if (payload?.code === 'auth_invalid') await auth.signOut();
				return false;
			}
			if (payload.legal === false) {
				this.fileNotice = `That looks like ${withArticle(payload.documentKind)}: ${payload.description} It doesn't look like legal material, so I haven't attached it. Legal Spotter works on case facts, notices, pleadings, judgments and similar documents. Upload something related to your matter, or describe the facts in your own words.`;
				return false;
			}

			const attachment: Attachment = payload.attachment;
			if (this.attachments.some((existing) => existing.id === attachment.id)) {
				this.fileError = 'That file is already attached.';
				return false;
			}
			const total = this.attachments.reduce((sum, existing) => sum + existing.text.length, 0);
			if (total + attachment.text.length > MAX_CONTEXT_CHARS) {
				this.fileError = 'The attachments are already as long as one case can hold. Remove one first.';
				return false;
			}

			this.draftAttachments.push(attachment);
			return true;
		} catch {
			this.fileError = 'Network error. Please try again.';
			return false;
		} finally {
			this.fileStatus = null;
		}
	}

	/** Sends one of the suggested next steps after a file was read, as if the user had typed it. */
	async runNext(action: NextAction) {
		if (this.isLoading) return;
		// Spot-the-issues drops only Draft, which would otherwise write a document instead; the
		// others add to what is already switched on.
		const without = this.skills.filter((skill) => skill !== 'draft');
		this.skills =
			action.id === 'draft'
				? ['draft']
				: action.id === 'issues'
					? without
					: without.includes('counter-arguments')
						? without
						: [...without, 'counter-arguments'];
		this.facts = action.message;
		await this.submit();
	}

	/** Takes back a page or file attached to the message being written. */
	removeAttachment(id: string) {
		this.draftAttachments = this.draftAttachments.filter((attachment) => attachment.id !== id);
	}

	/**
	 * Takes the last message back into the composer to rewrite it. Its analysis goes with it; the
	 * earlier exchanges stay.
	 */
	editLast() {
		const last = this.thread.pop();
		if (!last) return;
		if (last.kind === 'research') {
			this.facts = last.topic;
			this.researchMode = true;
		} else if (last.kind === 'compare') {
			this.facts = last.input;
			this.compareMode = true;
		} else if (last.kind === 'verify') {
			this.facts = last.input;
			this.verifyMode = true;
		} else {
			this.facts = last.added;
		}
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
				if (latest?.kind === 'analysis') latest.verification = 'running';
			} else {
				this.stage = event.stage;
			}
		} else if ('sources' in event) {
			const latest = this.thread.at(-1);
			if (latest?.kind === 'analysis') {
				latest.sources = Object.fromEntries(event.sources.map((match) => [match.key, match]));
				latest.verification = 'done';
			}
		} else if ('item' in event) {
			if (event.item.section === 'acts') this.streamed.acts.push(event.item.value);
			else if (event.item.section === 'precedents') this.streamed.precedents.push(event.item.value);
			else if (event.item.section === 'counterArguments') {
				this.streamed.counterArguments.push(event.item.value);
			} else if (event.item.section === 'draft') this.streamed.draft.push(event.item.value);
			else this.streamed[event.item.section].push(event.item.value);
		} else if ('meta' in event) {
			this.#meta = event.meta;
		} else if ('sectionDone' in event) {
			if (!this.closed.includes(event.sectionDone)) this.closed.push(event.sectionDone);
		} else if ('result' in event) {
			this.thread.push({
				kind: 'analysis',
				added,
				attachments: this.draftAttachments,
				meta: this.#meta,
				sources: {},
				verification: 'idle',
				result: {
					...(typeof event.result?.documentType === 'string' && {
						documentType: event.result.documentType
					}),
					...(typeof event.result?.documentTitle === 'string' && {
						documentTitle: event.result.documentTitle
					}),
					...(Array.isArray(event.result?.draft) && { draft: event.result.draft }),
					...(Array.isArray(event.result?.draftNotes) && { draftNotes: event.result.draftNotes }),
					...(typeof event.result?.headline === 'string' && { headline: event.result.headline }),
					...(Array.isArray(event.result?.update) && { update: event.result.update }),
					...(Array.isArray(event.result?.openQuestions) && {
						openQuestions: event.result.openQuestions
					}),
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
		if (this.verifyMode) return this.#verify();
		if (this.compareMode) return this.#identify();
		if (this.researchMode) return this.#research();

		// With a conversation on screen, what is typed continues that case instead of starting a new one.
		const added = this.facts;
		const followUp = this.followUp;

		// A file sent on its own is not analysed: the app says what it understood and asks what next.
		if (!added.trim() && this.draftAttachments.some((attachment) => attachment.kind === 'file')) {
			this.thread.push({ kind: 'reading', added: '', attachments: this.draftAttachments });
			this.draftAttachments = [];
			return;
		}

		const text = caseText(this.turns, added);
		// With something attached, a few words such as "spot the issues" are enough to say what to do.
		const minimum = followUp || this.attachments.length > 0 ? MIN_FOLLOW_UP : MIN_FACTS;

		if (added.trim().length < minimum) {
			this.errorMessage = followUp
				? 'Add a few more words about what you want.'
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
					// With an analysis already on screen this is an update, so the earlier one goes along.
					...(this.latest && { previous: previousOf(this.latest.result) }),
					context: this.attachments.map(({ kind, url, fileName, title, text, truncated }) => ({
						kind,
						url,
						fileName,
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
				if (latest?.kind === 'analysis' && latest.verification === 'running') {
					latest.verification = 'done';
				}
			}
		}
	}
	/** Deep research on a topic within the case, using the case so far as its background. */
	async #research() {
		const topic = this.facts.trim();
		if (topic.length < 10) {
			this.errorMessage = 'Say what to research in a few more words.';
			return;
		}
		if (!this.latest) {
			this.errorMessage = 'Spot the issues in a case first, then research a point within it.';
			return;
		}

		this.isLoading = true;
		this.researching = true;
		this.researchStage = 'checking';
		this.pending = topic;
		this.#abort?.abort();
		const run = (this.#run += 1);
		this.#abort = new AbortController();
		let finished = false;

		try {
			const response = await fetch('/api/research', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify({ topic, facts: caseText(this.turns, '') })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				if (payload?.research) this.researchQuota = payload.research;
				if (payload?.code === 'auth_invalid') {
					this.errorMessage = payload.error;
					await auth.signOut();
				} else {
					this.errorMessage = payload?.error ?? 'Unable to start the research right now.';
				}
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split('\n');
				buffer = done ? '' : (lines.pop() ?? '');
				for (const line of lines) {
					if (!line.trim()) continue;
					if (run !== this.#run) return;
					const event: ResearchEvent = JSON.parse(line);
					if ('research' in event) this.researchQuota = event.research;
					else if ('stage' in event) this.researchStage = event.stage;
					else if ('brief' in event) {
						finished = true;
						this.thread.push({
							kind: 'research',
							added: '',
							attachments: [],
							topic,
							brief: event.brief
						});
						this.facts = '';
						this.researchMode = false;
					} else if ('offTopic' in event) {
						finished = true;
						this.notice = event.offTopic;
					} else if ('error' in event) {
						finished = true;
						this.errorMessage = event.error;
					}
				}
				if (done) break;
			}
			if (!finished) this.errorMessage = 'The research ended unexpectedly. Please try again.';
		} catch (error) {
			if (run !== this.#run) return;
			if ((error as Error)?.name === 'AbortError') {
				this.notice = 'Research stopped. Your topic is kept, and the run still counts toward this month.';
			} else {
				this.errorMessage = 'Network error. Please try again.';
			}
		} finally {
			if (run === this.#run) {
				this.#abort = null;
				this.isLoading = false;
				this.researching = false;
				this.researchStage = null;
				this.pending = null;
			}
		}
	}

	/** Finds the two cases the user named and shows them for confirmation. Nothing is compared yet. */
	async #identify() {
		const input = this.facts.trim();
		if (input.length < 8) {
			this.errorMessage = 'Name the two cases you want to compare.';
			return;
		}

		this.isLoading = true;
		this.identifying = true;
		this.pending = input;
		this.#abort?.abort();
		const run = (this.#run += 1);
		this.#abort = new AbortController();

		try {
			const response = await fetch('/api/compare/identify', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify({ input })
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok || !Array.isArray(payload?.cases)) {
				if (payload?.code === 'auth_invalid') {
					this.errorMessage = payload.error;
					await auth.signOut();
				} else {
					this.errorMessage = payload?.error ?? 'The cases could not be looked up right now.';
				}
				return;
			}
			if (run !== this.#run) return;
			this.thread.push({ kind: 'compare', added: '', attachments: [], input, cases: payload.cases, state: 'confirm' });
			this.facts = '';
			this.compareMode = false;
		} catch (error) {
			if (run !== this.#run) return;
			if ((error as Error)?.name !== 'AbortError') this.errorMessage = 'Network error. Please try again.';
			else this.notice = 'Stopped. Your text is kept.';
		} finally {
			if (run === this.#run) {
				this.#abort = null;
				this.isLoading = false;
				this.identifying = false;
				this.pending = null;
			}
		}
	}

	/** The user has confirmed the two cases: run the comparison and fill it into their message. */
	async confirmCompare(index: number) {
		const exchange = this.thread[index];
		if (this.isLoading || exchange?.kind !== 'compare' || exchange.state !== 'confirm') return;
		this.errorMessage = '';
		this.notice = '';

		this.isLoading = true;
		this.comparing = true;
		this.compareStage = 'opening';
		exchange.state = 'comparing';
		this.#abort?.abort();
		const run = (this.#run += 1);
		this.#abort = new AbortController();
		let finished = false;

		try {
			const response = await fetch('/api/compare', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify({ cases: exchange.cases.map(({ url, name }) => ({ url, name })) })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				if (payload?.compare) this.compareQuota = payload.compare;
				if (payload?.code === 'auth_invalid') {
					this.errorMessage = payload.error;
					await auth.signOut();
				} else {
					this.errorMessage = payload?.error ?? 'Unable to start the comparison right now.';
				}
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split('\n');
				buffer = done ? '' : (lines.pop() ?? '');
				for (const line of lines) {
					if (!line.trim()) continue;
					if (run !== this.#run) return;
					const event: CompareEvent = JSON.parse(line);
					if ('compare' in event) this.compareQuota = event.compare;
					else if ('stage' in event) this.compareStage = event.stage;
					else if ('brief' in event) {
						finished = true;
						exchange.brief = event.brief;
						exchange.state = 'done';
					} else if ('error' in event) {
						finished = true;
						this.errorMessage = event.error;
					}
				}
				if (done) break;
			}
			if (!finished) this.errorMessage = 'The comparison ended unexpectedly. Please try again.';
		} catch (error) {
			if (run !== this.#run) return;
			if ((error as Error)?.name === 'AbortError') {
				this.notice = 'Comparison stopped. It still counts toward this month.';
			} else {
				this.errorMessage = 'Network error. Please try again.';
			}
		} finally {
			if (run === this.#run) {
				this.#abort = null;
				this.isLoading = false;
				this.comparing = false;
				this.compareStage = null;
				// A comparison that did not finish goes back to being confirmed, so it can be tried again.
				if (exchange.state === 'comparing') exchange.state = 'confirm';
			}
		}
	}

	/** Checks the pasted citations and adds the report to the thread. */
	async #verify() {
		const input = this.facts.trim();
		if (input.length < 20) {
			this.errorMessage = 'Paste the citations you want checked, with the point each is cited for if you can.';
			return;
		}

		this.isLoading = true;
		this.verifying = true;
		this.verifyStage = 'reading';
		this.pending = input;
		this.#abort?.abort();
		const run = (this.#run += 1);
		this.#abort = new AbortController();
		let finished = false;

		try {
			const response = await fetch('/api/verify', {
				method: 'POST',
				signal: this.#abort.signal,
				headers: { 'content-type': 'application/json', ...(await auth.headers()) },
				body: JSON.stringify({ input })
			});

			if (!response.ok || !response.body) {
				const payload = await response.json().catch(() => null);
				if (payload?.verify) this.verifyQuota = payload.verify;
				if (payload?.code === 'auth_invalid') {
					this.errorMessage = payload.error;
					await auth.signOut();
				} else {
					this.errorMessage = payload?.error ?? 'Unable to start the check right now.';
				}
				return;
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { done, value } = await reader.read();
				buffer += decoder.decode(value, { stream: !done });
				const lines = buffer.split('\n');
				buffer = done ? '' : (lines.pop() ?? '');
				for (const line of lines) {
					if (!line.trim()) continue;
					if (run !== this.#run) return;
					const event: VerifyEvent = JSON.parse(line);
					if ('verify' in event) this.verifyQuota = event.verify;
					else if ('stage' in event) this.verifyStage = event.stage;
					else if ('brief' in event) {
						finished = true;
						this.thread.push({ kind: 'verify', added: '', attachments: [], input, brief: event.brief });
						this.facts = '';
						this.verifyMode = false;
					} else if ('error' in event) {
						finished = true;
						this.errorMessage = event.error;
					}
				}
				if (done) break;
			}
			if (!finished) this.errorMessage = 'The check ended unexpectedly. Please try again.';
		} catch (error) {
			if (run !== this.#run) return;
			if ((error as Error)?.name === 'AbortError') {
				this.notice = 'Check stopped. Your text is kept, and the check still counts toward this month.';
			} else {
				this.errorMessage = 'Network error. Please try again.';
			}
		} finally {
			if (run === this.#run) {
				this.#abort = null;
				this.isLoading = false;
				this.verifying = false;
				this.verifyStage = null;
				this.pending = null;
			}
		}
	}
}

export const workspace = new Workspace();
