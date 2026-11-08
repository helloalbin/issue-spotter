import { MAX_GROUP_LINES, MAX_LINE_WORDS, RESEARCH_TEMPLATE, clampWords } from '../report.ts';
import type { Report, ReportLine, ReportSection } from '../spotter.ts';
import { quoteSupported } from './ground.ts';

const claim = {
	type: 'object',
	additionalProperties: false,
	required: ['text', 'source', 'quote'],
	properties: {
		text: { type: 'string' },
		source: { type: 'integer' },
		quote: { type: 'string' }
	}
};
const claims = { type: 'array', items: claim };

/** What the writer must return. Every slot of the template is present, so none can be added or left out. */
export const REPORT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['title', 'synopsis', 'law', 'authorities', 'application', 'against', 'notConfirmed'],
	properties: {
		title: { type: 'string' },
		synopsis: claims,
		law: claims,
		authorities: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['name', 'claims'],
				properties: { name: { type: 'string' }, claims }
			}
		},
		application: claims,
		against: claims,
		notConfirmed: { type: 'array', items: { type: 'string' } }
	}
};

export const WRITER_INSTRUCTIONS =
	'You write a legal research report for a law student, in a fixed format, from source texts you are given. ' +
	'The sources are labelled SOURCE [n]. Use ONLY what those texts say; never your own knowledge, and never anything from the leads except to know what to look for. ' +
	'Fill every field of the format. Each statement is {text, source, quote}: text is one plain sentence of at most 40 words; source is the number n of the SOURCE it rests on; ' +
	'quote is copied exactly, character for character, from that SOURCE, 8 to 40 words, the passage that supports the sentence. If you need two passages, join them with "…". Never paraphrase inside a quote. ' +
	'A statement you cannot support with a quote from a source does not belong in the report: leave it out and, if it matters, name it in notConfirmed. ' +
	'Fields: title is the question restated in at most 15 words. synopsis is 3 to 5 numbered-point answers to the question, each a complete sentence. ' +
	'law is the statutes and provisions that govern it. authorities is the judgments, one entry per case with name as "Case v. Case (Court, year)" exactly as the source gives it, and up to 3 statements each: what it held and how later or earlier decisions treated it. ' +
	'application is how the law applies to the user\'s own facts: here, and only here, a statement may be your own reasoning about those facts, with source 0 and an empty quote. ' +
	'against is what qualifies, distinguishes, limits or goes against the answer, including any decision said to overrule or doubt another; keep passages that cut against the answer, not only ones that support it. ' +
	'notConfirmed is what you looked for in the sources and did not find, as short plain sentences. ' +
	'Plain text only: no markdown, no bullets, no numbering inside the statements. A statement about a case names the case.';

export type SourceText = { n: number; host: string; title: string; text: string; cut: boolean };

/** The writer's input: the case, the question, what the search found, then each source. */
export function writerInput(facts: string, topic: string, leads: string, sources: SourceText[]): string {
	const body = sources
		.map((source) => `SOURCE [${source.n}] ${source.title} (${source.host})${source.cut ? ' (excerpts of a long document; omitted paragraphs are marked)' : ''}\n${source.text}`)
		.join('\n\n---\n\n');
	return (
		`The user's case, as they describe it:\n${facts}\n\nResearch question:\n${topic}\n\n` +
		`Leads from a first search (unverified; use them only to know what to look for):\n${leads || '(none)'}\n\n` +
		`=== SOURCES ===\n${body}`
	);
}

export type Draft = {
	title: string;
	synopsis: Item[];
	law: Item[];
	authorities: { name: string; claims: Item[] }[];
	application: Item[];
	against: Item[];
	notConfirmed: string[];
};
type Item = { text: string; source: number; quote: string };

const str = (value: unknown, max = 600) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const items = (value: unknown): Item[] =>
	(Array.isArray(value) ? value : [])
		.map((entry: any) => ({
			text: str(entry?.text),
			source: Number.isInteger(entry?.source) ? entry.source : -1,
			quote: str(entry?.quote)
		}))
		.filter((entry) => entry.text !== '');

/** Reads the writer's reply, ignoring anything that does not fit the format. */
export function parseDraft(reply: string): Draft | null {
	const start = reply.indexOf('{');
	const end = reply.lastIndexOf('}');
	if (start < 0 || end <= start) return null;
	let parsed: any;
	try {
		parsed = JSON.parse(reply.slice(start, end + 1));
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object') return null;
	return {
		title: str(parsed.title, 200),
		synopsis: items(parsed.synopsis),
		law: items(parsed.law),
		authorities: (Array.isArray(parsed.authorities) ? parsed.authorities : [])
			.map((entry: any) => ({ name: str(entry?.name, 160), claims: items(entry?.claims) }))
			.filter((entry: { name: string }) => entry.name !== ''),
		application: items(parsed.application),
		against: items(parsed.against),
		notConfirmed: (Array.isArray(parsed.notConfirmed) ? parsed.notConfirmed : []).map((note: unknown) => str(note, 300)).filter(Boolean)
	};
}

/** Plain text: the few bits of markup a model adds anyway are removed. */
const plain = (text: string) =>
	text
		.replace(/\*\*|__|`/g, '')
		.replace(/(^|[^\w*])\*([^*\n]+)\*(?![\w*])/g, '$1$2')
		.replace(/^\s*(?:[-–—•]|\d+[.)])\s+/, '')
		.replace(/\s+/g, ' ')
		.trim();

export type Readable = { pages: Map<number, string>; pdfs: Set<number> };

/**
 * Turns the writer's draft into the report. A statement stays only if its quote is found in the
 * source it names (for a page we hold) or the source is a PDF the model read (labelled as such);
 * anything else is counted as dropped. Only the application section may reason beyond a source, and
 * it says so. Section sizes and statement lengths are clamped to the template.
 */
export function buildReport(draft: Draft, topic: string, readable: Readable): Report {
	let dropped = 0;
	const droppedTexts: string[] = [];

	const verify = (item: Item, allowInference: boolean): ReportLine | null => {
		const text = clampWords(plain(item.text), MAX_LINE_WORDS);
		if (!text) return null;
		if (allowInference && item.source === 0 && !item.quote) return { text, cites: [], basis: 'inference' };

		const page = readable.pages.get(item.source);
		if (page !== undefined && item.quote && quoteSupported(item.quote, page)) {
			return { text, cites: [item.source], basis: 'source', check: { status: 'confirmed', source: item.source, quote: item.quote } };
		}
		if (readable.pdfs.has(item.source) && item.quote) {
			return { text, cites: [item.source], basis: 'source', check: { status: 'read', source: item.source, quote: item.quote } };
		}
		dropped += 1;
		if (droppedTexts.length < 3) droppedTexts.push(text);
		return null;
	};
	const lines = (list: Item[], allowInference: boolean, max: number) =>
		list.map((item) => verify(item, allowInference)).filter((line): line is ReportLine => line !== null).slice(0, max);

	const sections: ReportSection[] = RESEARCH_TEMPLATE.map((slot) => {
		const base = { id: slot.id, heading: slot.heading, numbered: slot.numbered, lines: [] as ReportLine[] };
		switch (slot.id) {
			case 'authorities': {
				const children = draft.authorities
					.map((entry) => ({ heading: plain(entry.name), lines: lines(entry.claims, false, MAX_GROUP_LINES) }))
					.filter((child) => child.lines.length > 0)
					.slice(0, slot.max);
				return { ...base, children };
			}
			case 'notConfirmed': {
				const notes = draft.notConfirmed.map((note) => clampWords(plain(note), 40)).filter(Boolean);
				const unverified = droppedTexts.map((text) => `Could not verify against the page: ${text}`);
				return { ...base, notes: [...notes, ...unverified].slice(0, slot.max) };
			}
			default:
				return { ...base, lines: lines((draft as any)[slot.id] as Item[], !!slot.inference, slot.max) };
		}
	});

	return { kind: 'research', title: clampWords(plain(draft.title) || topic, 24), sections, dropped };
}

/** How many lines of the report rest on a page, for the tally. */
export function reportTally(report: Report): { lines: number; confirmed: number; read: number; inferred: number } {
	const all = report.sections.flatMap((section) => [...section.lines, ...(section.children ?? []).flatMap((child) => child.lines)]);
	return {
		lines: all.length,
		confirmed: all.filter((line) => line.check?.status === 'confirmed').length,
		read: all.filter((line) => line.check?.status === 'read').length,
		inferred: all.filter((line) => line.basis === 'inference').length
	};
}
