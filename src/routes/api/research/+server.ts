import { env } from 'cloudflare:workers';
import {
	DEEP_RESEARCH_MAX_SEARCHES,
	DEEP_RESEARCH_MODEL,
	DEEP_RESEARCH_TIMEOUT_MS,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	CLASSIFIER_MAX_TOKENS,
	CLASSIFIER_TIMEOUT_MS
} from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { researchSubjectFor } from '#lib/server/identity.js';
import { quotaInfo, release, reserve } from '#lib/server/quota.js';
import {
	RELEVANCE_PROMPT,
	RESEARCH_DOMAINS,
	RESEARCH_INSTRUCTIONS,
	buildBrief,
	researchInput
} from '#lib/server/research.js';
import type { TextPart } from '#lib/server/research.js';
import { MAX_FACTS } from '#lib/spotter.js';
import type { ResearchEvent } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const MIN_TOPIC = 10;
const MAX_TOPIC = 1000;

const OFF_TOPIC =
	"Deep research digs deeper into the case you're working on, and this topic looks like a different matter. " +
	'Start a new analysis for it, or ask about something that arises from your case.';

async function post(fetchFn: typeof fetch, path: string, body: unknown, signal: AbortSignal) {
	return fetchFn(`${OPENAI_BASE_URL}${path}`, {
		method: 'POST',
		signal,
		headers: {
			Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});
}

/** Whether the topic belongs to the case. A failure counts as related: a good question is not blocked by a slow check. */
async function isRelated(fetchFn: typeof fetch, facts: string, topic: string): Promise<boolean> {
	const deadline = new Deadline(CLASSIFIER_TIMEOUT_MS, CLASSIFIER_TIMEOUT_MS);
	try {
		const response = await post(
			fetchFn,
			'/chat/completions',
			{
				model: OPENAI_MODEL,
				temperature: 0,
				max_tokens: Math.max(CLASSIFIER_MAX_TOKENS, 8),
				messages: [
					{ role: 'system', content: RELEVANCE_PROMPT },
					{ role: 'user', content: `Case:\n${facts}\n\nTopic:\n${topic}` }
				]
			},
			deadline.signal
		);
		if (!response.ok) return true;
		const answer = (await response.json())?.choices?.[0]?.message?.content ?? '';
		return !/^\W*unrelated\b/i.test(answer);
	} catch {
		return true;
	} finally {
		deadline.dispose();
	}
}

/**
 * Deep research on a topic within the user's ongoing case: a brief written with web search over
 * primary legal sources, every sentence tied to the pages it came from. It costs several cents, so
 * it has its own small monthly limit; a topic outside the case, or a run that finds nothing, is free.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json(
			{ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' },
			{ status: 401 }
		);
	}

	let topic = '';
	let facts = '';
	try {
		const body = await request.json();
		topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
		facts = typeof body?.facts === 'string' ? body.facts.trim() : '';
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	if (facts.length < 20) {
		return Response.json({ error: 'Deep research needs a case to work on. Spot the issues first.' }, { status: 400 });
	}
	if (facts.length > MAX_FACTS) {
		return Response.json({ error: 'The case is too long to research.' }, { status: 400 });
	}
	if (topic.length < MIN_TOPIC || topic.length > MAX_TOPIC) {
		return Response.json(
			{ error: `Say what to research, in ${MIN_TOPIC} to ${MAX_TOPIC} characters.` },
			{ status: 400 }
		);
	}
	if (!OPENAI_API_KEY) {
		return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });
	}

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const subject = researchSubjectFor(locals);
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{
				error: `You have used your deep research for this month (${subject.limits.anon}).`,
				code: 'research_limit',
				research: quotaInfo(subject, 0)
			},
			{ status: 429 }
		);
	}

	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;
	let remaining = reservation.remaining;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: ResearchEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			/** Gives the run back: nothing useful was produced. Never throws. */
			const refund = async () => {
				try {
					await release(db, subject, reservation.day);
					remaining += 1;
				} catch (error) {
					console.error('Research quota refund failed:', error);
				}
			};

			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				send({ research: quotaInfo(subject, remaining) });
				send({ stage: 'checking' });

				if (!(await isRelated(fetch, facts, topic))) {
					await refund();
					send({ offTopic: OFF_TOPIC });
					send({ research: quotaInfo(subject, remaining) });
					return;
				}

				send({ stage: 'searching' });
				const model = DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;
				const response = await post(
					fetch,
					'/responses',
					{
						model,
						instructions: RESEARCH_INSTRUCTIONS,
						input: researchInput(facts, topic),
						tools: [
							{
								type: 'web_search',
								filters: { allowed_domains: RESEARCH_DOMAINS },
								search_context_size: 'medium',
								user_location: { type: 'approximate', country: 'IN' }
							}
						],
						max_tool_calls: DEEP_RESEARCH_MAX_SEARCHES,
						max_output_tokens: 3500
					},
					deadline.signal
				);

				if (!response.ok) {
					console.error(`Deep research failed (${response.status}):`, await response.text());
					throw new Error('provider');
				}

				const payload = await response.json();
				const output: any[] = Array.isArray(payload?.output) ? payload.output : [];
				const searches = output.filter((item) => item?.type === 'web_search_call').length;
				console.log(
					JSON.stringify({
						event: 'llm_usage',
						call: 'research',
						model,
						promptTokens: payload?.usage?.input_tokens ?? null,
						completionTokens: payload?.usage?.output_tokens ?? null,
						webSearches: searches
					})
				);

				const parts: TextPart[] = output
					.filter((item) => item?.type === 'message')
					.flatMap((item) => (Array.isArray(item.content) ? item.content : []))
					.filter((part: any) => part?.type === 'output_text' && typeof part.text === 'string')
					.map((part: any) => ({ text: part.text, annotations: Array.isArray(part.annotations) ? part.annotations : [] }));

				const brief = buildBrief(topic, parts, searches);
				if (brief.sources.length === 0 || brief.blocks.length === 0) {
					await refund();
					send({
						error:
							"I couldn't find sources on the official sites for that topic, so there is no brief. It hasn't used any of your deep research. Try narrowing or rewording it."
					});
					send({ research: quotaInfo(subject, remaining) });
					return;
				}

				send({ brief });
				send({ research: quotaInfo(subject, remaining) });
			} catch (error) {
				// A stop keeps its count: the searches were already running.
				if (cancelled) return;
				await refund();
				send({
					error: deadline.timedOut
						? 'The research took too long. It has not used any of your deep research. Please try again.'
						: 'The research could not be completed right now. It has not used any of your deep research.'
				});
				send({ research: quotaInfo(subject, remaining) });
				if (!deadline.timedOut) console.error('Deep research failed:', error);
			} finally {
				deadline.dispose();
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			upstream.abort();
			console.log(JSON.stringify({ event: 'research_cancelled' }));
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-cache, no-transform'
		}
	});
};
