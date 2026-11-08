import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from '$app/env/private';
import { MAX_FACTS, MIN_FACTS, looksLegal } from '#lib/spotter.js';
import type { ActReference, SpotEvent, SpotterResult } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const CLASSIFIER_MAX_TOKENS = 8;
const ANALYSIS_MAX_TOKENS = 2000;

const CLASSIFIER_PROMPT =
	'Decide whether the user message describes a factual scenario that could raise legal issues ' +
	'(a real or hypothetical case fact pattern). Answer with exactly one word: yes or no.';

const SYSTEM_PROMPT =
	'You are a legal issue-spotting assistant for law students. Return concise, educational analysis only. ' +
	'Output JSON with keys: issues, doctrines, precedents, acts. ' +
	'issues, doctrines and precedents must each map to an array of short bullet-ready strings (max 8 each). ' +
	'acts must map to an array of up to 6 objects, each shaped like ' +
	'{"act": "Name of the Act, Year", "sections": ["Section 73", "Section 74"], "relevance": "one line on why it applies"}. ' +
	'Name the most relevant statute for the facts; use the jurisdiction the facts imply (default to Indian law for Indian-style facts). ' +
	'If no statute squarely applies, return an empty acts array.';

function normalizeList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 8);
}

function normalizeSections(value: unknown): string[] {
	const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;]/) : [];
	return list
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 8);
}

function normalizeActs(value: unknown): ActReference[] {
	if (!Array.isArray(value)) return [];
	const acts: ActReference[] = [];
	for (const item of value) {
		if (typeof item === 'string') {
			const act = item.trim();
			if (act) acts.push({ act, sections: [], relevance: '' });
		} else if (item && typeof item === 'object') {
			const record = item as Record<string, unknown>;
			const act = ['act', 'name', 'title', 'statute']
				.map((key) => record[key])
				.find((field): field is string => typeof field === 'string' && field.trim().length > 0);
			if (!act) continue;
			const relevance =
				typeof record.relevance === 'string'
					? record.relevance.trim()
					: typeof record.note === 'string'
						? record.note.trim()
						: '';
			acts.push({ act: act.trim(), sections: normalizeSections(record.sections), relevance });
		}
		if (acts.length >= 6) break;
	}
	return acts;
}

class SpotError extends Error {}

type ChatOptions = {
	system: string;
	user: string;
	maxTokens: number;
	temperature: number;
	jsonMode?: boolean;
};

async function chat(fetchFn: typeof fetch, options: ChatOptions): Promise<string> {
	let response: Response;

	try {
		response = await fetchFn(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				temperature: options.temperature,
				max_tokens: options.maxTokens,
				...(options.jsonMode && { response_format: { type: 'json_object' } }),
				messages: [
					{ role: 'system', content: options.system },
					{ role: 'user', content: options.user }
				]
			})
		});
	} catch (error) {
		console.error('Model provider request failed:', error, (error as Error)?.cause);
		throw new SpotError('Unable to reach the model provider.');
	}

	if (!response.ok) {
		console.error(`Model provider error (${response.status}):`, await response.text());
		throw new SpotError(`Analysis request failed (${response.status}).`);
	}

	const payload = await response.json();
	const content = payload?.choices?.[0]?.message?.content;

	if (typeof content !== 'string') {
		throw new SpotError('Model returned an empty response.');
	}

	return content;
}

/** Fails open: if the classifier errors or answers unclearly, the analysis proceeds. */
async function isLegalFactPattern(fetchFn: typeof fetch, facts: string): Promise<boolean> {
	try {
		const answer = await chat(fetchFn, {
			system: CLASSIFIER_PROMPT,
			user: facts,
			maxTokens: CLASSIFIER_MAX_TOKENS,
			temperature: 0
		});
		return !/^\W*no\b/i.test(answer);
	} catch {
		return true;
	}
}

async function analyze(fetchFn: typeof fetch, facts: string): Promise<SpotterResult> {
	const content = await chat(fetchFn, {
		system: SYSTEM_PROMPT,
		user: facts,
		maxTokens: ANALYSIS_MAX_TOKENS,
		temperature: 0.2,
		jsonMode: true
	});

	let parsed: Partial<SpotterResult>;

	try {
		parsed = JSON.parse(content);
	} catch {
		throw new SpotError('Model response was not valid JSON.');
	}

	return {
		issues: normalizeList(parsed.issues),
		doctrines: normalizeList(parsed.doctrines),
		precedents: normalizeList(parsed.precedents),
		acts: normalizeActs(parsed.acts)
	};
}

export const POST: RequestHandler = async ({ request, fetch }) => {
	let facts = '';

	try {
		const body = await request.json();
		facts = typeof body?.facts === 'string' ? body.facts : '';
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	if (facts.trim().length < MIN_FACTS) {
		return Response.json(
			{ error: `Please provide at least ${MIN_FACTS} characters of factual summary.` },
			{ status: 400 }
		);
	}
	if (facts.length > MAX_FACTS) {
		return Response.json(
			{ error: `Please keep the factual summary under ${MAX_FACTS.toLocaleString()} characters.` },
			{ status: 400 }
		);
	}
	if (!OPENAI_API_KEY) {
		return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });
	}

	const trimmed = facts.trim();
	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: SpotEvent) =>
				controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

			try {
				// Clear legal vocabulary skips the classifier call; anything unsure is checked.
				if (!looksLegal(trimmed)) {
					send({ stage: 'verifying' });
					if (!(await isLegalFactPattern(fetch, trimmed))) {
						send({ notLegal: true });
						return;
					}
				}

				send({ stage: 'analyzing' });
				send({ result: await analyze(fetch, trimmed) });
			} catch (error) {
				send({
					error: error instanceof SpotError ? error.message : 'Unexpected error while analyzing.'
				});
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-cache, no-transform'
		}
	});
};
