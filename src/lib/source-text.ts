/**
 * Turning a fetched page into plain text. These are pure functions, shared by the server and the
 * browser: with the browser route the page is read in the browser, with the same code.
 */

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' '
};

export function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
		if (name[0] === '#') {
			const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
			return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : whole;
		}
		return ENTITIES[name.toLowerCase()] ?? whole;
	});
}

/** The readable text of a page and its title. Scripts, styles and page furniture are dropped. */
export function htmlToText(html: string): { title: string; text: string } {
	const title = decodeEntities((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ')).trim();

	// A judgment page keeps the judgment in one block; start there to skip the site's own menus.
	const judgment = html.search(/<div[^>]+class=["'][^"']*\bjudgments\b/i);
	const body = judgment >= 0 ? html.slice(judgment) : html;

	const stripped = body
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|svg|head|nav|header|footer|form|iframe|button)\b[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article|pre|table)>/gi, '\n')
		.replace(/<[^>]+>/g, ' ');

	const text = decodeEntities(stripped)
		.replace(/[ \t\f\v ]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return { title, text };
}

/** Cuts text to a limit at a word boundary and says whether it did. */
export function limitText(text: string, max: number): { text: string; truncated: boolean } {
	if (text.length <= max) return { text, truncated: false };
	const cut = text.slice(0, max);
	const boundary = cut.search(/\s\S*$/);
	return { text: (boundary > max * 0.8 ? cut.slice(0, boundary) : cut).trimEnd(), truncated: true };
}
