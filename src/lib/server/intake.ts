import type { GatheredSource, ResearchSource, SourceStamp } from '../spotter.ts';
import { isOfficialHost, sourceTitle } from './research.ts';
import { stampValid } from './token.ts';
import type { Grant } from './token.ts';
import { hostOf } from './verify.ts';

export const MAX_SOURCES = 8;
export const MAX_EXCERPT_CHARS = 60_000;
export const MAX_TOTAL_CHARS = 300_000;
const MAX_OPENING = 4000;

/** What the browser read of a source, checked and ready to use. */
export type Intake = {
	n: number;
	kind: 'html' | 'pdf';
	url: string;
	host: string;
	official: boolean;
	title: string;
	opening: string;
	excerpt: string;
	cut: boolean;
	needles: Record<string, boolean>;
	stamp?: SourceStamp;
};

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

/**
 * Checks what the browser sent back. Everything here is the visitor's own reading of pages, so it is
 * trusted no further than it must be: a source number must be one the grant named, so its address is
 * the grant's, not the browser's; sizes are capped; and a stamp counts only if the server signed it.
 * Anything malformed is skipped.
 */
export async function intakeSources(raw: unknown, grant: Grant, key: string): Promise<Intake[]> {
	if (!Array.isArray(raw)) return [];
	const out: Intake[] = [];
	const seen = new Set<number>();
	let total = 0;

	for (const entry of raw.slice(0, MAX_SOURCES) as any[]) {
		const n = entry?.n;
		if (!Number.isInteger(n) || n < 1 || n > grant.urls.length || seen.has(n)) continue;
		const url = grant.urls[n - 1];
		const host = hostOf(url);
		const excerpt = text(entry?.excerpt, MAX_EXCERPT_CHARS);
		if (!host || !excerpt.trim() || (entry?.kind !== 'html' && entry?.kind !== 'pdf')) continue;
		if (total + excerpt.length > MAX_TOTAL_CHARS) continue;
		seen.add(n);
		total += excerpt.length;

		const needles: Record<string, boolean> = {};
		for (const [key2, found] of Object.entries(entry?.needles && typeof entry.needles === 'object' ? entry.needles : {}).slice(0, 10)) {
			needles[key2.slice(0, 200)] = found === true;
		}

		let stamp: SourceStamp | undefined;
		const given = entry?.stamp;
		if (given && typeof given.url === 'string' && typeof given.sha256 === 'string' && typeof given.fetchedAt === 'string' && typeof given.sig === 'string') {
			const candidate = { url: given.url, sha256: given.sha256, fetchedAt: given.fetchedAt, sig: given.sig };
			if (/^[0-9a-f]{64}$/.test(candidate.sha256) && (await stampValid(candidate, key))) stamp = candidate;
		}

		out.push({
			n,
			kind: entry.kind,
			url,
			host,
			official: isOfficialHost(host),
			// A PDF has no title, only its first line, which is usually the whole cause title: use a short name instead.
			title: entry.kind === 'pdf' ? sourceTitle(text(entry?.title, 200).replace(/\s+/g, ' ').trim(), url, host) : text(entry?.title, 200).replace(/\s+/g, ' ').trim() || host,
			opening: text(entry?.opening, MAX_OPENING),
			excerpt,
			cut: entry?.cut === true,
			needles,
			stamp
		});
	}
	return out.sort((a, b) => a.n - b.n);
}

/** The source as the report lists it. */
export function sourceOf(intake: Intake): ResearchSource {
	return {
		n: intake.n,
		url: intake.url,
		title: intake.title,
		host: intake.host,
		official: intake.official,
		read: intake.kind === 'pdf' ? 'pdf' : 'text',
		inBrowser: true,
		...(intake.cut && { truncated: true }),
		...(intake.stamp && { stamp: intake.stamp })
	};
}
