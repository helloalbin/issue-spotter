import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFileRequest, parseReadingReply, readingMessages } from './reading.ts';

// 1x1 images, the smallest valid ones.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const JPEG = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
const WEBP = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';

test('accepts extracted text and cuts it to the attachment limit, marking it', () => {
	const short = parseFileRequest({ name: 'notice.pdf', kind: 'text', text: 'To the tenant, you are hereby notified to vacate.' });
	assert.ok(short.ok && short.kind === 'text' && short.truncated === false);
	const long = parseFileRequest({ name: 'big.pdf', kind: 'text', text: 'word '.repeat(10000) });
	assert.ok(long.ok && long.kind === 'text' && long.truncated === true && long.text.length <= 12000);
});

test('refuses empty, too-long and unnamed files', () => {
	assert.equal(parseFileRequest({ name: 'a.pdf', kind: 'text', text: '   ' }).ok, false);
	assert.equal(parseFileRequest({ name: 'a.pdf', kind: 'text', text: 'x'.repeat(60001) }).ok, false);
	assert.equal(parseFileRequest({ name: '', kind: 'text', text: 'x'.repeat(100) }).ok, false);
	assert.equal(parseFileRequest({ name: 'a', kind: 'video' }).ok, false);
	assert.equal(parseFileRequest(null).ok, false);
});

test('accepts a real PNG, JPEG or WebP and nothing else dressed up as one', () => {
	for (const [type, data] of [['png', PNG], ['jpeg', JPEG], ['webp', WEBP]]) {
		assert.equal(parseFileRequest({ name: 'p', kind: 'image', dataUrl: `data:image/${type};base64,${data}` }).ok, true, type);
	}
	// A PDF's bytes labelled as a PNG, a script labelled as JPEG, and a type that is not allowed.
	assert.equal(parseFileRequest({ name: 'p', kind: 'image', dataUrl: `data:image/png;base64,${btoa('%PDF-1.4 hello')}` }).ok, false);
	assert.equal(parseFileRequest({ name: 'p', kind: 'image', dataUrl: `data:image/jpeg;base64,${btoa('<script>alert(1)</script>')}` }).ok, false);
	assert.equal(parseFileRequest({ name: 'p', kind: 'image', dataUrl: `data:image/svg+xml;base64,${btoa('<svg/>')}` }).ok, false);
	assert.equal(parseFileRequest({ name: 'p', kind: 'image', dataUrl: `data:image/png;base64,${'A'.repeat(1_900_000)}` }).ok, false);
});

test('builds a text reading and an image reading, with the file named', () => {
	const text = parseFileRequest({ name: 'notice.pdf', kind: 'text', text: 'To the tenant, you are hereby notified to vacate.' });
	assert.ok(text.ok);
	const textMessages = readingMessages(text as never);
	assert.match(String(textMessages[0].content), /cannot be trusted/);
	assert.match(String(textMessages[1].content), /^File name: notice\.pdf\n\nTo the tenant/);

	const image = parseFileRequest({ name: 'scan.png', kind: 'image', dataUrl: `data:image/png;base64,${PNG}` });
	assert.ok(image.ok);
	const parts = readingMessages(image as never)[1].content as { type: string }[];
	assert.deepEqual(parts.map((part) => part.type), ['text', 'image_url']);
});

test('reads a legal reply, with bounded fields', () => {
	const reply = parseReadingReply(JSON.stringify({ legal: true, documentKind: 'legal notice', title: 'Notice to vacate', summary: ['Landlord asks tenant to vacate.', 'Thirty days given.'], text: '' }));
	assert.ok(reply && reply.legal);
	assert.equal(reply.legal && reply.reading.documentKind, 'legal notice');
	assert.equal(reply.legal && reply.reading.summary.length, 2);
});

test('an unrelated file comes back as not legal, with a one-line description', () => {
	const reply = parseReadingReply(JSON.stringify({ legal: false, documentKind: 'recipe', summary: ['A recipe for lentil soup.', 'ignored'] }));
	assert.deepEqual(reply, { legal: false, documentKind: 'recipe', summary: 'A recipe for lentil soup.' });
});

test('a malformed reply, or one with no summary, is rejected rather than trusted', () => {
	assert.equal(parseReadingReply('not json'), null);
	assert.equal(parseReadingReply(JSON.stringify({ legal: true, documentKind: 'x', summary: [] })), null);
	const big = parseReadingReply(JSON.stringify({ legal: true, documentKind: 'k'.repeat(300), title: 't'.repeat(500), summary: Array.from({ length: 12 }, () => 's'.repeat(900)), text: 'x'.repeat(50000) }));
	assert.ok(big && big.legal);
	assert.ok(big.legal && big.reading.summary.length === 5 && big.reading.summary[0].length === 300 && big.title.length === 120 && big.reading.documentKind.length === 40 && big.text.length <= 12000);
});
