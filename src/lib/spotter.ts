export const MIN_FACTS = 20;
export const MAX_FACTS = 12000;

export type ActReference = {
	act: string;
	sections: string[];
	relevance: string;
};

export type Precedent = {
	name: string;
	/** Four digits. Model-stated, so it can be wrong. */
	year?: string;
};

/** The strongest point the other side could make on one issue. */
export type CounterArgument = { issue: string; argument: string };

export type SpotterResult = {
	/** On an update: one line naming what the new facts change. */
	headline?: string;
	/** On an update: how the new facts change the analysis, in plain words. */
	update?: string[];
	/** Present when the Summarize skill was on. */
	summary?: string[];
	issues: string[];
	doctrines: string[];
	precedents: Precedent[];
	acts: ActReference[];
	/** The jurisdiction the model applied, e.g. "India". */
	jurisdiction?: string;
	/** Present when the Counter-args skill was on. */
	counterArguments?: CounterArgument[];
	/** On an update: facts still unknown that would change the analysis if established. */
	openQuestions?: string[];
	/** When the Draft skill was on: the kind of document ("FIR", "Criminal complaint"), its title and body. */
	documentType?: string;
	documentTitle?: string;
	draft?: DraftBlock[];
	/** Things to check before using the draft. */
	draftNotes?: string[];
};

/** One part of a draft document: a heading and its paragraphs. Unknown facts are [BRACKETED]. */
export type DraftBlock = { heading: string; text: string };

/**
 * The earlier analysis of the same case, sent with a follow-up so the model can say what changed and
 * the page can show it. Only the headings of each entry are needed.
 */
export type PreviousAnalysis = {
	issues: string[];
	doctrines: string[];
	precedents: string[];
	acts: string[];
};

export function previousOf(result: SpotterResult): PreviousAnalysis {
	return {
		issues: result.issues,
		doctrines: result.doctrines,
		precedents: result.precedents.map((precedent) => precedent.name),
		acts: result.acts.map((entry) => entry.act)
	};
}

/** Entries found so far while an analysis is still being written, by section. */
export type Streamed = {
	draft: DraftBlock[];
	draftNotes: string[];
	update: string[];
	openQuestions: string[];
	summary: string[];
	counterArguments: CounterArgument[];
	issues: string[];
	doctrines: string[];
	precedents: Precedent[];
	acts: ActReference[];
};

/** Ids that tie a reference in the result to its verified link. */
export const caseKey = (index: number) => `case:${index}`;
export const actKey = (index: number) => `act:${index}`;
export const sectionKey = (actIndex: number, sectionIndex: number) => `sec:${actIndex}:${sectionIndex}`;

/** Most sections of one act that are looked up, to keep a verification small. */
export const MAX_SECTIONS_PER_ACT = 3;

/** How many references a verification looks up: every case, every act, and its first few sections. */
export function lookupCount(result: SpotterResult): number {
	return (
		result.precedents.length +
		result.acts.length +
		result.acts.reduce((sum, entry) => sum + Math.min(entry.sections.length, MAX_SECTIONS_PER_ACT), 0)
	);
}

/** A reference confirmed against a real page: the page was returned by a web search on an allowed site and its title matches. */
export type SourceMatch = { key: string; url: string; title: string; host: string };

/** One sentence of a research brief, with the numbers of the sources that back it. */
/**
 * What reading the cited pages found for one sentence. `confirmed`: the page's text contains the
 * quoted passage and it supports the sentence. `read`: the model read a PDF and quoted a passage we
 * could not check ourselves. `partial` / `unsupported`: the page was read and does not fully back
 * the sentence. `unverified`: the model claimed support but its quote is not on the page.
 */
export type ResearchCheck = {
	status: 'confirmed' | 'read' | 'partial' | 'unsupported' | 'unverified';
	source: number;
	quote?: string;
	/** The quote is the page's own closest wording to what the writer gave, not the writer's words. */
	approx?: boolean;
};

export type ResearchSentence = {
	text: string;
	cites: number[];
	/** Absent when no cited page could be read. */
	check?: ResearchCheck;
	/** True when it states something but no source was found for it. */
	uncited: boolean;
};

export type ResearchBlock =
	| { kind: 'heading'; text: string }
	| { kind: 'paragraph'; bullet: boolean; sentences: ResearchSentence[] };

export type ResearchSource = {
	n: number;
	url: string;
	title: string;
	host: string;
	/** A court, a ministry or a statute site, as opposed to a copy of a judgment on Indian Kanoon. */
	official: boolean;
	/** How the page was read to check the brief: its text, a PDF read by the model, or not at all. */
	read?: 'text' | 'pdf';
	/** Only the first part of a long judgment was read. */
	truncated?: boolean;
};

/** One statement in a report, with the page it rests on. */
export type ReportLine = {
	text: string;
	cites: number[];
	/**
	 * `inference`: the writer's reasoning about the user's own facts, which no page can confirm.
	 * `app`: a result the app worked out itself from a page, such as whether a name matches.
	 */
	basis: 'source' | 'inference' | 'app';
	/** How a checked item came out, for an icon: fine, worth a look, or not found. */
	mark?: 'ok' | 'warn' | 'fail';
	check?: ResearchCheck;
};

export type ReportSection = {
	/** Which slot of the template this fills. */
	id: string;
	heading: string;
	/** Lines shown as a numbered list. */
	numbered: boolean;
	lines: ReportLine[];
	/** Sub-headings (H3), such as one per case. */
	children?: { heading: string; lines: ReportLine[] }[];
	/** Plain notes with no source, such as what could not be confirmed. */
	notes?: string[];
};

/**
 * The standard shape of every Deep research answer (and, later, Compare cases and Verify cites): a
 * title, then the sections of a fixed template in a fixed order. The model fills the slots and
 * cannot add or reorder them.
 */
export type Report = {
	kind: 'research' | 'compare' | 'verify';
	title: string;
	sections: ReportSection[];
	/** Statements dropped because the page did not contain the quote that was given for them. */
	dropped: number;
};

/** A research brief: what was found, in cited sentences, and the pages it came from. */
export type ResearchBrief = {
	topic: string;
	blocks: ResearchBlock[];
	sources: ResearchSource[];
	/** How many web searches the brief took. */
	searches: number;
	/** The checked report written from the pages themselves. Absent when that step failed. */
	report?: Report;
};

/** What produced the analysis, for the verification pane. */
export type AnalysisMeta = { model: string; ms: number };

/** What the app understood from an uploaded file, shown to the user right after it is read. */
export type Reading = {
	/** The kind of document, in a few words: "notice", "judgment", "FIR copy". */
	documentKind: string;
	/** What it says, as 3 to 5 plain-language points. */
	summary: string[];
};

/**
 * Background the user attached to a case: a page fetched by our server from an allowed legal site,
 * or a file they uploaded. Its text is sent with each analysis of the case.
 */
export type Attachment = {
	/** The address for a page, a unique id for a file. */
	id: string;
	kind: 'page' | 'file';
	title: string;
	text: string;
	/** True when the source was longer than the limit and only its start is used. */
	truncated: boolean;
	/** Pages only. */
	url?: string;
	host?: string;
	/** Files only. */
	fileName?: string;
	reading?: Reading;
};

export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_CHARS = 12000;
/** All attachments together, so a long conversation cannot grow without bound. */
export const MAX_CONTEXT_CHARS = 30000;

export type QuotaInfo = {
	signedIn: boolean;
	limit: number;
	remaining: number;
	/** Epoch milliseconds when the daily quota resets. */
	resetsAt: number;
};

export type SpotSection =
	| 'draft'
	| 'draftNotes'
	| 'update'
	| 'openQuestions'
	| 'summary'
	| 'issues'
	| 'doctrines'
	| 'precedents'
	| 'acts'
	| 'counterArguments';

/** One finished entry of a section, sent while the analysis is still being written. */
export type SpotItem =
	| {
			section: 'update' | 'openQuestions' | 'summary' | 'issues' | 'doctrines' | 'draftNotes';
			value: string;
	  }
	| { section: 'draft'; value: DraftBlock }
	| { section: 'precedents'; value: Precedent }
	| { section: 'acts'; value: ActReference }
	| { section: 'counterArguments'; value: CounterArgument };

/** One of the two cases to compare, as found and checked before the user confirms it. */
export type CaseCandidate = {
	/** The part of what the user typed that this case answers. */
	query: string;
	name: string;
	court: string;
	year: string;
	url: string;
	/** The title the page itself gives. */
	title: string;
	host: string;
	official: boolean;
	/** The page was opened and is about the case named. */
	verified: boolean;
	/** The app can read the page (an Indian Kanoon page or a statute site, not a PDF). */
	readable: boolean;
	/** Why it was not verified or readable, in words for the user. */
	problem?: string;
};

export type CompareEvent =
	| { compare: QuotaInfo }
	| { stage: 'opening' | 'treatment' | 'reading' | 'writing' }
	| { brief: ResearchBrief }
	| { error: string };

export type VerifyEvent =
	| { verify: QuotaInfo }
	| { stage: 'reading' | 'finding' | 'opening' | 'checking' }
	| { brief: ResearchBrief }
	| { error: string };

/** Newline-delimited JSON events streamed by POST /api/research. */
export type ResearchEvent =
	| { research: QuotaInfo }
	| { stage: 'checking' | 'searching' | 'reading' | 'writing' }
	| { brief: ResearchBrief }
	/** The topic is not part of the user's case; nothing was spent. */
	| { offTopic: string }
	| { error: string };

/** Newline-delimited JSON events streamed by POST /api/spot. */
export type SpotEvent =
	| { quota: QuotaInfo }
	| { stage: 'verifying' }
	| { stage: 'analyzing' }
	| { stage: 'sourcing' }
	| { item: SpotItem }
	| { sectionDone: SpotSection }
	| { meta: AnalysisMeta }
	| { sources: SourceMatch[] }
	| { result: SpotterResult }
	| { notLegal: true }
	| { error: string };

/**
 * Legal-context vocabulary. A trailing `$` means the whole word; otherwise the
 * term is a word prefix (so "negligen" matches negligent and negligence).
 */
const LEGAL_TERMS = [
	'contract', 'agreement', 'breach', 'negligen', 'liab', 'damages$', 'injur', 'compensat',
	'tenant', 'landlord', 'lease', 'rent$', 'rental', 'evict', 'deposit', 'employer', 'employee',
	'dismiss', 'terminat', 'wages$', 'salary', 'notice$', 'sue$', 'sued$', 'suit$', 'court',
	'judge$', 'plaintiff', 'defendant', 'accused$', 'victim', 'police', 'arrest', 'fir$', 'charged$',
	'offence', 'offense', 'crime', 'criminal', 'theft', 'stole', 'robb', 'assault', 'murder',
	'fraud', 'cheat', 'forge', 'defam', 'threat', 'trespass', 'property', 'possession', 'ownership',
	'inherit', 'heir$', 'heirs$', 'will$', 'estate$', 'divorce', 'custody', 'marriage', 'maintenance$',
	'consent', 'void$', 'illegal', 'unlawful', 'statute', 'section$', 'act$', 'duty$', 'claim',
	'seller', 'buyer', 'vendor', 'purchaser', 'warranty', 'defect', 'refund', 'loan$', 'mortgage',
	'default', 'cheque', 'bounced$', 'guarantee', 'partner', 'shareholder', 'tax$', 'licen',
	'insur', 'arbitrat', 'injunction', 'tort$', 'witness', 'evidence', 'bail$', 'sentenc', 'appeal',
	'petition', 'tribunal', 'consumer', 'patent', 'copyright', 'trademark', 'rights$', 'legal'
].map((term) => {
	const exact = term.endsWith('$');
	const word = exact ? term.slice(0, -1) : term;
	return new RegExp(`\\b${word}${exact ? '\\b' : ''}`, 'i');
});

/** Distinct legal terms found in the text. */
export function legalSignals(text: string): number {
	return LEGAL_TERMS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export const MIN_LEGAL_SIGNALS = 2;

/** Heuristic only: true means "clearly legal", false means "unsure", never "reject". */
export function looksLegal(text: string): boolean {
	return legalSignals(text) >= MIN_LEGAL_SIGNALS;
}
