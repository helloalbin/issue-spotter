import { SOURCE_MAX_BYTES } from '$app/env/private';
import { grantSubject } from '#lib/server/identity.js';
import { signingKey } from '#lib/server/grants.js';
import { PageError } from '#lib/server/page.js';
import { relaySource } from '#lib/server/relay.js';
import { RESEARCH_DOMAINS, cleanUrl } from '#lib/server/research.js';
import { readGrant, signStamp } from '#lib/server/token.js';
import type { RequestHandler } from './$types';

/**
 * Hands the browser the bytes of a page it was told to read. It serves only the addresses named in
 * a grant the server signed for this visitor after a search, so it is not an open relay, and it does
 * no parsing: the browser turns the file into text. The response carries a signed stamp of the file's
 * hash and the time it was fetched.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json({ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' }, { status: 401 });
	}

	let token = '';
	let url = '';
	try {
		const body = await request.json();
		token = typeof body?.token === 'string' ? body.token : '';
		url = typeof body?.url === 'string' ? cleanUrl(body.url.trim()) : '';
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	const key = signingKey();
	const grant = token ? await readGrant(token, key) : null;
	if (!grant) return Response.json({ error: 'This request has expired. Please start again.', code: 'grant_invalid' }, { status: 403 });
	if (grant.who !== grantSubject(locals)) return Response.json({ error: 'This request was not issued to you.', code: 'grant_invalid' }, { status: 403 });
	if (!grant.urls.includes(url)) return Response.json({ error: 'That page is not part of this request.', code: 'grant_invalid' }, { status: 403 });

	try {
		const file = await relaySource(fetch, url, { domains: RESEARCH_DOMAINS, maxBytes: SOURCE_MAX_BYTES, signal: request.signal, allowLocal: import.meta.env.DEV });
		const sig = await signStamp({ url: file.finalUrl, sha256: file.sha256, fetchedAt: file.fetchedAt }, key);
		return new Response(file.bytes, {
			headers: {
				'content-type': file.kind === 'pdf' ? 'application/pdf' : 'application/octet-stream',
				'cache-control': 'no-store',
				'x-source-kind': file.kind,
				'x-source-url': file.finalUrl,
				'x-source-sha256': file.sha256,
				'x-source-fetched-at': file.fetchedAt,
				'x-source-sig': sig
			}
		});
	} catch (error) {
		if (error instanceof PageError) return Response.json({ error: error.message }, { status: error.status });
		console.error('Relaying a source failed:', error);
		return Response.json({ error: 'That page could not be fetched.' }, { status: 502 });
	}
};
