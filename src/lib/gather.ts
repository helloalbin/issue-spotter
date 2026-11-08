import { selectExcerpts } from './excerpt.ts';
import { withPdf } from './extract.ts';
import { matchKey } from './match.ts';
import { pagesToMarkdown, readPdfPages } from './pdf-text.ts';
import { htmlToText } from './source-text.ts';
import type { Gather, GatheredSource, SourceStamp } from './spotter.ts';

const OPENING = 4000;
const MAX_TEXT = 6_000_000;

/** The first line that has words in it, as a stand-in for a title a PDF does not have. */
const firstLine = (text: string) => (text.split('\n').find((line) => line.trim().length > 3) ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

/**
 * Reads the pages the server named, here in the browser. Each is fetched through the server's relay
 * (which checks it was named and stamps it), turned into text with the same code the server uses, or
 * with pdf.js for a PDF, and cut down to the paragraphs most relevant to what is being asked. Only
 * those paragraphs go back to the server, never the whole page. A page that cannot be read is left out.
 */
export async function gatherSources(
	gather: Gather,
	options: { headers: Record<string, string>; signal: AbortSignal; onProgress?: (note: string) => void }
): Promise<GatheredSource[]> {
	const out: GatheredSource[] = [];

	for (const [at, source] of gather.sources.entries()) {
		if (options.signal.aborted) break;
		options.onProgress?.(`Reading page ${at + 1} of ${gather.sources.length} in your browser`);
		try {
			const response = await fetch('/api/fetch', {
				method: 'POST',
				signal: options.signal,
				headers: { 'content-type': 'application/json', ...options.headers },
				body: JSON.stringify({ token: gather.token, url: source.url })
			});
			if (!response.ok) continue;

			const kind = response.headers.get('x-source-kind') === 'pdf' ? 'pdf' : 'html';
			const buffer = await response.arrayBuffer();
			const stamp: SourceStamp = {
				url: response.headers.get('x-source-url') ?? source.url,
				sha256: response.headers.get('x-source-sha256') ?? '',
				fetchedAt: response.headers.get('x-source-fetched-at') ?? '',
				sig: response.headers.get('x-source-sig') ?? ''
			};

			let title = source.title;
			let text: string;
			if (kind === 'pdf') {
				text = await withPdf(buffer, async (document) => pagesToMarkdown(await readPdfPages(document)));
				title = firstLine(text) || source.title || source.host;
			} else {
				const page = htmlToText(new TextDecoder('utf-8').decode(buffer));
				text = page.text;
				title = page.title || source.title || source.host;
			}
			text = text.slice(0, MAX_TEXT);
			if (text.trim().length < 50) continue;

			const excerpt = selectExcerpts(text, gather.queries[source.n] ?? '', gather.chars);
			const needles: Record<string, boolean> = {};
			if (gather.needles?.length) {
				const key = ` ${matchKey(text)} `;
				for (const needle of gather.needles) needles[needle] = matchKey(needle) !== '' && key.includes(` ${matchKey(needle)} `);
			}
			out.push({ n: source.n, kind, title, opening: text.slice(0, OPENING), excerpt: excerpt.text, cut: excerpt.cut, ...(gather.needles?.length && { needles }), stamp });
		} catch (error) {
			if (options.signal.aborted) break;
			// A page that cannot be read is simply left out; the server says what it can do without it.
			console.warn('Could not read a source in the browser:', error);
		}
	}
	return out;
}
