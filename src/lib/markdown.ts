import { actLink, caseLink, sectionLink } from '#lib/sources.js';
import { caseKey, sectionKey, actKey } from '#lib/spotter.js';
import type { SourceMatch, SpotterResult } from '#lib/spotter.js';

/** The analysis as Markdown, for the "Copy as Markdown" action. */
/** Verified links, by reference key, replace the search links where there are any. */
export function toMarkdown(
	turns: string[],
	result: SpotterResult,
	sources: Record<string, SourceMatch> = {}
): string {
	const lines: string[] = ['# Issue analysis', '', '## Case facts', '', (turns[0] ?? '').trim(), ''];
	turns.slice(1).forEach((turn) => lines.push('### Added to the case', '', turn.trim(), ''));

	lines.push('## Primary legal issues', '');
	result.issues.forEach((item, index) => lines.push(`${index + 1}. ${item}`));

	lines.push('', '## Relevant doctrines', '');
	result.doctrines.forEach((item) => lines.push(`- ${item}`));

	lines.push('', '## Landmark precedents', '');
	result.precedents.forEach((precedent, index) => {
		const year = precedent.year ? ` (${precedent.year})` : '';
		const href = sources[caseKey(index)]?.url ?? caseLink(precedent, result.jurisdiction).href;
		lines.push(`- [${precedent.name}](${href})${year}`);
	});

	lines.push('', '## Applicable acts & sections', '');
	result.acts.forEach((entry, actIndex) => {
		const sections = entry.sections
			.map((section, sectionIndex) => {
				const href =
					sources[sectionKey(actIndex, sectionIndex)]?.url ??
					sectionLink(entry.act, section, result.jurisdiction).href;
				return `[${section}](${href})`;
			})
			.join(', ');
		const actHref = sources[actKey(actIndex)]?.url ?? actLink(entry.act, result.jurisdiction).href;
		lines.push(
			`- **[${entry.act}](${actHref})**${sections ? ` (${sections})` : ''}${entry.relevance ? `: ${entry.relevance}` : ''}`
		);
	});

	lines.push(
		'',
		'_Study aid, not legal advice. Links are searches unless marked verified, and even a verified page does not confirm what the analysis claims: check every citation against primary sources._',
		''
	);
	return lines.join('\n');
}
