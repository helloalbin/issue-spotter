import type { Precedent } from '#lib/spotter.js';

/**
 * Where a reference can be looked up. The model gives names, never addresses, so every link here is
 * a search the user runs. Opening one does not confirm that a case or section exists or says what
 * the analysis claims, which is why the UI calls them search links.
 */
export type SourceLink = { href: string; host: string; name: string };

const INDIA = /\bindia/i;

/** Indian law is the default, so an unstated jurisdiction searches Indian Kanoon. */
export function searchLink(query: string, jurisdiction?: string): SourceLink {
	const text = query.trim().replace(/\s+/g, ' ');

	if (!jurisdiction || INDIA.test(jurisdiction)) {
		return {
			href: `https://indiankanoon.org/search/?formInput=${encodeURIComponent(text)}`,
			host: 'indiankanoon.org',
			name: 'Indian Kanoon'
		};
	}

	return {
		href: `https://www.google.com/search?q=${encodeURIComponent(text)}`,
		host: 'google.com',
		name: 'Google'
	};
}

export const caseLink = (precedent: Precedent, jurisdiction?: string) =>
	searchLink(precedent.name, jurisdiction);

export const actLink = (act: string, jurisdiction?: string) => searchLink(act, jurisdiction);

export const sectionLink = (act: string, section: string, jurisdiction?: string) =>
	searchLink(`${section} ${act}`, jurisdiction);
