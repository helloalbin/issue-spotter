import type { DraftBlock } from '#lib/spotter.js';

export type Piece = { text: string; gap: boolean };

/**
 * Splits draft text so the parts in [square brackets] can be shown apart: details the user must
 * fill in, and statute sections they must check. Nothing is changed or dropped.
 */
export function splitGaps(text: string): Piece[] {
	return text
		.split(/(\[[^\]\n]+\])/)
		.filter((part) => part !== '')
		.map((part) => ({ text: part, gap: /^\[[^\]\n]+\]$/.test(part) }));
}

/** How many [bracketed] gaps a draft still has. */
export function gapCount(blocks: DraftBlock[]): number {
	return blocks.reduce((sum, block) => sum + splitGaps(`${block.heading}\n${block.text}`).filter((piece) => piece.gap).length, 0);
}

/** The draft as plain text to copy or download: the title, then each part under its heading. */
export function draftToText(title: string | undefined, blocks: DraftBlock[]): string {
	const parts = blocks.map((block) => (block.heading ? `${block.heading.toUpperCase()}\n\n${block.text}` : block.text));
	return [title?.toUpperCase(), ...parts].filter(Boolean).join('\n\n\n') + '\n';
}
