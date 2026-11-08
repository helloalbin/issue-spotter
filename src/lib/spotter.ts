export const MIN_FACTS = 20;
export const MAX_FACTS = 12000;

export type ActReference = {
	act: string;
	sections: string[];
	relevance: string;
};

export type SpotterResult = {
	issues: string[];
	doctrines: string[];
	precedents: string[];
	acts: ActReference[];
};

export type QuotaInfo = {
	signedIn: boolean;
	limit: number;
	remaining: number;
	/** Epoch milliseconds when the daily quota resets. */
	resetsAt: number;
};

export type SpotSection = 'issues' | 'doctrines' | 'precedents' | 'acts';

/** One finished entry of a section, sent while the analysis is still being written. */
export type SpotItem =
	| { section: 'issues' | 'doctrines' | 'precedents'; value: string }
	| { section: 'acts'; value: ActReference };

/** Newline-delimited JSON events streamed by POST /api/spot. */
export type SpotEvent =
	| { quota: QuotaInfo }
	| { stage: 'verifying' }
	| { stage: 'analyzing' }
	| { item: SpotItem }
	| { sectionDone: SpotSection }
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
