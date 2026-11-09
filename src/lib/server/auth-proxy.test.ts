import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passOn, proxyTarget } from './auth-proxy.ts';

const target = (path: string, project: string | null = 'demo-app') => proxyTarget(new URL(`https://legalspotter.com${path}`), project ?? undefined)?.href ?? null;

test('Firebase sign-in paths go to the project host, with their query', () => {
	assert.equal(target('/__/auth/handler?apiKey=k&providerId=google.com'), 'https://demo-app.firebaseapp.com/__/auth/handler?apiKey=k&providerId=google.com');
	assert.equal(target('/__/auth/iframe.js'), 'https://demo-app.firebaseapp.com/__/auth/iframe.js');
	assert.equal(target('/__/firebase/init.json'), 'https://demo-app.firebaseapp.com/__/firebase/init.json');
});

test('any other path is not passed on', () => {
	assert.equal(target('/'), null);
	assert.equal(target('/api/spot'), null);
	assert.equal(target('/__/other/x'), null);
	assert.equal(target('/__/auth'), null);
});

test('path tricks are refused', () => {
	for (const path of ['/__/auth/../x', '/__/auth/%2e%2e/x', '/__/auth//evil', '/__/auth/a%2fb', '/__/auth/a b']) {
		assert.equal(target(path), null, path);
	}
});

test('a backslash is read as a slash by the URL parser, so it stays under the allowed prefix', () => {
	assert.equal(target('/__/auth/a\\b'), 'https://demo-app.firebaseapp.com/__/auth/a/b');
});

test('nothing is passed on without a plain project id', () => {
	assert.equal(target('/__/auth/handler', null), null);
	assert.equal(target('/__/auth/handler', 'evil.example/x'), null);
	assert.equal(target('/__/auth/handler', 'Demo'), null);
});

test('an oversized query is refused', () => {
	assert.equal(target(`/__/auth/handler?x=${'a'.repeat(5000)}`), null);
});

const request = (method = 'GET', headers: Record<string, string> = {}) => new Request('https://legalspotter.com/__/auth/handler?a=1', { method, headers });

test('only the type and caching headers come back, and no credentials go out', async () => {
	let sent: Headers | undefined;
	let asked = '';
	const upstream = async (input: RequestInfo | URL, init?: RequestInit) => {
		asked = String(input);
		sent = new Headers(init?.headers);
		return new Response('<html></html>', { headers: { 'content-type': 'text/html', 'cache-control': 'max-age=60', 'set-cookie': 'a=b', 'x-frame-options': 'DENY' } });
	};
	const out = await passOn(request('GET', { cookie: 'anon_id=1', authorization: 'Bearer x' }), 'demo-app', upstream as typeof fetch);
	assert.equal(asked, 'https://demo-app.firebaseapp.com/__/auth/handler?a=1');
	assert.equal(sent?.get('cookie'), null);
	assert.equal(sent?.get('authorization'), null);
	assert.equal(out?.headers.get('set-cookie'), null);
	assert.equal(out?.headers.get('x-frame-options'), null);
	assert.equal(out?.headers.get('content-type'), 'text/html');
	assert.equal(out?.headers.get('content-security-policy'), "frame-ancestors 'self'");
	assert.equal(await out?.text(), '<html></html>');
});

test('other methods, redirects and failures are not passed through', async () => {
	assert.equal((await passOn(request('POST'), 'demo-app', (async () => new Response('x')) as typeof fetch))?.status, 405);
	assert.equal((await passOn(request(), 'demo-app', (async () => new Response('', { status: 302, headers: { location: 'https://evil.example' } })) as typeof fetch))?.status, 502);
	assert.equal((await passOn(request(), 'demo-app', (async () => { throw new Error('down'); }) as typeof fetch))?.status, 502);
});
