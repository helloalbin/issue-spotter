import type { Report, ReportLine } from '../spotter.ts';

export const ATTEST_INSTRUCTIONS =
	'You check whether passages appear in an attached PDF judgment. For each numbered passage, say whether it appears in the document. ' +
	'Count it as present if its words are there in the same order, allowing only differences in spacing, line breaks, hyphenation at the end of a line and quotation marks. ' +
	'If any word differs, or you cannot find it, it is not present. Do not judge whether the passage is correct or important. ' +
	'Reply with JSON only: {"results":[{"id":1,"present":true}]}';

export const ATTEST_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['results'],
	properties: {
		results: {
			type: 'array',
			items: { type: 'object', additionalProperties: false, required: ['id', 'present'], properties: { id: { type: 'integer' }, present: { type: 'boolean' } } }
		}
	}
};

export type Passage = { id: number; source: number; quote: string };

/** Calls `visit` on every line of a report, in the order it is printed. */
function walk(report: Report, visit: (line: ReportLine) => void) {
	for (const section of report.sections) {
		for (const line of section.lines) visit(line);
		for (const child of section.children ?? []) for (const line of child.lines) visit(line);
	}
}

/** The quotes in a report that were taken from the given sources, numbered in print order. */
export function passagesFrom(report: Report, sources: Set<number>): Passage[] {
	const out: Passage[] = [];
	walk(report, (line) => {
		if (line.check?.quote && sources.has(line.check.source)) out.push({ id: out.length + 1, source: line.check.source, quote: line.check.quote });
	});
	return out;
}

export function attestInput(passages: Passage[]): string {
	return passages.map((passage) => `${passage.id}. ${passage.quote}`).join('\n');
}

export function parseAttest(reply: string): Map<number, boolean> {
	const out = new Map<number, boolean>();
	const start = reply.indexOf('{');
	const end = reply.lastIndexOf('}');
	if (start < 0 || end <= start) return out;
	try {
		for (const entry of JSON.parse(reply.slice(start, end + 1))?.results ?? []) {
			if (Number.isInteger(entry?.id) && typeof entry?.present === 'boolean') out.set(entry.id, entry.present);
		}
	} catch {
		// No answer means the check could not run.
	}
	return out;
}

/**
 * Applies the outcome of the independent check. A line whose quote the model could not find in the
 * official PDF is dropped and named under Not confirmed; one it found is marked attested. A source
 * whose check could not run (`null`) is left as it was.
 */
export function applyAttestation(report: Report, passages: Passage[], outcome: Map<number, Map<number, boolean> | null>): Report {
	const byId = new Map(passages.map((passage) => [passage.id, passage]));
	let id = 0;
	let dropped = 0;
	const droppedTexts: string[] = [];

	const keep = (line: ReportLine): ReportLine | null => {
		if (!line.check?.quote || !passages.some((p) => p.source === line.check!.source)) return line;
		const mine = byId.get(++id);
		const result = mine ? outcome.get(mine.source) : null;
		if (!mine || !result) return line;
		const present = result.get(mine.id);
		if (present === true) return { ...line, check: { ...line.check, attested: true } };
		if (present === false) {
			dropped += 1;
			if (droppedTexts.length < 3) droppedTexts.push(line.text);
			return null;
		}
		return line;
	};

	const sections = report.sections.map((section) => {
		// Counting must follow print order: a section's own lines, then its groups.
		const lines = section.lines.map(keep).filter((line): line is ReportLine => line !== null);
		const children = section.children?.map((child) => ({ ...child, lines: child.lines.map(keep).filter((line): line is ReportLine => line !== null) })).filter((child) => child.lines.length > 0);
		const notes = section.notes;
		return { ...section, lines, ...(children && { children }), ...(notes && { notes }) };
	});

	if (dropped === 0) return { ...report, sections };
	return {
		...report,
		dropped: report.dropped + dropped,
		sections: sections.map((section) =>
			section.notes
				? { ...section, notes: [...section.notes, ...droppedTexts.map((text) => `Could not verify against the official PDF: ${text}`)].slice(0, 8) }
				: section
		)
	};
}
