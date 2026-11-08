import type { ResearchBrief, ResearchSource } from '../spotter.ts';

/** Text reduced to lowercase letters and digits, so line breaks, quotes and punctuation do not matter. */
export const matchKey = (text: string) =>
	text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, ' ')
		.trim();

const MIN_FRAGMENT_WORDS = 4;
const MIN_QUOTE_WORDS = 6;

/**
 * Whether a quote the model gave really is on the page. The model may join separate passages with
 * an ellipsis; each part must appear on the page, in the order given. A quote too short to mean
 * anything, or one that is only filler around an ellipsis, does not count.
 */
export function quoteSupported(quote: string, pageText: string): boolean {
	const parts = quote
		.split(/\s*(?:\[\s*(?:\.{3}|…)\s*\]|\.{3}|…)\s*/)
		.map(matchKey)
		.filter(Boolean);
	if (parts.length === 0) return false;
	if (parts.reduce((sum, part) => sum + part.split(' ').length, 0) < MIN_QUOTE_WORDS) return false;

	const page = ` ${matchKey(pageText)} `;
	let from = 0;
	for (const part of parts) {
		if (part.split(' ').length < MIN_FRAGMENT_WORDS && parts.length > 1) return false;
		const at = page.indexOf(` ${part} `, from);
		if (at < 0) return false;
		from = at + part.length;
	}
	return true;
}

export type Claim = { id: number; text: string; cites: number[] };

/** The sentences that cite something, numbered so the model can answer about each. */
export function claimsOf(brief: ResearchBrief): Claim[] {
	const claims: Claim[] = [];
	for (const block of brief.blocks) {
		if (block.kind !== 'paragraph') continue;
		for (const sentence of block.sentences) {
			if (sentence.cites.length > 0) claims.push({ id: claims.length + 1, text: sentence.text, cites: sentence.cites });
		}
	}
	return claims;
}

/**
 * The sources worth reading: the ones that carry the most claims, official pages before copies,
 * up to a limit. Reading is what costs, so the busiest pages come first.
 */
export function pickSources(brief: ResearchBrief, limit: number): ResearchSource[] {
	const claims = claimsOf(brief);
	const load = (n: number) => claims.filter((claim) => claim.cites.includes(n)).length;
	return [...brief.sources]
		.filter((source) => load(source.n) > 0)
		.sort((a, b) => Number(b.official) - Number(a.official) || load(b.n) - load(a.n) || a.n - b.n)
		.slice(0, Math.max(0, limit));
}

export const isPdfUrl = (url: string) => {
	try {
		return new URL(url).pathname.toLowerCase().endsWith('.pdf');
	} catch {
		return false;
	}
};
