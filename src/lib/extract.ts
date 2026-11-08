import type { PdfDocument } from './pdf-text.ts';
import { MAX_IMAGE_BYTES, REJECTED_FILE, sizeLimit, sniffFile } from '#lib/file-types.js';
import type { FileKind } from '#lib/file-types.js';

/** What is sent to the server to be read: extracted text, or one shrunken image. */
export type Extracted =
	| { kind: 'text'; name: string; text: string }
	| { kind: 'image'; name: string; dataUrl: string };

/** A reason the user can act on. */
export class ExtractError extends Error {}

const MAX_PDF_PAGES = 40;
// Enough text to fill the attachment limit several times over, without reading a whole book.
const MAX_EXTRACTED_CHARS = 55_000;

async function extractPdf(buffer: ArrayBuffer): Promise<string> {
	// pdf.js does its work in a worker. Vite's ?worker import gives a constructor for it that works
	// both in development and in the production build. Each file gets its own worker, closed after.
	const [pdfjs, { default: PdfWorker }] = await Promise.all([
		import('pdfjs-dist'),
		import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
	]);
	// pdf.js types `port` as null, but its own documentation passes a Worker here.
	// @ts-expect-error
	const worker = new pdfjs.PDFWorker({ port: new PdfWorker() });

	try {
		let document;
		try {
			document = await pdfjs.getDocument({ data: new Uint8Array(buffer), worker }).promise;
		} catch (error) {
			if ((error as { name?: string })?.name === 'PasswordException') {
				throw new ExtractError('That PDF is password protected. Remove the password and try again.');
			}
			throw new ExtractError('That PDF could not be opened. It may be damaged.');
		}

		let text = '';
		const pages = Math.min(document.numPages, MAX_PDF_PAGES);
		for (let number = 1; number <= pages && text.length < MAX_EXTRACTED_CHARS; number++) {
			const page = await document.getPage(number);
			const content = await page.getTextContent();
			text += content.items
				.map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
				.join('')
				.concat('\n\n');
		}
		return text.slice(0, MAX_EXTRACTED_CHARS);
	} finally {
		worker.destroy();
	}
}

/**
 * Opens a PDF for a moment and hands it to `use`, then closes it. The same loader the upload path
 * uses, so the PDF library and its worker are fetched once.
 */
export async function withPdf<T>(buffer: ArrayBuffer, use: (document: PdfDocument) => Promise<T>): Promise<T> {
	const [pdfjs, { default: PdfWorker }] = await Promise.all([
		import('pdfjs-dist'),
		import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
	]);
	// pdf.js types `port` as null, but its own documentation passes a Worker here.
	// @ts-expect-error
	const worker = new pdfjs.PDFWorker({ port: new PdfWorker() });
	try {
		let document;
		try {
			document = await pdfjs.getDocument({ data: new Uint8Array(buffer), worker }).promise;
		} catch {
			throw new ExtractError('That PDF could not be opened.');
		}
		return await use(document as never);
	} finally {
		worker.destroy();
	}
}
async function extractDocx(buffer: ArrayBuffer): Promise<string> {
	const mammoth = await import('mammoth/mammoth.browser');
	try {
		const { value } = await mammoth.extractRawText({ arrayBuffer: buffer });
		return value.slice(0, MAX_EXTRACTED_CHARS);
	} catch {
		throw new ExtractError('That Word file could not be opened. It may be damaged.');
	}
}

/** Shrinks an image so it is cheap to read and quick to send. */
async function prepareImage(file: File): Promise<string> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new ExtractError('That image could not be opened. It may be damaged.');
	}

	for (const [side, quality] of [[1600, 0.85], [1200, 0.75], [900, 0.7]] as const) {
		const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL('image/jpeg', quality);
		if (dataUrl.length <= 1_700_000) return dataUrl;
	}
	throw new ExtractError('That image is too detailed to send. Try a smaller one.');
}

/**
 * Checks that a file is one of the kinds that can be attached, and gets its content ready to be
 * read: the text of a PDF or Word file, or a shrunken image. Everything else is refused here.
 */
export async function extractFile(file: File): Promise<Extracted> {
	const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
	const kind: FileKind | null = sniffFile(head, file.name);
	if (!kind) throw new ExtractError(REJECTED_FILE);

	if (file.size > sizeLimit(kind)) {
		const mb = Math.round(sizeLimit(kind) / (1024 * 1024));
		throw new ExtractError(`That file is larger than ${mb} MB. Try a smaller one.`);
	}
	if (file.size === 0) throw new ExtractError('That file is empty.');

	if (kind === 'image') {
		if (file.size > MAX_IMAGE_BYTES) throw new ExtractError('That image is too large.');
		return { kind: 'image', name: file.name, dataUrl: await prepareImage(file) };
	}

	const buffer = await file.arrayBuffer();
	const text = (kind === 'pdf' ? await extractPdf(buffer) : await extractDocx(buffer)).trim();
	if (text.length < 20) {
		throw new ExtractError(
			kind === 'pdf'
				? 'There is no readable text in that PDF. It may be a scan: try uploading the pages as images instead.'
				: 'There is no readable text in that file.'
		);
	}
	return { kind: 'text', name: file.name, text };
}
