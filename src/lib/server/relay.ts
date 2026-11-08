import { PageError, checkUrl } from './page.ts';

const MAX_REDIRECTS = 3;

export type Relayed = {
	bytes: Uint8Array<ArrayBuffer>;
	/** `pdf`, `html` or `text`, from the type the site declared and the first bytes. */
	kind: 'pdf' | 'html' | 'text';
	finalUrl: string;
	sha256: string;
	fetchedAt: string;
};

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function readBytes(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
	if (!response.body) return new Uint8Array(new ArrayBuffer(0));
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel();
			throw new PageError('That file is too large to read.', 413);
		}
		chunks.push(value);
	}
	const all = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		all.set(chunk, at);
		at += chunk.byteLength;
	}
	return all;
}

/**
 * Fetches one allowed file for the browser to read. The server does no parsing: it checks the
 * address on every hop, caps the size, hashes the bytes and hands them over. The hash is a stamp of
 * which file was fetched when; it does not show that text read from the file is faithful.
 */
export async function relaySource(
	fetchFn: typeof fetch,
	raw: string,
	options: { domains: string[]; maxBytes: number; signal?: AbortSignal; allowLocal?: boolean }
): Promise<Relayed> {
	let current = raw;
	for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
		const check = checkUrl(current, options.domains, { allowLocal: options.allowLocal });
		if (!check.ok) throw new PageError(check.message);

		let response: Response;
		try {
			response = await fetchFn(check.url, {
				redirect: 'manual',
				signal: options.signal,
				headers: { accept: 'application/pdf,text/html,text/plain;q=0.9', 'user-agent': 'LegalSpotter/1.0 (+https://legalspotter.com; page read for a user)' }
			});
		} catch {
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

		const declared = Number(response.headers.get('content-length'));
		if (Number.isFinite(declared) && declared > options.maxBytes) throw new PageError('That file is too large to read.', 413);

		const type = (response.headers.get('content-type') ?? '').toLowerCase();
		const bytes = await readBytes(response, options.maxBytes);
		const isPdf = type.includes('pdf') || String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
		if (!isPdf && type && !/(text\/html|text\/plain|application\/xhtml)/.test(type)) {
			throw new PageError('That link is not a page or PDF the app can read.');
		}
		if (bytes.byteLength < 50) throw new PageError('That page has no readable text.');

		return {
			bytes,
			kind: isPdf ? 'pdf' : type.includes('text/plain') ? 'text' : 'html',
			finalUrl: check.url.toString(),
			sha256: hex(await crypto.subtle.digest('SHA-256', bytes)),
			fetchedAt: new Date().toISOString()
		};
	}
	throw new PageError('That page redirected too many times.', 502);
}
