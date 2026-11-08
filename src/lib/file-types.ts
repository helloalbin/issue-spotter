/** The only kinds of file that can be attached. Anything else is turned away before it is read. */
export type FileKind = 'pdf' | 'docx' | 'image';

export const ACCEPTED_TYPES = '.pdf,.docx,image/png,image/jpeg,image/webp';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const REJECTED_FILE =
	"That file type can't be attached. You can add a PDF, a Word (.docx) file, or an image (PNG, JPEG or WebP).";

const startsWith = (bytes: Uint8Array, signature: number[], at = 0) =>
	signature.every((byte, index) => bytes[at + index] === byte);

/**
 * What a file really is, from its first bytes, so that renaming a file cannot get it past the check.
 * A Word file is a zip, so it must also be named .docx.
 */
export function sniffFile(bytes: Uint8Array, name: string): FileKind | null {
	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
	if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) && /\.docx$/i.test(name)) return 'docx';
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image'; // PNG
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
	if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image'; // WebP
	return null;
}

export function sizeLimit(kind: FileKind): number {
	return kind === 'image' ? MAX_IMAGE_BYTES : MAX_DOCUMENT_BYTES;
}
