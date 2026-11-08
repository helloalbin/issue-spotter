import { matchKey } from './ground.ts';
import type { CaseCandidate } from '../spotter.ts';
import type { SourceText } from './writer.ts';

export const IDENTIFY_INSTRUCTIONS =
	'A law student names two Indian court cases to compare, perhaps only by party names, a partial citation, a year or a court. Use web search to find the judgment page for each. ' +
	'Prefer an Indian Kanoon document page (indiankanoon.org/doc/...), because the app can read it; give an official court page only if no Indian Kanoon copy exists. ' +
	'Take each case from what the student wrote; do not add cases they did not name, and do not swap one case for a different one with a similar name. If a case is ambiguous, give the most likely judgment. If you cannot find one, give it with an empty url. ' +
	'Reply with JSON only: {"cases":[{"query":"the words the student used for this case","name":"Party v. Party","court":"","year":"","url":""}]}. At most two cases.';

export type Identified = { query: string; name: string; court: string; year: string; url: string };

/** Reads the identification reply: up to two cases, ignoring anything malformed. */
export function parseIdentification(reply: string): Identified[] {
	const start = reply.indexOf('{');
	const end = reply.lastIndexOf('}');
	if (start < 0 || end <= start) return [];
	let parsed: any;
	try {
		parsed = JSON.parse(reply.slice(start, end + 1));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed?.cases)) return [];
	const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
	return parsed.cases
		.map((entry: any) => ({ query: text(entry?.query, 200), name: text(entry?.name, 200), court: text(entry?.court, 120), year: text(entry?.year, 12), url: text(entry?.url, 500) }))
		.filter((entry: Identified) => entry.name !== '')
		.slice(0, 2);
}

const NAME_STOP = new Set(
	('union india state versus and the others another ors anr etc limited ltd company pvt private government govt secretary ' +
		'director directorate officer commissioner minister ministry department board authority through its'
	).split(' ')
);

/** The words of a case name that tell it apart: party names, not "Union of India". */
export function nameWords(name: string): string[] {
	return [...new Set(matchKey(name).split(' ').filter((word) => word.length >= 3 && !NAME_STOP.has(word)))];
}

/**
 * Whether a fetched page is about the case that was named: most of the distinguishing words of the
 * name appear in the page's title or its opening. This guards against a search result that is a
 * different case with a similar name.
 */
export function pageIsCase(name: string, title: string, openingText: string): boolean {
	const words = nameWords(name);
	if (words.length === 0) return false;
	const haystack = ` ${matchKey(`${title} ${openingText.slice(0, 4000)}`)} `;
	const found = words.filter((word) => haystack.includes(` ${word} `)).length;
	return found >= Math.max(1, Math.ceil(words.length * 0.7));
}

export const TREATMENT_INSTRUCTIONS =
	'Two Indian judgments are being compared. Use web search to find any other decision that overturned, reversed, set aside, overruled, doubted or distinguished either of them, and the decisions that most clearly followed or applied them. ' +
	'Include the history of the same case: an earlier High Court or trial judgment that one of them reversed, a later appeal or review, and a larger bench that later overruled it. ' +
	'Prefer Indian Kanoon document pages. For each decision you find, say in one sentence which of the two it concerns and what it did, and cite its page. ' +
	'If you find nothing, say so plainly. Never invent a case, a citation or a holding.';

export function treatmentInput(first: string, second: string): string {
	return `Judgment 1: ${first}\nJudgment 2: ${second}`;
}

export const COMPARE_INSTRUCTIONS =
	'You write a comparison of two Indian court judgments for a law student, in a fixed format, from source texts you are given. ' +
	'SOURCE [1] is the first judgment and SOURCE [2] the second. Any other SOURCE is a decision that may have overturned, reversed or doubted one of them. ' +
	'Use ONLY what those texts say; never your own knowledge, and never the leads except to know what to look for. ' +
	'Each statement is {text, source, quote}: text is one plain sentence of at most 45 words; source is the number n of the SOURCE it rests on; ' +
	'quote is copied exactly, character for character, from that SOURCE, 8 to 40 words, the passage that supports it. Join two passages with "…". Never paraphrase inside a quote, and never run a quote across a line like "[… 12 paragraphs omitted …]". ' +
	'A statement you cannot support with a quote does not belong in the report: leave it out and, if it matters, name it in notConfirmed. A statement about one judgment rests on that judgment\'s own SOURCE. ' +
	'Fields: title is "Case A v. Case B" in at most 15 words. synopsis is 3 to 5 numbered points on how the two judgments relate, each a complete sentence and each saying something the others do not. ' +
	'cases has one group per judgment (name as "Party v. Party (Court, year)" as its SOURCE gives it) with up to 3 statements: the court, the bench or date if stated, and what the case was about. ' +
	'facts has up to four groups: one named after each case ("<Case> facts") with up to 4 statements of its material facts, then "Similarities" and "Differences" between the facts, each statement resting on one SOURCE. ' +
	'holdings has up to four groups in the same way: "<Case> held" for each, with the question decided and the reasoning, then "Where they agree" and "Where they differ". ' +
	'treatment is what the other SOURCES did to either judgment. Begin each statement with one label word for the effect: Overruled, Reversed, Set aside, Doubted, Distinguished, Followed or Applied, then name the decision and the judgment it concerns. List the ones that overturned or doubted a judgment first, including an earlier judgment in the same case that one of them reversed. Leave it empty if the other SOURCES do not deal with either judgment. ' +
	'together is how the two fit together, for example which to rely on for which point; here, and only here, a statement may be your own reasoning, with source 0 and an empty quote. ' +
	'notConfirmed is what you looked for and could not find in the sources, as short plain sentences. Plain text only: no markdown, no bullets, no numbering inside statements. Keep the parts that cut against a comparison, not only the parts that support it.';

/** The writer's input for a comparison: the two judgments first, then any decisions that may have overturned them. */
export function compareInput(title: string, leads: string, sources: SourceText[]): string {
	const body = sources
		.map((source) => `SOURCE [${source.n}] ${source.title} (${source.host})${source.cut ? ' (excerpts of a long document; omitted paragraphs are marked)' : ''}\n${source.text}`)
		.join('\n\n---\n\n');
	return `Comparison requested:\n${title}\n\nLeads from a search for decisions that overturned either (unverified; use only to know what to look for):\n${leads || '(none)'}\n\n=== SOURCES ===\n${body}`;
}

/** What each part of a case is read for: its facts and what the court decided. */
export const COMPARE_QUERY = 'facts background appellant respondent petitioner contention held decided reasoning ratio conclusion order allowed dismissed';

export const isReady = (candidates: CaseCandidate[]) => candidates.length === 2 && candidates.every((candidate) => candidate.verified && candidate.readable);
