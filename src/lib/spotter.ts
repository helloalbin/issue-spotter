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
};

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

/** What produced the analysis, for the verification pane. */
export type AnalysisMeta = { model: string; ms: number };

/**
 * A page the user attached as background, fetched by our server from an allowed legal site. Its text
 * is sent with each analysis of the case.
 */
export type Attachment = {
	url: string;
	title: string;
	host: string;
	text: string;
	/** True when the page was longer than the limit and only its start is used. */
	truncated: boolean;
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
	| { section: 'update' | 'openQuestions' | 'summary' | 'issues' | 'doctrines'; value: string }
	| { section: 'precedents'; value: Precedent }
	| { section: 'acts'; value: ActReference }
	| { section: 'counterArguments'; value: CounterArgument };

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
