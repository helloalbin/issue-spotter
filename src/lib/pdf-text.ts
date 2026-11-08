/**
 * Turning the pages of a PDF into Markdown paragraphs, so a long judgment can be cut down to its
 * most relevant parts the same way a web page is. It runs in the browser, where the PDF library is
 * already loaded for uploads; the server never parses a PDF.
 */

/** A page reduced to its lines, top to bottom. */
export type PageLines = string[];

const NUMBERED = /^\s*(\d{1,3}[.)]|\([a-z0-9]{1,4}\)|[ivxl]{1,5}\.)\s+\S/i;
const PAGE_NUMBER = /^\s*(page\s+)?\d{1,4}(\s+of\s+\d{1,4})?\s*$/i;
const STAMP = /^(signature not verified|digitally signed|reason:|date:\s*\d|this document is|neutral citation)/i;

/** Lines that repeat on many pages are running headers and footers, not judgment. */
function repeatedLines(pages: PageLines[]): Set<string> {
	if (pages.length < 3) return new Set();
	const counts = new Map<string, number>();
	for (const page of pages) {
		for (const line of new Set(page.map((entry) => entry.trim()))) {
			if (line.length > 0 && line.length < 100) counts.set(line, (counts.get(line) ?? 0) + 1);
		}
	}
	return new Set([...counts].filter(([, count]) => count >= Math.max(3, pages.length * 0.4)).map(([line]) => line));
}

/** The length most lines run to, so a short line can be recognised as the end of a paragraph. */
function typicalLength(lines: string[]): number {
	const lengths = lines.map((line) => line.length).filter((length) => length > 20).sort((a, b) => a - b);
	return lengths.length === 0 ? 80 : lengths[Math.floor(lengths.length * 0.75)];
}

/**
 * Pages to paragraphs, one per line of the result. A wrapped line is joined to the one before, a
 * word split across lines by a hyphen is rejoined, and a numbered paragraph or a short line that ends
 * a sentence starts a new one.
 */
export function pagesToMarkdown(pages: PageLines[]): string {
	const repeated = repeatedLines(pages);
	const kept = pages.map((page) =>
		page.map((line) => line.replace(/\s+/g, ' ').trim()).filter((line) => line && !repeated.has(line) && !PAGE_NUMBER.test(line) && !STAMP.test(line))
	);
	const typical = typicalLength(kept.flat());

	const paragraphs: string[] = [];
	let current = '';
	let previousLength = 0;
	const flush = () => {
		if (current) paragraphs.push(current);
		current = '';
	};

	for (const line of kept.flat()) {
		const startsNew = NUMBERED.test(line) || (current !== '' && /[.:;?]$/.test(current) && previousLength < typical * 0.75 && /^[A-Z“"(]/.test(line));
		if (startsNew) flush();
		if (!current) current = line;
		else if (current.endsWith('-') && /^[a-z]/.test(line)) current = current.slice(0, -1) + line;
		else current += ' ' + line;
		previousLength = line.length;
	}
	flush();
	return paragraphs.join('\n');
}

/** The minimal part of a pdf.js document this needs, so it can be tested in Node. */
export type PdfDocument = {
	numPages: number;
	getPage(number: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }>;
};

/** Reads the lines of each page. `maxPages` keeps a very long judgment from taking forever. */
export async function readPdfPages(document: PdfDocument, maxPages = 600): Promise<PageLines[]> {
	const pages: PageLines[] = [];
	for (let number = 1; number <= Math.min(document.numPages, maxPages); number++) {
		const content = await (await document.getPage(number)).getTextContent();
		const lines: string[] = [];
		let line = '';
		for (const item of content.items) {
			if (typeof item.str !== 'string') continue;
			line += item.str;
			if (item.hasEOL) {
				lines.push(line);
				line = '';
			}
		}
		if (line.trim()) lines.push(line);
		pages.push(lines);
	}
	return pages;
}
