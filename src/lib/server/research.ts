import type { ResearchBlock, ResearchBrief, ResearchSentence, ResearchSource } from '../spotter.ts';
import { hostOf, isAllowedHost } from './verify.ts';

/**
 * The sites a research brief may cite: primary sources only. The explicit High Court addresses are a
 * starting set; a court missing from it simply yields no citations, never a wrong one.
 */
export const RESEARCH_DOMAINS = [
	'sci.gov.in',
	'main.sci.gov.in',
	'digiscr.sci.in',
	'indiacode.nic.in',
	'indiacode.gov.in',
	'egazette.gov.in',
	'legislative.gov.in',
	'lawmin.gov.in',
	'ecourts.gov.in',
	'delhihighcourt.nic.in',
	'bombayhighcourt.nic.in',
	'mhc.tn.gov.in',
	'hcmadras.tn.nic.in',
	'calcuttahighcourt.gov.in',
	'allahabadhighcourt.in',
	'gujarathighcourt.nic.in',
	'highcourtchd.gov.in',
	'patnahighcourt.gov.in',
	'orissahighcourt.nic.in',
	'mphc.gov.in',
	'karnatakajudiciary.kar.nic.in',
	'indiankanoon.org'
];

/** A copy of a judgment on Indian Kanoon is a real page but not the court's own. */
export const isOfficialHost = (host: string) => !isAllowedHost(host, ['indiankanoon.org']);

export type Annotation = { type?: string; start_index?: number; end_index?: number; url?: string; title?: string };
export type TextPart = { text: string; annotations: Annotation[] };

const ABBREVIATIONS = new Set([
	'v', 'vs', 'no', 'nos', 'art', 'arts', 'sec', 'secs', 's', 'ss', 'dr', 'mr', 'mrs', 'ms', 'shri', 'smt', 'ors',
	'anr', 'etc', 'viz', 'cf', 'ltd', 'co', 'pvt', 'inc', 'hon', 'ble', 'j', 'cj', 'jj', 'para', 'paras', 'ch', 'cl',
	'ed', 'p', 'pp', 'vol', 'rs', 'e.g', 'i.e', 'a.i.r', 'air', 'scc', 'scr', 'm.c', 'k.k', 'd.k'
]);

/** Splits a line into sentences without cutting after "v.", "No.", "Art." and the like. */
export function splitSentences(line: string): { text: string; start: number; end: number }[] {
	const sentences: { text: string; start: number; end: number }[] = [];
	let start = 0;
	const boundary = /[.!?]+["')\]]*(\s+)/g;

	for (let match = boundary.exec(line); match; match = boundary.exec(line)) {
		const end = match.index + match[0].length - match[1].length;
		const before = line.slice(start, match.index).match(/([A-Za-z.]+)$/)?.[1]?.toLowerCase() ?? '';
		const next = line.slice(match.index + match[0].length, match.index + match[0].length + 1);
		const abbreviation = ABBREVIATIONS.has(before.replace(/\.$/, '')) || /^[a-z]$/i.test(before);
		// A sentence ends before a capital letter, a digit or an opening bracket; anything else is mid-sentence.
		if (abbreviation || !/[A-Z0-9"'(\[]/.test(next)) continue;

		sentences.push({ text: line.slice(start, end), start, end });
		start = match.index + match[0].length;
	}

	if (start < line.length) sentences.push({ text: line.slice(start), start, end: line.length });
	return sentences.filter((sentence) => sentence.text.trim() !== '');
}

const clean = (text: string) =>
	text
		.replace(/\*\*|__|`/g, '')
		.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2')
		.replace(/\s*\(\s*[,;]?\s*\)/g, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([.,;:])/g, '$1')
		.trim();

/** A link without the tracking parameters the search tool adds, so one page is one source. */
export function cleanUrl(raw: string): string {
	try {
		const url = new URL(raw);
		for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
		return url.toString();
	} catch {
		return raw;
	}
}

const MONTHS: Record<string, string> = { jan: 'January', feb: 'February', mar: 'March', apr: 'April', may: 'May', jun: 'June', jul: 'July', aug: 'August', sep: 'September', oct: 'October', nov: 'November', dec: 'December' };

/**
 * A title for a source. The search tool sometimes gives a snippet of the page's text instead of a
 * title; then a Supreme Court file is named from its file name (which carries the date) and any
 * other page by its site.
 */
export function sourceTitle(title: string, url: string, host: string): string {
	const text = title.replace(/\s+/g, ' ').trim();
	if (/^[A-Z0-9]/.test(text) && text.length <= 110 && !/[,;:-]$/.test(text)) return text;

	const dated = url.match(/_(?:Judgement|Judgment)_(\d{1,2})-([A-Za-z]{3})-(\d{4})\.pdf/i);
	if (dated && isAllowedHost(host, ['sci.gov.in', 'sci.in'])) {
		return `Supreme Court judgment of ${Number(dated[1])} ${MONTHS[dated[2].toLowerCase()] ?? dated[2]} ${dated[3]} (PDF)`;
	}
	return host;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;
const GAPS_HEADING = /could not (confirm|find|verify)|not confirmed|gaps?|unable to confirm/i;

/**
 * Turns the model's answer into numbered, sentence-level citations. OpenAI marks each citation as a
 * span of the answer's text, usually a link written into the sentence; those spans are cut out and
 * become numbered markers. A sentence that makes a statement without one is flagged as uncited, and a
 * citation to a site outside `domains` is dropped, never trusted.
 */
export function buildBrief(
	topic: string,
	parts: TextPart[],
	searches: number,
	domains: string[] = RESEARCH_DOMAINS
): ResearchBrief {
	const sources: ResearchSource[] = [];
	const numberOf = new Map<string, number>();
	let cleanText = '';
	const marks: { pos: number; n: number }[] = [];

	for (const part of parts) {
		if (cleanText) cleanText += '\n\n';
		const spans = part.annotations
			.filter((a) => a.type === 'url_citation' && typeof a.start_index === 'number' && typeof a.end_index === 'number')
			.sort((a, b) => a.start_index! - b.start_index!);

		let cursor = 0;
		for (const span of spans) {
			const from = span.start_index!;
			const to = span.end_index!;
			if (from < cursor || to <= from || to > part.text.length) continue; // overlapping or out of range

			cleanText += part.text.slice(cursor, from);
			cursor = to;

			const host = typeof span.url === 'string' ? hostOf(span.url) : null;
			if (!span.url || !host || !isAllowedHost(host, domains)) continue;

			const url = cleanUrl(span.url);
			let n = numberOf.get(url);
			if (!n) {
				n = sources.length + 1;
				numberOf.set(url, n);
				sources.push({ n, url, title: sourceTitle(clean(span.title ?? ''), url, host), host, official: isOfficialHost(host) });
			}
			// Attach to the sentence before it, even when a space comes between them.
			marks.push({ pos: cleanText.trimEnd().length, n });
		}
		cleanText += part.text.slice(cursor);
	}

	const blocks: ResearchBlock[] = [];
	let exempt = false;
	let lineStart = 0;

	for (const rawLine of cleanText.split('\n')) {
		const offset = lineStart;
		lineStart += rawLine.length + 1;
		if (!rawLine.trim() || /^\s*[-–—_*=]{3,}\s*$/.test(rawLine)) continue;

		const heading = rawLine.match(/^\s*#{1,4}\s+(.*)$/);
		if (heading) {
			exempt = GAPS_HEADING.test(heading[1]);
			blocks.push({ kind: 'heading', text: clean(heading[1]) });
			continue;
		}

		const bullet = rawLine.match(/^(\s*(?:[-*•–—]|\d+[.)])\s+)/);
		const body = bullet ? rawLine.slice(bullet[1].length) : rawLine;
		const bodyStart = offset + (bullet ? bullet[1].length : 0);

		const sentences: ResearchSentence[] = splitSentences(body).map((sentence) => {
			const from = bodyStart + sentence.start;
			const to = bodyStart + sentence.end;
			const cites = [...new Set(marks.filter((m) => m.pos > from && m.pos <= to + 1).map((m) => m.n))].sort((a, b) => a - b);
			const text = clean(sentence.text);
			return { text, cites, uncited: cites.length === 0 && !exempt && !text.endsWith('?') && wordCount(text) >= 6 };
		}).filter((sentence) => sentence.text !== '');

		if (sentences.length > 0) blocks.push({ kind: 'paragraph', bullet: !!bullet, sentences });
	}

	return { topic, blocks, sources, searches };
}

/** The sentences a brief states without a source, for a count and for tests. */
export function uncitedCount(brief: ResearchBrief): number {
	return brief.blocks.reduce(
		(sum, block) => sum + (block.kind === 'paragraph' ? block.sentences.filter((s) => s.uncited).length : 0),
		0
	);
}

export const RELEVANCE_PROMPT =
	"Decide whether a research topic belongs to a user's case: it is the same matter, or a legal question that arises from it. " +
	'Answer with exactly one word: related or unrelated. A topic about a different matter, or one with nothing to do with the case, is unrelated.';

export const RESEARCH_INSTRUCTIONS =
	'You are a legal research assistant for a law student working on one case. Write a research brief on the topic the user asks about, within the context of that case. ' +
	'Use web search to find the sources. Cite every statement of fact or law to a source you found, and cite the actual judgment, statute or gazette page. ' +
	'Prefer official sources: the Supreme Court, High Courts, India Code and the e-Gazette. Use an Indian Kanoon document page only when the official page is not available. ' +
	'If you cannot find a source for something, do not state it. If you find no source on the topic, say so plainly. ' +
	'Never invent case names, citations, quotations, holdings or section numbers. Treat the case facts as the user\'s own account, not as a source. ' +
	'State a case\'s name, year and court exactly as the page gives them; if the page does not say, leave it out. ' +
	'Write plain text: short ## headings, short paragraphs, one claim per sentence, and "- " for lists; no bold, no --- dividers, no other markup. Do not open with a line about what you are about to do. ' +
	'Begin with a two or three sentence answer. Then give the sections you need. End with a section headed "What I could not confirm" listing anything you looked for and did not find.';

export function researchInput(caseFacts: string, topic: string): string {
	return `The user's case, as they describe it:\n${caseFacts}\n\nResearch topic:\n${topic}`;
}
