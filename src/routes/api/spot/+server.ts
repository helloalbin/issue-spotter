import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$app/env/private';
import type { RequestHandler } from './$types';

type SpotterResponse = {
	issues: string[];
	doctrines: string[];
	precedents: string[];
};

const SYSTEM_PROMPT =
	'You are a legal issue-spotting assistant for law students. Return concise, educational analysis only. Output JSON with keys: issues, doctrines, precedents. Each key must map to an array of short bullet-ready strings.';

function normalizeList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 8);
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let facts = '';

	try {
		const body = await request.json();
		facts = typeof body?.facts === 'string' ? body.facts : '';
	} catch {
		return json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	if (facts.trim().length < 20) {
		return json({ error: 'Please provide at least 20 characters of factual summary.' }, { status: 400 });
	}
	if (facts.length > 12000) {
		return json({ error: 'Please keep the factual summary under 12,000 characters.' }, { status: 400 });
	}

	const openAiApiKey = OPENAI_API_KEY;
	if (!openAiApiKey) {
		return json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });
	}

	const baseUrl = OPENAI_BASE_URL;
	const model = OPENAI_MODEL;

	let response: Response;

	try {
		response = await fetch(`${baseUrl}/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: ['Bearer', openAiApiKey].join(' '),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model,
				temperature: 0.2,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{ role: 'user', content: facts.trim() }
				]
			})
		});
	} catch {
		return json({ error: 'Unable to reach the model provider.' }, { status: 502 });
	}

	if (!response.ok) {
		const details = await response.text();
		return json({ error: `Analysis request failed (${response.status}).`, details }, { status: 502 });
	}

	const payload = await response.json();
	const rawContent = payload?.choices?.[0]?.message?.content;

	if (typeof rawContent !== 'string') {
		return json({ error: 'Model returned an empty response.' }, { status: 502 });
	}

	let parsed: Partial<SpotterResponse> = {};

	try {
		parsed = JSON.parse(rawContent);
	} catch {
		return json({ error: 'Model response was not valid JSON.' }, { status: 502 });
	}

	const result: SpotterResponse = {
		issues: normalizeList(parsed.issues),
		doctrines: normalizeList(parsed.doctrines),
		precedents: normalizeList(parsed.precedents)
	};

	return json(result);
};
