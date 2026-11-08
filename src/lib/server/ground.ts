import type { ResearchBrief, ResearchCheck, ResearchSentence, ResearchSource } from '../spotter.ts';

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

export const GROUNDING_INSTRUCTIONS =
	'You check a research brief against the pages it cites. You are given the text of some sources (or a PDF), each labelled SOURCE [n], and a list of numbered claims, each with the sources it cites. ' +
	'For each claim, decide using ONLY the source material you were given, never your own knowledge, whether a cited source supports it. ' +
	'Answer "supported" only if the source says it. Answer "partly" if it says something close but narrower, broader or different. Answer "not_supported" if it does not say it or you cannot find it in the part you were given. ' +
	'For "supported" and "partly" give the source number and a quote copied exactly, character for character, from that source, of 8 to 40 words. If you need two separate passages, join them with "…". Never paraphrase inside a quote and never fix its spelling. ' +
	'Claims whose cited sources were not given to you: leave them out. ' +
	'Reply with JSON only: {"checks":[{"claim":1,"verdict":"supported","source":1,"quote":"..."}]}';

export function groundingText(claims: Claim[], texts: { n: number; host: string; text: string; truncated: boolean }[]): string {
	const sources = texts
		.map(
			(source) =>
				`SOURCE [${source.n}] (${source.host})${source.truncated ? ' (only the first part of a long document)' : ''}\n${source.text}`
		)
		.join('\n\n---\n\n');
	const list = claims.map((claim) => `${claim.id}. ${claim.text} (cites ${claim.cites.map((n) => `[${n}]`).join(' ')})`).join('\n');
	return `${sources}\n\n=== CLAIMS ===\n${list}`;
}

export type Verdict = { claim: number; verdict: 'supported' | 'partly' | 'not_supported'; source?: number; quote?: string };

/** Reads the model's reply, ignoring anything malformed. */
export function parseVerdicts(reply: string): Verdict[] {
	const start = reply.indexOf('{');
	const end = reply.lastIndexOf('}');
	if (start < 0 || end <= start) return [];
	let parsed: any;
	try {
		parsed = JSON.parse(reply.slice(start, end + 1));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed?.checks)) return [];

	const verdicts: Verdict[] = [];
	for (const item of parsed.checks) {
		const verdict = item?.verdict === 'partly' || item?.verdict === 'not_supported' || item?.verdict === 'supported' ? item.verdict : null;
		if (!Number.isInteger(item?.claim) || !verdict) continue;
		verdicts.push({
			claim: item.claim,
			verdict,
			...(Number.isInteger(item.source) && { source: item.source }),
			...(typeof item.quote === 'string' && item.quote.trim() && { quote: item.quote.trim().slice(0, 600) })
		});
	}
	return verdicts;
}

/**
 * Puts the outcome on each claim's sentence. A quote is trusted only when it is found on a page we
 * hold the text of; for a PDF only the model has read it, which the label says. A claim the model
 * called supported with a quote that is not on the page is marked unverified, not confirmed.
 */
export function applyChecks(
	brief: ResearchBrief,
	verdicts: Verdict[],
	pages: Map<number, string>,
	pdfs: Set<number>
): ResearchBrief {
	const claims = claimsOf(brief);
	const byClaim = new Map(verdicts.map((verdict) => [verdict.claim, verdict]));
	const checked = new Map<string, ResearchCheck>();

	for (const claim of claims) {
		const verdict = byClaim.get(claim.id);
		if (!verdict) continue;
		const source = verdict.source && claim.cites.includes(verdict.source) ? verdict.source : claim.cites[0];

		let check: ResearchCheck;
		if (verdict.verdict === 'not_supported') {
			check = { status: 'unsupported', source };
		} else if (!verdict.quote) {
			check = { status: 'unverified', source };
		} else if (pages.has(source)) {
			check = quoteSupported(verdict.quote, pages.get(source)!)
				? { status: verdict.verdict === 'supported' ? 'confirmed' : 'partial', source, quote: verdict.quote }
				: { status: 'unverified', source };
		} else if (pdfs.has(source)) {
			check = { status: verdict.verdict === 'supported' ? 'read' : 'partial', source, quote: verdict.quote };
		} else {
			continue;
		}
		checked.set(`${claim.id}`, check);
	}

	let id = 0;
	return {
		...brief,
		blocks: brief.blocks.map((block) =>
			block.kind !== 'paragraph'
				? block
				: {
						...block,
						sentences: block.sentences.map((sentence: ResearchSentence) => {
							if (sentence.cites.length === 0) return sentence;
							const check = checked.get(`${++id}`);
							return check ? { ...sentence, check } : sentence;
						})
					}
		)
	};
}

/** How many cited sentences were checked, and how many of those held up. */
export function checkTally(brief: ResearchBrief): { checked: number; confirmed: number; cited: number } {
	let checked = 0;
	let confirmed = 0;
	let cited = 0;
	for (const block of brief.blocks) {
		if (block.kind !== 'paragraph') continue;
		for (const sentence of block.sentences) {
			if (sentence.cites.length === 0) continue;
			cited += 1;
			if (!sentence.check) continue;
			checked += 1;
			if (sentence.check.status === 'confirmed' || sentence.check.status === 'read') confirmed += 1;
		}
	}
	return { checked, confirmed, cited };
}
