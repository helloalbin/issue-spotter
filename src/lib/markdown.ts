import { actLink, caseLink, sectionLink } from '#lib/sources.js';
import type { SpotterResult } from '#lib/spotter.js';

/** The analysis as Markdown, for the "Copy as Markdown" action. */
export function toMarkdown(facts: string, result: SpotterResult): string {
	const lines: string[] = ['# Issue analysis', '', '## Case facts', '', facts.trim(), ''];

	lines.push('## Primary legal issues', '');
	result.issues.forEach((item, index) => lines.push(`${index + 1}. ${item}`));

	lines.push('', '## Relevant doctrines', '');
	result.doctrines.forEach((item) => lines.push(`- ${item}`));

	lines.push('', '## Landmark precedents', '');
	for (const precedent of result.precedents) {
		const year = precedent.year ? ` (${precedent.year})` : '';
		lines.push(`- [${precedent.name}](${caseLink(precedent, result.jurisdiction).href})${year}`);
	}

	lines.push('', '## Applicable acts & sections', '');
	for (const entry of result.acts) {
		const sections = entry.sections
			.map((section) => `[${section}](${sectionLink(entry.act, section, result.jurisdiction).href})`)
			.join(', ');
		lines.push(
			`- **[${entry.act}](${actLink(entry.act, result.jurisdiction).href})**${sections ? ` (${sections})` : ''}${entry.relevance ? `: ${entry.relevance}` : ''}`
		);
	}

	lines.push(
		'',
		'_Study aid, not legal advice. Links are searches, not confirmations: verify every citation against primary sources._',
		''
	);
	return lines.join('\n');
}
