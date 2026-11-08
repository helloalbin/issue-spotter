import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PageError, checkUrl, fetchPage, htmlToText, limitText } from './page.ts';
import { SOURCE_DOMAINS } from './verify.ts';

const D = SOURCE_DOMAINS;

test('accepts https pages on the allowed sites, with or without www and on subdomains', () => {
	for (const url of [
		'https://indiankanoon.org/doc/1486949/',
		'https://www.indiankanoon.org/doc/1/',
		'https://main.sci.gov.in/judgment/x.html',
		'https://www.indiacode.nic.in/handle/123456789/2338'
	]) {
		assert.equal(checkUrl(url, D).ok, true, url);
	}
});

test('refuses anything else, with a message the user can act on', () => {
	const bad = {
		'http://indiankanoon.org/doc/1/': 'secure',
		'https://example.com/doc/1/': 'Indian Kanoon',
		'https://indiankanoon.org.evil.example/doc/1/': 'Indian Kanoon',
		'https://evil.example/https://indiankanoon.org/': 'Indian Kanoon',
		'https://user:pw@indiankanoon.org/': 'username',
		'https://indiankanoon.org:8443/': 'port',
		'https://127.0.0.1/': 'Indian Kanoon',
		'https://169.254.169.254/latest/meta-data/': 'Indian Kanoon',
		'https://localhost/': 'Indian Kanoon',
		'ftp://indiankanoon.org/': 'secure',
		'not a url': 'web address'
	};
	for (const [url, hint] of Object.entries(bad)) {
		const check = checkUrl(url, D);
		assert.equal(check.ok, false, url);
		assert.ok(!check.ok && check.message.includes(hint), `${url} -> ${!check.ok && check.message}`);
	}
});

test('localhost over http is only allowed when asked for (tests and development)', () => {
	assert.equal(checkUrl('http://localhost:4020/p', D).ok, false);
	assert.equal(checkUrl('http://localhost:4020/p', D, { allowLocal: true }).ok, true);
	assert.equal(checkUrl('http://evil.example/p', D, { allowLocal: true }).ok, false);
});

test('turns a page into its title and readable text, dropping scripts, menus and tags', () => {
	const { title, text } = htmlToText(`<!doctype html><html><head><title>M C Mehta &amp; Ors vs Union Of India</title><style>.x{}</style></head>
		<body><nav>Home | Search</nav><script>alert('x')</script>
		<div class="judgments"><p>The petitioner &quot;argued&quot; that the <b>gas</b> leak&nbsp;was&#33;</p><p>Second&nbsp;paragraph.</p></div>
		<footer>Copyright</footer></body></html>`);
	assert.equal(title, 'M C Mehta & Ors vs Union Of India');
	assert.equal(text, 'The petitioner "argued" that the gas leak was!\nSecond paragraph.');
});

test('cuts long text at a word boundary and says so', () => {
	assert.deepEqual(limitText('short', 100), { text: 'short', truncated: false });
	const cut = limitText('alpha beta gamma delta epsilon', 18);
	assert.equal(cut.truncated, true);
	assert.ok('alpha beta gamma delta epsilon'.startsWith(cut.text));
	assert.ok(!cut.text.endsWith('gam') && !cut.text.endsWith(' '));
});

const page = (body: string, init: ResponseInit = {}) =>
	new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init });
const html = `<html><head><title>Section 73 in The Indian Contract Act</title></head><body><div class="judgments">${'Compensation for loss or damage caused by breach of contract. '.repeat(5)}</div></body></html>`;
const opts = { domains: D, maxChars: 12000 };

test('fetches an allowed page and returns its text', async () => {
	const result = await fetchPage(async () => page(html), 'https://indiankanoon.org/doc/1048000/', opts);
	assert.equal(result.host, 'indiankanoon.org');
	assert.equal(result.title, 'Section 73 in The Indian Contract Act');
	assert.ok(result.text.startsWith('Compensation for loss'));
	assert.equal(result.truncated, false);
});

test('checks every redirect hop, so an allowed site cannot bounce to another', async () => {
	let calls = 0;
	const redirecting = async () => {
		calls++;
		return new Response(null, { status: 302, headers: { location: 'https://evil.example/steal' } });
	};
	await assert.rejects(fetchPage(redirecting, 'https://indiankanoon.org/doc/1/', opts), (e: PageError) => e instanceof PageError && /Indian Kanoon/.test(e.message));
	assert.equal(calls, 1, 'the second request was never made');

	const loop = async () => new Response(null, { status: 302, headers: { location: 'https://indiankanoon.org/doc/2/' } });
	await assert.rejects(fetchPage(loop, 'https://indiankanoon.org/doc/1/', opts), /too many times/);

	let hops = 0;
	const follows = async () => (hops++ === 0 ? new Response(null, { status: 301, headers: { location: '/doc/9/' } }) : page(html));
	assert.equal((await fetchPage(follows, 'https://indiankanoon.org/doc/1/', opts)).url, 'https://indiankanoon.org/doc/9/');
});

test('explains a PDF, a missing page, an error and an empty page', async () => {
	const cases: [Response, RegExp][] = [
		[new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }), /PDF/],
		[new Response('x', { status: 404 }), /not found/],
		[new Response('x', { status: 500 }), /error \(500\)/],
		[page('<html><body>hi</body></html>'), /no readable text/],
		[new Response('{}', { headers: { 'content-type': 'application/json' } }), /not a web page/]
	];
	for (const [response, message] of cases) {
		await assert.rejects(fetchPage(async () => response, 'https://indiankanoon.org/doc/1/', opts), message);
	}
});

test('limits a long page and marks it truncated', async () => {
	const long = `<html><head><title>T</title></head><body><div class="judgments">${'word '.repeat(10000)}</div></body></html>`;
	const result = await fetchPage(async () => page(long), 'https://indiankanoon.org/doc/1/', { ...opts, maxChars: 1000 });
	assert.equal(result.truncated, true);
	assert.ok(result.text.length <= 1000);
});
