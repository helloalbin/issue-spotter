import type { SpotterResult } from '#lib/spotter.js';

/** The analysis as Markdown, for the "Copy as Markdown" action. */
export function toMarkdown(facts: string, result: SpotterResult): string {
	const lines: string[] = ['# Issue analysis', '', '## Case facts', '', facts.trim(), ''];

	lines.push('## Primary legal issues', '');
	result.issues.forEach((item, index) => lines.push(`${index + 1}. ${item}`));

	lines.push('', '## Relevant doctrines', '');
	result.doctrines.forEach((item) => lines.push(`- ${item}`));

	lines.push('', '## Landmark precedents', '');
	result.precedents.forEach((item) => lines.push(`- ${item}`));

	lines.push('', '## Applicable acts & sections', '');
	for (const entry of result.acts) {
		const sections = entry.sections.length > 0 ? ` (${entry.sections.join(', ')})` : '';
		lines.push(`- **${entry.act}**${sections}${entry.relevance ? `: ${entry.relevance}` : ''}`);
	}

	lines.push('', '_Study aid, not legal advice. Verify every citation against primary sources._', '');
	return lines.join('\n');
}
