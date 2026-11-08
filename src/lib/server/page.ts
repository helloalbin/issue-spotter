import { isAllowedHost } from './verify.ts';

/** A reason the user can act on, with the status the endpoint should answer with. */
export class PageError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; message: string };

const ALLOWED_SITES = 'Indian Kanoon, India Code and the Supreme Court of India';

/**
 * Only https pages on the allowed legal sites can be fetched, with no credentials in the address
 * and no unusual port. Nothing else is ever requested on a user's behalf. `allowLocal` lets a
 * development server fetch from localhost over http, for tests.
 */
export function checkUrl(raw: string, domains: string[], options: { allowLocal?: boolean } = {}): UrlCheck {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		return { ok: false, message: 'That does not look like a web address.' };
	}

	const local = !!options.allowLocal && url.protocol === 'http:' && url.hostname === 'localhost';
	if (!local && url.protocol !== 'https:') {
		return { ok: false, message: 'Only secure (https) links can be added.' };
	}
	if (url.username || url.password) {
		return { ok: false, message: 'Links with a username or password cannot be added.' };
	}
	if (!local && url.port && url.port !== '443') {
		return { ok: false, message: 'That link uses an unusual port, so it cannot be added.' };
	}
	if (!local && !isAllowedHost(url.hostname.replace(/^www\./, ''), domains)) {
		return { ok: false, message: `For now you can add pages from ${ALLOWED_SITES}.` };
	}

	return { ok: true, url };
}

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
		if (name[0] === '#') {
			const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
		}
		return ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/** The readable text of a page and its title. Scripts, styles and page furniture are dropped. */
export function htmlToText(html: string): { title: string; text: string } {
	const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ')).trim();

	// A judgment page keeps the judgment in one block; start there to skip the site's own menus.
	const judgment = html.search(/<div[^>]+class=["'][^"']*\bjudgments\b/i);
	const body = judgment >= 0 ? html.slice(judgment) : html;

	const stripped = body
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|svg|head|nav|header|footer|form|iframe|button)\b[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article|pre|table)>/gi, '\n')
		.replace(/<[^>]+>/g, ' ');

	const text = decodeEntities(stripped)
		.replace(/[ \t\f\v ]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return { title, text };
}

/** Cuts text to a limit at a word boundary and says whether it did. */
export function limitText(text: string, max: number): { text: string; truncated: boolean } {
	if (text.length <= max) return { text, truncated: false };
	const cut = text.slice(0, max);
	const boundary = cut.search(/\s\S*$/);
	return { text: (boundary > max * 0.8 ? cut.slice(0, boundary) : cut).trimEnd(), truncated: true };
}

const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

export type FetchedPage = { url: string; title: string; host: string; text: string; truncated: boolean };

/**
 * Fetches one allowed page and returns its text. Redirects are followed by hand so each hop is
 * checked against the allowlist, and the body is read only up to a size limit.
 */
export async function fetchPage(
	fetchFn: typeof fetch,
	raw: string,
	options: { domains: string[]; maxChars: number; signal?: AbortSignal; allowLocal?: boolean }
): Promise<FetchedPage> {
	let current = raw;

	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const check = checkUrl(current, options.domains, { allowLocal: options.allowLocal });
		if (!check.ok) throw new PageError(check.message);

		let response: Response;
		try {
			response = await fetchFn(check.url, {
				redirect: 'manual',
				signal: options.signal,
				headers: {
					accept: 'text/html,text/plain;q=0.9',
					'user-agent': 'LegalSpotter/1.0 (+https://legalspotter.com; page added by a user)'
				}
			});
		} catch (error) {
			if (options.signal?.aborted) throw new PageError('That page took too long to load.', 504);
			throw new PageError('That page could not be reached.', 502);
		}

		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new PageError('That page redirected somewhere unexpected.', 502);
			current = new URL(location, check.url).toString();
			continue;
		}
		if (response.status === 404) throw new PageError('That page was not found.', 404);
		if (!response.ok) throw new PageError(`That site answered with an error (${response.status}).`, 502);

		const type = (response.headers.get('content-type') ?? '').toLowerCase();
		if (type.includes('pdf')) {
			throw new PageError('That link is a PDF, which cannot be added yet. Uploading files is coming.');
		}
		if (type && !/(text\/html|text\/plain|application\/xhtml)/.test(type)) {
			throw new PageError('That link is not a web page the app can read.');
		}

		const body = await readLimited(response, MAX_BYTES);
		const { title, text } = type.includes('text/plain')
			? { title: '', text: body.trim() }
			: htmlToText(body);
		if (text.length < 50) throw new PageError('That page has no readable text.');

		const limited = limitText(text, options.maxChars);
		return {
			url: check.url.toString(),
			title: title || check.url.hostname,
			host: check.url.hostname.replace(/^www\./, ''),
			text: limited.text,
			truncated: limited.truncated
		};
	}

	throw new PageError('That page redirected too many times.', 502);
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
	if (!response.body) return '';
	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let received = 0;
	let text = '';

	while (received < maxBytes) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		text += decoder.decode(value, { stream: true });
	}

	// Past the limit the rest is ignored; the page text is cut to a few thousand characters anyway.
	await reader.cancel().catch(() => {});
	return text + decoder.decode();
}
