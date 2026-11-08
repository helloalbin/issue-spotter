/** Words that carry no meaning when telling two phrasings of the same entry apart. */
const FILLER = new Set(['the', 'of', 'and', 'a', 'an', 'to', 'in', 'on', 'for', 'by', 'with', 'v', 'vs', 'versus']);

function words(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, ' ')
		.split(' ')
		// A stray letter left by "landlord's" or "M.C." says nothing; numbers always do.
		.filter((word) => word && !FILLER.has(word) && (word.length > 1 || /\d/.test(word)));
}

/**
 * Whether two entries are the same point worded slightly differently. The model is asked to copy
 * earlier wording, but a rephrasing should still be recognised, so this compares by shared words.
 */
export function sameEntry(a: string, b: string): boolean {
	const x = new Set(words(a));
	const y = new Set(words(b));
	if (x.size === 0 || y.size === 0) return false;

	const shared = [...x].filter((word) => y.has(word)).length;
	return shared / (x.size + y.size - shared) >= 0.75;
}

export type Placed<T> = { item: T; index: number };

/**
 * How an updated list differs from the one before it. `fresh` is what the new list adds, `kept` is
 * what it shares with the old one, and `gone` is what the old one had that the new one dropped.
 * Each earlier entry matches at most one new entry, and positions in the new list are kept so the
 * entries can still be looked up by them.
 */
export function compareBy<T>(
	previous: T[],
	next: T[],
	key: (item: T) => string
): { fresh: Placed<T>[]; kept: Placed<T>[]; gone: T[] } {
	const used = new Set<number>();
	const fresh: Placed<T>[] = [];
	const kept: Placed<T>[] = [];

	next.forEach((item, index) => {
		const match = previous.findIndex(
			(earlier, at) => !used.has(at) && sameEntry(key(earlier), key(item))
		);
		if (match === -1) {
			fresh.push({ item, index });
		} else {
			used.add(match);
			kept.push({ item, index });
		}
	});

	return { fresh, kept, gone: previous.filter((_, at) => !used.has(at)) };
}
