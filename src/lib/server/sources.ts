import {
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	SOURCE_MAX_SEARCHES,
	SOURCE_MODEL,
	SOURCE_TIMEOUT_MS
} from '$app/env/private';
import { MAX_SECTIONS_PER_ACT, actKey, caseKey, sectionKey } from '#lib/spotter.js';
import type { SourceMatch, SpotterResult } from '#lib/spotter.js';
import { Deadline } from '#lib/server/deadline.js';
import { SOURCE_DOMAINS, matchSources } from '#lib/server/verify.js';
import type { Citation, Reference } from '#lib/server/verify.js';

const INSTRUCTIONS =
	'You verify legal references. Use web search to find the page for each reference listed, on the ' +
	'allowed sites only. Search for each by name. Do not invent URLs or pages. Cite the page you found ' +
	'for each reference. If you cannot find a reference, say so for that one and move on.';

/** The references in a result that can be looked up, each with the id its link will be found by. */
export function referencesOf(result: SpotterResult): Reference[] {
	const references: Reference[] = [];

	result.precedents.forEach((precedent, index) =>
		references.push({ key: caseKey(index), kind: 'case', name: precedent.name, year: precedent.year })
	);

	result.acts.forEach((entry, actIndex) => {
		references.push({ key: actKey(actIndex), kind: 'statute', name: entry.act });
		entry.sections.slice(0, MAX_SECTIONS_PER_ACT).forEach((section, sectionIndex) =>
			references.push({
				key: sectionKey(actIndex, sectionIndex),
				kind: 'section',
				name: `${section} ${entry.act}`
			})
		);
	});

	return references;
}

function describe(reference: Reference): string {
	if (reference.kind === 'case') return `Case: ${reference.name}${reference.year ? ` (${reference.year})` : ''}`;
	if (reference.kind === 'statute') return `Statute: ${reference.name}`;
	return `Provision: ${reference.name}`;
}

/** Pulls the cited pages out of a Responses API reply. */
export function citationsOf(payload: any): Citation[] {
	const citations: Citation[] = [];
	for (const item of Array.isArray(payload?.output) ? payload.output : []) {
		if (item?.type !== 'message') continue;
		for (const part of Array.isArray(item.content) ? item.content : []) {
			for (const note of Array.isArray(part?.annotations) ? part.annotations : []) {
				if (note?.type === 'url_citation' && typeof note.url === 'string') {
					citations.push({ url: note.url, title: typeof note.title === 'string' ? note.title : '' });
				}
			}
		}
	}
	return citations;
}

/**
 * Looks the result's references up with OpenAI's web search, restricted to legal sites, and keeps
 * only the ones whose page really came back. Never throws: any failure leaves the search links.
 */
export async function verifySources(
	fetchFn: typeof fetch,
	result: SpotterResult,
	cancel: AbortSignal
): Promise<SourceMatch[]> {
	const references = referencesOf(result);
	if (references.length === 0) return [];

	const deadline = new Deadline(SOURCE_TIMEOUT_MS, SOURCE_TIMEOUT_MS, cancel);
	const model = SOURCE_MODEL ?? OPENAI_MODEL;

	try {
		const response = await fetchFn(`${OPENAI_BASE_URL}/responses`, {
			method: 'POST',
			signal: deadline.signal,
			headers: {
				Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model,
				instructions: INSTRUCTIONS,
				input: references.map(describe).join('\n'),
				tools: [
					{
						type: 'web_search',
						filters: { allowed_domains: SOURCE_DOMAINS },
						search_context_size: 'low',
						user_location: { type: 'approximate', country: 'IN' }
					}
				],
				max_tool_calls: SOURCE_MAX_SEARCHES,
				max_output_tokens: 600
			})
		});

		if (!response.ok) {
			console.error(`Source verification failed (${response.status}):`, await response.text());
			return [];
		}

		const payload = await response.json();
		const searches = (Array.isArray(payload?.output) ? payload.output : []).filter(
			(item: { type?: string }) => item?.type === 'web_search_call'
		).length;
		console.log(
			JSON.stringify({
				event: 'llm_usage',
				call: 'sources',
				model,
				promptTokens: payload?.usage?.input_tokens ?? null,
				completionTokens: payload?.usage?.output_tokens ?? null,
				webSearches: searches
			})
		);

		return matchSources(references, citationsOf(payload));
	} catch (error) {
		// A stop or a timeout is expected; anything else is worth a line in the log.
		if (!deadline.timedOut && !cancel.aborted) console.error('Source verification failed:', error);
		return [];
	} finally {
		deadline.dispose();
	}
}
