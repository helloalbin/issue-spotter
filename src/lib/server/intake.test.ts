import assert from 'node:assert/strict';
import { test } from 'node:test';
import { intakeSources, sourceOf } from './intake.ts';
import { signStamp } from './token.ts';
import type { Grant } from './token.ts';

const grant: Grant = { kind: 'research', who: 'w', day: 'd', nonce: 'n', exp: Date.now() + 1000, urls: ['https://indiankanoon.org/doc/1/', 'https://api.sci.gov.in/a.pdf'] };
const stampBase = { url: 'https://indiankanoon.org/doc/1/', sha256: 'a'.repeat(64), fetchedAt: '2026-11-08T10:00:00.000Z' };

test('a source takes its address from the grant, not from the browser', async () => {
	const out = await intakeSources([{ n: 2, kind: 'pdf', url: 'https://evil.example/x', title: 'T', opening: 'o', excerpt: 'some text here', cut: false }], grant, 'k');
	assert.equal(out[0].url, 'https://api.sci.gov.in/a.pdf');
	assert.equal(out[0].official, true);
});

test('numbers the grant did not name, repeats, empty excerpts and bad kinds are skipped', async () => {
	const good = { n: 1, kind: 'html', title: 'T', opening: '', excerpt: 'text', cut: false };
	const out = await intakeSources([good, { ...good }, { ...good, n: 3 }, { ...good, n: 2, excerpt: '  ' }, { ...good, n: 2, kind: 'exe' }, null, 'x'], grant, 'k');
	assert.deepEqual(out.map((s) => s.n), [1]);
	assert.deepEqual(await intakeSources('nope', grant, 'k'), []);
});

test('sizes are capped', async () => {
	const big = { n: 1, kind: 'html', title: 'T'.repeat(500), opening: 'o'.repeat(9000), excerpt: 'x'.repeat(100_000), cut: true };
	const [one] = await intakeSources([big], grant, 'k');
	assert.equal(one.excerpt.length, 60_000);
	assert.equal(one.opening.length, 4000);
	assert.ok(one.title.length <= 200);
});

test('a stamp is kept only when the server signed it', async () => {
	const sig = await signStamp(stampBase, 'k');
	const base = { n: 1, kind: 'html', title: 'T', opening: '', excerpt: 'text', cut: false };
	const [signed] = await intakeSources([{ ...base, stamp: { ...stampBase, sig } }], grant, 'k');
	assert.ok(signed.stamp);
	const [forged] = await intakeSources([{ ...base, stamp: { ...stampBase, sha256: 'b'.repeat(64), sig } }], grant, 'k');
	assert.equal(forged.stamp, undefined);
	const [wrongKey] = await intakeSources([{ ...base, stamp: { ...stampBase, sig } }], grant, 'other');
	assert.equal(wrongKey.stamp, undefined);
});

test('a source is listed as read in the browser, a PDF as a PDF', async () => {
	const [pdf] = await intakeSources([{ n: 2, kind: 'pdf', title: 'T', opening: '', excerpt: 'text', cut: true }], grant, 'k');
	assert.deepEqual({ read: sourceOf(pdf).read, inBrowser: sourceOf(pdf).inBrowser, truncated: sourceOf(pdf).truncated }, { read: 'pdf', inBrowser: true, truncated: true });
});
