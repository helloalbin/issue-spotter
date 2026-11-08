import type { ResearchBrief, ResearchSource } from '../spotter.ts';

import { matchKey } from '../match.ts';
export { matchKey };

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
export function pickSources(brief: ResearchBrief, limit: number, usable: (url: string) => boolean = () => true): ResearchSource[] {
	const claims = claimsOf(brief);
	const load = (n: number) => claims.filter((claim) => claim.cites.includes(n)).length;
	return [...brief.sources]
		.filter((source) => load(source.n) > 0 && usable(source.url))
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

const SNAP_MIN_WORDS = 6;
const SNAP_MIN_RATIO = 0.85;

type Token = { key: string; start: number; end: number };

/** The words of a text with their place in it, so a run of them can be cut out of the original. */
function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	for (const match of text.matchAll(/\S+/g)) {
		for (const key of matchKey(match[0]).split(' ')) {
			if (key) tokens.push({ key, start: match.index!, end: match.index! + match[0].length });
		}
	}
	return tokens;
}

/** Length of the longest in-order run of shared words, and where it starts and ends in `b`. */
function lcs(a: string[], b: string[]): { length: number; first: number; last: number } {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const table = Array.from({ length: rows }, () => new Uint16Array(cols));
	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			table[i][j] = a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
		}
	}
	let first = -1;
	let last = -1;
	for (let i = rows - 1, j = cols - 1; i > 0 && j > 0; ) {
		if (a[i - 1] === b[j - 1]) {
			if (last < 0) last = j - 1;
			first = j - 1;
			i--;
			j--;
		} else if (table[i - 1][j] >= table[i][j - 1]) i--;
		else j--;
	}
	return { length: table[rows - 1][cols - 1], first, last };
}

function snapPart(part: string, tokens: Token[], index: Map<string, number[]>, text: string): string | null {
	const words = matchKey(part).split(' ').filter(Boolean);
	if (words.length < SNAP_MIN_WORDS) return null;

	// Where do the quote's three-word runs fall in the text? The offset most of them agree on is the passage.
	const votes = new Map<number, number>();
	for (let i = 0; i + 3 <= words.length; i++) {
		for (const at of index.get(words.slice(i, i + 3).join(' ')) ?? []) votes.set(at - i, (votes.get(at - i) ?? 0) + 1);
	}
	let best = -1;
	let bestVotes = 0;
	for (const [offset, count] of votes) if (count > bestVotes) [best, bestVotes] = [offset, count];
	if (bestVotes < 2) return null;

	const from = Math.max(0, best - 3);
	const to = Math.min(tokens.length, best + words.length + 8);
	const window = tokens.slice(from, to).map((token) => token.key);
	const match = lcs(words, window);
	if (match.length / words.length < SNAP_MIN_RATIO || match.first < 0) return null;

	return text.slice(tokens[from + match.first].start, tokens[from + match.last].end).replace(/\s+/g, ' ');
}

/**
 * The passage of `text` a quote most closely matches, as the text itself says it, or null when
 * nothing matches closely enough. A model often "improves" a quote by a word or two; this finds the
 * real wording so the report can show that instead. Parts joined by an ellipsis are matched
 * separately and must each match.
 */
export function closestPassage(quote: string, text: string): string | null {
	const parts = quote
		.split(/\s*(?:\[\s*(?:\.{3}|…)\s*\]|\.{3}|…)\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length === 0) return null;

	const tokens = tokenize(text);
	const index = new Map<string, number[]>();
	for (let i = 0; i + 3 <= tokens.length; i++) {
		const gram = `${tokens[i].key} ${tokens[i + 1].key} ${tokens[i + 2].key}`;
		const list = index.get(gram);
		if (list) list.push(i);
		else index.set(gram, [i]);
	}

	const found: string[] = [];
	for (const part of parts) {
		const passage = snapPart(part, tokens, index, text);
		if (!passage) return null;
		found.push(passage);
	}
	return found.join(' … ');
}

/**
 * A quote a model gave, made safe to show: exact if it is on the page, else the page's own closest
 * wording (marked approximate), else null. `excerpt` is what the model saw of the page.
 */
export function confirmQuote(quote: string, page: string, excerpt?: string): { quote: string; approx: boolean } | null {
	if (quoteSupported(quote, page)) return { quote, approx: false };
	const snapped = excerpt ? closestPassage(quote, excerpt) : null;
	return snapped ? { quote: snapped, approx: true } : null;
}
