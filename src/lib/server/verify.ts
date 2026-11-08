/**
 * Matching a reference the model cited to a page that a web search really returned. The model's
 * own claim about which page is which is never used: a link is accepted only if it came back as a
 * citation, is on an allowed site, and its page title matches the reference by name.
 */

/** Sites a reference may be verified on. Indian law only; other jurisdictions are not verified. */
export const SOURCE_DOMAINS = [
	'indiankanoon.org',
	'indiacode.nic.in',
	'indiacode.gov.in',
	'sci.gov.in',
	'digiscr.sci.in'
];

export type Reference = {
	/** Stable id the result uses to find its verified link. */
	key: string;
	kind: 'case' | 'statute' | 'section';
	/** The text to match: a case name, an act name, or "Section 73 The Indian Contract Act, 1872". */
	name: string;
	year?: string;
};

export type Citation = { url: string; title: string };

export type Match = { key: string; url: string; title: string; host: string };

/** Words that appear in most case names and say nothing about which case it is. */
const NOISE = new Set([
	'v', 'vs', 'versus', 'the', 'of', 'and', 'state', 'union', 'india', 'ors', 'anr', 'others',
	'another', 'ltd', 'limited', 'co', 'pvt', 'private', 'm', 's', 'mrs', 'mr', 'shri', 'smt', 'dr',
	'through', 'its', 'secretary', 'govt', 'government', 'on', 'in', 'by', 'for', 'a', 'an'
]);

export function tokens(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.split(' ')
		.filter(Boolean);
}

const SECTION_PREFIX = /^\s*(?:sections?|sec\.?|s\.)\s*(\d+)[a-z]?(?:\([^)]*\))*/i;

/**
 * A provision is looked up by its section number and its act. A sub-clause such as "(1)(d)" is
 * dropped, because the page for the section covers it and its title never names it.
 */
function wordsOf(reference: Reference): string[] {
	if (reference.kind !== 'section') return tokens(reference.name);

	const match = reference.name.match(SECTION_PREFIX);
	if (!match) return tokens(reference.name);
	return ['section', match[1], ...tokens(reference.name.slice(match[0].length))];
}

/** The share of the reference's distinguishing words that appear in the page title. */
export function score(reference: Reference, title: string): number {
	const all = wordsOf(reference);
	// A case is told apart by its party names; an act or section needs every word, numbers included.
	const wanted = reference.kind === 'case' ? all.filter((word) => !NOISE.has(word)) : all;
	const needed = wanted.length > 0 ? wanted : all;
	if (needed.length === 0) return 0;

	const have = new Set(tokens(title));
	return needed.filter((word) => have.has(word)).length / needed.length;
}

export function hostOf(url: string): string | null {
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

export function isAllowedHost(host: string | null, domains: string[] = SOURCE_DOMAINS): boolean {
	return !!host && domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

const MIN_SCORE = 0.8;

/**
 * Numbers must agree exactly: "Section 74" is not "Section 73" and "1882" is not "1872", however
 * many other words the titles share. For a provision, the page must be that section: the word
 * "section" followed directly by its number (a page for "Section 2" covers "Section 2(1)(d)").
 */
function numbersAgree(reference: Reference, title: string): boolean {
	if (reference.kind === 'case') return true;

	const have = tokens(title);
	const numbers = wordsOf(reference).filter((word) => /^\d+$/.test(word));
	if (!numbers.every((number) => have.includes(number))) return false;

	if (reference.kind === 'section') {
		const wanted = reference.name.match(SECTION_PREFIX)?.[1];
		if (!wanted) return false;
		return have.some((word, index) => word === 'section' && have[index + 1] === wanted);
	}

	return true;
}

/** A year in the page title that is far from the one the model gave points to a different case. */
function yearConflicts(reference: Reference, title: string): boolean {
	if (reference.kind !== 'case' || !reference.year) return false;
	const years = (title.match(/\b(?:18|19|20)\d{2}\b/g) ?? []).map(Number);
	if (years.length === 0) return false;
	return !years.some((year) => Math.abs(year - Number(reference.year)) <= 2);
}

export function matchSources(
	references: Reference[],
	citations: Citation[],
	domains: string[] = SOURCE_DOMAINS
): Match[] {
	const usable = citations
		.map((citation) => ({ ...citation, host: hostOf(citation.url) }))
		.filter((citation) => citation.title && isAllowedHost(citation.host, domains));

	const matches: Match[] = [];

	for (const reference of references) {
		let best: { citation: (typeof usable)[number]; score: number } | null = null;

		for (const citation of usable) {
			if (yearConflicts(reference, citation.title)) continue;
			if (!numbersAgree(reference, citation.title)) continue;
			const value = score(reference, citation.title);
			if (value < MIN_SCORE) continue;

			const better =
				!best ||
				value > best.score ||
				(value === best.score && citation.url.includes('/doc/') && !best.citation.url.includes('/doc/'));
			if (better) best = { citation, score: value };
		}

		if (best) {
			matches.push({
				key: reference.key,
				url: best.citation.url,
				title: best.citation.title,
				host: best.citation.host as string
			});
		}
	}

	return matches;
}
