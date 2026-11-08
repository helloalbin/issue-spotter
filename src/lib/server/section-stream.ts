import type { SpotSection } from '#lib/spotter.js';

export type Section = SpotSection;
const SECTIONS: readonly string[] = [
	'draft',
	'draftNotes',
	'update',
	'summary',
	'issues',
	'doctrines',
	'precedents',
	'acts',
	'counterArguments',
	'openQuestions'
];

/** Something the parser found in the model's JSON as it streamed in. */
export type Piece = { item: { section: Section; value: unknown } } | { done: Section };

const isSection = (key: string | null): key is Section => SECTIONS.includes(key as string);

/**
 * Reads the model's `{ "issues": [...], "doctrines": [...], ... }` reply as it arrives, in any
 * chunking, and reports each array element the moment it is complete, then each array as it closes.
 * Elements are strings or objects; anything else, and any key that is not a section, is skipped.
 * It never validates: the full reply is still parsed and normalized once it ends.
 */
export class SectionParser {
	#depth = 0;
	#inString = false;
	#escaped = false;
	#text = '';
	/** The text of an object element being collected, or null. */
	#object: string | null = null;
	#expectKey = false;
	#key: string | null = null;
	#section: Section | null = null;

	push(chunk: string): Piece[] {
		const pieces: Piece[] = [];

		for (const char of chunk) {
			if (this.#object !== null) this.#collectObject(char, pieces);
			else if (this.#inString) this.#collectString(char, pieces);
			else this.#structure(char, pieces);
		}

		return pieces;
	}

	#structure(char: string, pieces: Piece[]) {
		switch (char) {
			case '"':
				this.#inString = true;
				this.#text = '';
				break;
			case '{':
				if (this.#depth === 2 && this.#section) {
					this.#object = '{';
					this.#depth = 3;
				} else {
					this.#depth += 1;
					if (this.#depth === 1) this.#expectKey = true;
				}
				break;
			case '[':
				this.#depth += 1;
				if (this.#depth === 2 && isSection(this.#key)) this.#section = this.#key;
				break;
			case ']':
				this.#depth -= 1;
				if (this.#depth === 1 && this.#section) {
					pieces.push({ done: this.#section });
					this.#section = null;
				}
				break;
			case '}':
				this.#depth -= 1;
				break;
			case ',':
				if (this.#depth === 1) this.#expectKey = true;
				break;
		}
	}

	#collectString(char: string, pieces: Piece[]) {
		if (this.#escaped) {
			this.#escaped = false;
		} else if (char === '\\') {
			this.#escaped = true;
		} else if (char === '"') {
			this.#inString = false;
			const value = decode(this.#text);
			if (this.#depth === 1 && this.#expectKey) {
				this.#key = value;
				this.#expectKey = false;
			} else if (this.#depth === 2 && this.#section && value !== null) {
				pieces.push({ item: { section: this.#section, value } });
			}
			return;
		}
		this.#text += char;
	}

	#collectObject(char: string, pieces: Piece[]) {
		this.#object += char;

		if (this.#inString) {
			if (this.#escaped) this.#escaped = false;
			else if (char === '\\') this.#escaped = true;
			else if (char === '"') this.#inString = false;
		} else if (char === '"') {
			this.#inString = true;
		} else if (char === '{' || char === '[') {
			this.#depth += 1;
		} else if (char === '}' || char === ']') {
			this.#depth -= 1;
			if (this.#depth === 2) {
				try {
					pieces.push({ item: { section: this.#section!, value: JSON.parse(this.#object!) } });
				} catch {
					// A malformed element is dropped here; the final parse decides what is kept.
				}
				this.#object = null;
			}
		}
	}
}

function decode(raw: string): string | null {
	try {
		return JSON.parse(`"${raw}"`);
	} catch {
		return null;
	}
}
