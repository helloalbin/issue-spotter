/**
 * Fits a long judgment into a character budget by choosing its paragraphs instead of cutting it at
 * the end. The opening (bench, parties, facts) and the closing (the order) are always kept, and the
 * paragraphs that share the most distinctive words with the question fill the rest. Paragraphs are
 * copied exactly and kept in their original order, with a marker where some are left out, so a
 * quote taken from the excerpt is still a quote from the judgment.
 */

const STOP = new Set(
	('the and for that this with was were are not but from which have has had been their there such any all may shall ' +
		'also into than then them they its his her our out who whom whose upon under over between against being does did ' +
		'can could would should will whether where when what each other these those only more most some one two said ' +
		'case court section act appellant respondent petitioner learned counsel').split(' ')
);

/**
 * The words of a text for scoring: letters and digits of the Latin alphabet, which is what Indian
 * judgments are written in. A cheap pattern matters here because this runs over every paragraph of a
 * judgment that can be a million characters long.
 */
export const words = (text: string): string[] =>
	(text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !STOP.has(word));

/** The paragraphs of a page's text: one per line, with a stray short line joined to the one before. */
export function splitParagraphs(text: string): string[] {
	const paragraphs: string[] = [];
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) continue;
		const last = paragraphs.length - 1;
		if (trimmed.length < 40 && last >= 0 && !/^\d+[.)]/.test(trimmed)) paragraphs[last] += ' ' + trimmed;
		else paragraphs.push(trimmed);
	}
	return paragraphs;
}

export type Excerpt = {
	text: string;
	/** Whether anything was left out. */
	cut: boolean;
	/** How many paragraphs the judgment has and how many were kept. */
	paragraphs: number;
	kept: number;
};

/** The longest a "[… n paragraphs omitted …]" line is. */
const GAP_COST = 36;

type Options = { head?: number; tail?: number };

/**
 * `query` is what the research is about: the topic and the claims to check. Scoring is BM25 over
 * paragraphs, so a word that appears in few paragraphs counts for more than a common one.
 */
export function selectExcerpts(text: string, query: string, maxChars: number, options: Options = {}): Excerpt {
	const paragraphs = splitParagraphs(text);
	if (text.length <= maxChars) return { text, cut: false, paragraphs: paragraphs.length, kept: paragraphs.length };

	const headBudget = options.head ?? Math.floor(maxChars * 0.1);
	const tailBudget = options.tail ?? Math.floor(maxChars * 0.1);
	const keep = new Set<number>();
	let used = 0;
	const take = (at: number) => {
		if (keep.has(at)) return true;
		// Room for the marker that may stand before it, so the excerpt stays inside the budget.
		const cost = paragraphs[at].length + 1 + GAP_COST;
		if (used + cost > maxChars) return false;
		keep.add(at);
		used += cost;
		return true;
	};

	// The opening and the closing, within their own shares.
	let spent = 0;
	// The share is soft: the paragraph that crosses it is kept, so a long first paragraph is not lost.
	for (let at = 0; at < paragraphs.length && spent < headBudget; at++) {
		if (!take(at)) break;
		spent += paragraphs[at].length;
	}
	spent = 0;
	for (let at = paragraphs.length - 1; at >= 0 && spent < tailBudget; at--) {
		if (!take(at)) break;
		spent += paragraphs[at].length;
	}

	// The rest by relevance.
	const terms = [...new Set(words(query))];
	if (terms.length > 0) {
		const termSet = new Set(terms);
		const counts = paragraphs.map((paragraph) => {
			const tally = new Map<string, number>();
			const list = words(paragraph);
			for (const word of list) if (termSet.has(word)) tally.set(word, (tally.get(word) ?? 0) + 1);
			return { tally, length: list.length };
		});
		const df = new Map<string, number>();
		for (const { tally } of counts) for (const word of tally.keys()) df.set(word, (df.get(word) ?? 0) + 1);

		const n = paragraphs.length;
		const average = counts.reduce((sum, c) => sum + c.length, 0) / Math.max(1, n);
		const k1 = 1.4;
		const b = 0.75;
		const scored = counts
			.map(({ tally, length }, at) => {
				let score = 0;
				for (const [word, tf] of tally) {
					const idf = Math.log(1 + (n - df.get(word)! + 0.5) / (df.get(word)! + 0.5));
					score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * length) / Math.max(1, average)));
				}
				return { at, score };
			})
			.filter((entry) => entry.score > 0)
			.sort((a, b2) => b2.score - a.score);

		for (const { at } of scored) {
			if (used >= maxChars) break;
			take(at);
		}
	}

	const order = [...keep].sort((a, b2) => a - b2);
	const parts: string[] = [];
	let previous = -1;
	for (const at of order) {
		if (at > previous + 1) {
			const left = at - previous - 1;
			parts.push(`[… ${left} ${left === 1 ? 'paragraph' : 'paragraphs'} omitted …]`);
		}
		parts.push(paragraphs[at]);
		previous = at;
	}
	if (previous < paragraphs.length - 1) {
		const left = paragraphs.length - 1 - previous;
		parts.push(`[… ${left} ${left === 1 ? 'paragraph' : 'paragraphs'} omitted …]`);
	}

	return { text: parts.join('\n'), cut: true, paragraphs: paragraphs.length, kept: order.length };
}
