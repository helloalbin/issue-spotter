import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sniffFile, sizeLimit } from './file-types.ts';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const text = (s: string) => new TextEncoder().encode(s);

test('recognises a PDF, a Word file and the three image types from their first bytes', () => {
	assert.equal(sniffFile(text('%PDF-1.7 ...'), 'notice.pdf'), 'pdf');
	assert.equal(sniffFile(bytes(0x50, 0x4b, 0x03, 0x04), 'brief.docx'), 'docx');
	assert.equal(sniffFile(bytes(0x89, 0x50, 0x4e, 0x47), 'a.png'), 'image');
	assert.equal(sniffFile(bytes(0xff, 0xd8, 0xff, 0xe0), 'a.jpg'), 'image');
	assert.equal(sniffFile(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]), 'a.webp'), 'image');
});

test('goes by the bytes, not the name: a renamed file is still what it is', () => {
	assert.equal(sniffFile(text('%PDF-1.4'), 'holiday.jpg'), 'pdf');
	assert.equal(sniffFile(bytes(0x89, 0x50, 0x4e, 0x47), 'notice.pdf'), 'image');
});

test('turns everything else away, however it is named', () => {
	for (const [content, name] of [
		[text('MZ executable'), 'invoice.pdf'],
		[text('<html><script>alert(1)</script>'), 'page.png'],
		[text('just some text'), 'notes.txt'],
		[text('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'logo.svg'],
		[bytes(0x50, 0x4b, 0x03, 0x04), 'archive.zip'],
		[bytes(0x50, 0x4b, 0x03, 0x04), 'sheet.xlsx'],
		[bytes(0xd0, 0xcf, 0x11, 0xe0), 'old.doc'],
		[new Uint8Array(0), 'empty.pdf']
	] as [Uint8Array, string][]) {
		assert.equal(sniffFile(content, name), null, name);
	}
});

test('a zip is a Word file only when it is named .docx', () => {
	assert.equal(sniffFile(bytes(0x50, 0x4b, 0x03, 0x04), 'a.DOCX'), 'docx');
	assert.equal(sniffFile(bytes(0x50, 0x4b, 0x03, 0x04), 'a.zip'), null);
});

test('images get a smaller limit than documents', () => {
	assert.ok(sizeLimit('image') < sizeLimit('pdf'));
	assert.equal(sizeLimit('pdf'), sizeLimit('docx'));
});
