import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PageError } from './page.ts';
import { relaySource } from './relay.ts';

const domains = ['indiankanoon.org', 'sci.gov.in'];
const opts = { domains, maxBytes: 1000 };
const body = (text: string) => new TextEncoder().encode(text);
const reply = (data: Uint8Array<ArrayBuffer> | string, headers: Record<string, string> = {}, status = 200) =>
	new Response(typeof data === 'string' ? body(data) : data, { status, headers });

test('a page is relayed with its kind, final address and a SHA-256 of its bytes', async () => {
	const html = '<html><body>' + 'x'.repeat(100) + '</body></html>';
	const out = await relaySource(async () => reply(html, { 'content-type': 'text/html; charset=utf-8' }), 'https://indiankanoon.org/doc/1/', opts);
	assert.equal(out.kind, 'html');
	assert.equal(out.finalUrl, 'https://indiankanoon.org/doc/1/');
	assert.match(out.sha256, /^[0-9a-f]{64}$/);
	assert.deepEqual([...out.bytes.slice(0, 6)], [...body('<html>')]);
});

test('a PDF is recognised by its type or its first bytes', async () => {
	const pdf = '%PDF-1.7\n' + 'y'.repeat(100);
	assert.equal((await relaySource(async () => reply(pdf, { 'content-type': 'application/pdf' }), 'https://api.sci.gov.in/a.pdf', opts)).kind, 'pdf');
	assert.equal((await relaySource(async () => reply(pdf, { 'content-type': 'application/octet-stream' }), 'https://api.sci.gov.in/a.pdf', opts)).kind, 'pdf');
});

test('an address outside the allowed sites is refused before anything is fetched', async () => {
	let called = false;
	await assert.rejects(relaySource(async () => ((called = true), reply('x'.repeat(100))), 'https://evil.example/doc', opts), PageError);
	assert.equal(called, false);
});

test('a redirect to another site is refused on that hop', async () => {
	let calls = 0;
	const fetcher = async () => (++calls === 1 ? reply('', { location: 'https://evil.example/x' }, 302) : reply('x'.repeat(100)));
	await assert.rejects(relaySource(fetcher, 'https://indiankanoon.org/doc/1/', opts), PageError);
	assert.equal(calls, 1);
});

test('a file over the size cap is refused, whether declared or streamed', async () => {
	await assert.rejects(relaySource(async () => reply('x'.repeat(100), { 'content-length': '5000' }), 'https://indiankanoon.org/doc/1/', opts), /too large/);
	await assert.rejects(relaySource(async () => reply('x'.repeat(2000), { 'content-type': 'text/html' }), 'https://indiankanoon.org/doc/1/', opts), /too large/);
});

test('other file types and empty pages are refused', async () => {
	await assert.rejects(relaySource(async () => reply('x'.repeat(100), { 'content-type': 'image/png' }), 'https://indiankanoon.org/doc/1/', opts), /not a page or PDF/);
	await assert.rejects(relaySource(async () => reply('tiny', { 'content-type': 'text/html' }), 'https://indiankanoon.org/doc/1/', opts), /no readable text/);
});
