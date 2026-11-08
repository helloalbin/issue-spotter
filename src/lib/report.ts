import type { Report, ReportLine, ReportSection, ResearchSource } from './spotter.ts';

/**
 * The layout of a research report. One definition decides the headings, their order and numbering,
 * how many lines each may hold and how long a line may be, and both the page and the downloaded
 * Markdown are produced from it, so they always agree. Compare cases and Verify cites will add
 * their own entries here.
 */
export type Slot = {
	id: string;
	heading: string;
	/** Shown as a numbered list. */
	numbered: boolean;
	/** The section number in the heading ("1. Governing law"); the synopsis has none. */
	number: boolean;
	min: number;
	max: number;
	/** Text shown when the section has nothing in it. */
	empty: string;
	/** The section holds sub-headed groups, such as one per case. */
	grouped?: boolean;
	/** Most lines in one group; defaults to MAX_GROUP_LINES. */
	groupMax?: number;
	/** Lines may be the writer's own reasoning about the user's facts. */
	inference?: boolean;
	/** The section is a list of plain notes with no source. */
	plain?: boolean;
};

export const MAX_LINE_WORDS = 60;
export const MAX_GROUP_LINES = 3;

export const RESEARCH_TEMPLATE: Slot[] = [
	{ id: 'synopsis', heading: 'Synopsis', numbered: true, number: false, min: 3, max: 5, empty: 'No point could be confirmed from the pages read.' },
	{ id: 'law', heading: 'Governing law', numbered: false, number: true, min: 0, max: 6, empty: 'No statute or provision was confirmed from the pages read.' },
	{ id: 'authorities', heading: 'Key authorities', numbered: false, number: true, min: 0, max: 6, grouped: true, empty: 'No judgment was confirmed from the pages read.' },
	{ id: 'application', heading: 'Application to your facts', numbered: false, number: true, min: 0, max: 5, inference: true, empty: 'Nothing could be applied to your facts from the pages read.' },
	{ id: 'against', heading: 'What cuts the other way', numbered: false, number: true, min: 0, max: 5, empty: 'No qualifying or contrary authority was found in the pages read. That does not mean none exists.' },
	{ id: 'notConfirmed', heading: 'Not confirmed', numbered: false, number: true, min: 0, max: 8, plain: true, empty: 'Nothing further to flag.' }
];

export const COMPARE_TEMPLATE: Slot[] = [
	{ id: 'synopsis', heading: 'Synopsis', numbered: true, number: false, min: 3, max: 5, empty: 'No point could be confirmed from the pages read.' },
	{ id: 'cases', heading: 'The cases', numbered: false, number: true, min: 0, max: 2, grouped: true, groupMax: 3, empty: 'The cases could not be described from the pages read.' },
	{ id: 'facts', heading: 'Facts compared', numbered: false, number: true, min: 0, max: 4, grouped: true, groupMax: 4, empty: 'The facts could not be compared from the pages read.' },
	{ id: 'holdings', heading: 'Judgments compared', numbered: false, number: true, min: 0, max: 4, grouped: true, groupMax: 4, empty: 'The judgments could not be compared from the pages read.' },
	{ id: 'treatment', heading: 'How other decisions treated them', numbered: false, number: true, min: 0, max: 5, empty: 'No decision overturning, reversing, doubting or following either case was found in the pages read. That does not mean none exists.' },
	{ id: 'together', heading: 'How they fit together', numbered: false, number: true, min: 0, max: 4, inference: true, empty: 'Nothing could be drawn together from the pages read.' },
	{ id: 'notConfirmed', heading: 'Not confirmed', numbered: false, number: true, min: 0, max: 8, plain: true, empty: 'Nothing further to flag.' }
];

export const templateFor = (kind: Report['kind']): Slot[] => (kind === 'compare' ? COMPARE_TEMPLATE : RESEARCH_TEMPLATE);

/** Cuts a statement to a word limit at a word boundary. */
export function clampWords(text: string, max = MAX_LINE_WORDS): string {
	const words = text.trim().split(/\s+/);
	if (words.length <= max) return words.join(' ');
	const cut = words.slice(0, max).join(' ');
	// Prefer ending at a sentence or clause, not in the middle of a phrase.
	const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
	if (stop > cut.length * 0.6) return cut.slice(0, stop).replace(/[,;:]$/, '') + (cut[stop] === '.' ? '.' : '…');
	return cut.replace(/[,;:]$/, '') + '…';
}

/** `[1][3]` for a line's sources. */
const marks = (line: ReportLine) => line.cites.map((n) => `[${n}]`).join('');

const inferenceLabel = (kind: Report['kind']) => (kind === 'compare' ? '*(reasoning, not from a page)*' : '*(inference from your facts)*');
const lineMarkdown = (line: ReportLine, kind: Report['kind']) => `${line.text}${marks(line) ? ' ' + marks(line) : ''}${line.basis === 'inference' ? ' ' + inferenceLabel(kind) : ''}`;

/** The numbered title of a section as it is shown: "1. Governing law", "Synopsis". */
export function headingOf(slot: Slot, position: number): string {
	return slot.number ? `${position}. ${slot.heading}` : slot.heading;
}

/**
 * The report as Markdown: H1 title, H2 sections, H3 per case. The numbering of sections counts only
 * the ones that carry a number.
 */
export function renderMarkdown(report: Report, sources: ResearchSource[], template: Slot[] = templateFor(report.kind)): string {
	const out: string[] = [`# ${report.title}`, ''];
	let position = 0;

	for (const slot of template) {
		const section: ReportSection | undefined = report.sections.find((entry) => entry.id === slot.id);
		if (slot.number) position += 1;
		out.push(`## ${headingOf(slot, position)}`, '');

		const lines = section?.lines ?? [];
		const children = section?.children ?? [];
		const notes = section?.notes ?? [];

		if (slot.plain) {
			for (const note of notes) out.push(`- ${note}`);
		} else if (slot.grouped) {
			children.forEach((child, at) => {
				out.push(`### ${position}.${at + 1} ${child.heading}`, '');
				for (const line of child.lines) out.push(`- ${lineMarkdown(line, report.kind)}`);
				out.push('');
			});
		} else {
			lines.forEach((line, at) => out.push(slot.numbered ? `${at + 1}. ${lineMarkdown(line, report.kind)}` : `- ${lineMarkdown(line, report.kind)}`));
		}

		const empty = slot.plain ? notes.length === 0 : slot.grouped ? children.length === 0 : lines.length === 0;
		if (empty) out.push(`*${slot.empty}*`);
		out.push('');
	}

	out.push('## Sources', '');
	for (const source of sources) {
		const kind = source.official ? 'official' : 'copy on Indian Kanoon';
		out.push(`${source.n}. [${source.title}](${source.url}) — ${source.host}, ${kind}${source.read ? `, ${source.read === 'pdf' ? 'PDF read' : 'page read'}` : ''}`);
	}
	if (report.dropped > 0) {
		out.push('', `*${report.dropped} ${report.dropped === 1 ? 'statement was' : 'statements were'} left out because the cited page did not contain the passage given for ${report.dropped === 1 ? 'it' : 'them'}.*`);
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
