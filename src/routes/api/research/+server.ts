import { env } from 'cloudflare:workers';
import {
	DEEP_RESEARCH_MAX_SEARCHES,
	DEEP_RESEARCH_MODEL,
	DEEP_RESEARCH_PDF_MAX_BYTES,
	DEEP_RESEARCH_READ_CHARS,
	DEEP_RESEARCH_REASONING_EFFORT,
	DEEP_RESEARCH_READ_SOURCES,
	DEEP_RESEARCH_TIMEOUT_MS,
	DEEP_RESEARCH_WRITE_MAX_TOKENS,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	CLASSIFIER_MAX_TOKENS,
	CLASSIFIER_TIMEOUT_MS
} from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { selectExcerpts } from '#lib/server/excerpt.js';
import { isPdfUrl, pickSources } from '#lib/server/ground.js';
import { researchSubjectFor, tierOf, writeModelFor } from '#lib/server/identity.js';
import { checkUrl, fetchPage } from '#lib/server/page.js';
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
import { REPORT_SCHEMA, WRITER_INSTRUCTIONS, buildReport, parseDraft, reportTally, writerInput } from '#lib/server/writer.js';
import type { SourceText } from '#lib/server/writer.js';
import type { ResearchBrief, ResearchEvent } from '#lib/spotter.js';
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

/** At most this many PDFs go to the model by address; each is large. */
const MAX_PDFS = 2;

/** Reasoning models take a reasoning effort; the others reject the field. */
const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);

/** The size of a PDF in bytes, or null when the site does not say. */
async function pdfSize(fetchFn: typeof fetch, url: string, signal: AbortSignal): Promise<number | null> {
	const check = checkUrl(url, RESEARCH_DOMAINS, { allowLocal: import.meta.env.DEV });
	if (!check.ok) return null;
	try {
		const head = await fetchFn(check.url, { method: 'HEAD', signal, redirect: 'follow' });
		const length = Number(head.headers.get('content-length'));
		return head.ok && Number.isFinite(length) && length > 0 ? length : null;
	} catch {
		return null;
	}
}

/**
 * Writes the report from the pages themselves. The cited pages are fetched here; a long judgment is
 * cut down to its most relevant paragraphs, not at its end. A PDF is handed to the writer by address
 * when it is small enough. The writer returns statements with quotes, and every quote is looked for
 * in the page, so a statement the page does not contain never reaches the report. Any failure leaves
 * the first brief as it was: a brief that was not written up is still a brief.
 */
async function writeReport(
	fetchFn: typeof fetch,
	brief: ResearchBrief,
	facts: string,
	topic: string,
	model: string,
	signal: AbortSignal,
	stage: (stage: 'reading' | 'writing') => void
): Promise<ResearchBrief> {
	const picked = pickSources(brief, DEEP_RESEARCH_READ_SOURCES);
	if (picked.length === 0) return brief;
	stage('reading');

	const leads = brief.blocks
		.flatMap((block) => (block.kind === 'paragraph' ? block.sentences.map((sentence) => sentence.text) : []))
		.join(' ')
		.slice(0, 3000);
	const query = `${topic} ${leads}`;

	const pages = new Map<number, string>();
	const cut = new Map<number, boolean>();
	const texts: SourceText[] = [];
	const pdfs: typeof picked = [];

	await Promise.all(
		picked.map(async (source) => {
			if (isPdfUrl(source.url)) {
				const size = await pdfSize(fetchFn, source.url, signal);
				if (size !== null && size <= DEEP_RESEARCH_PDF_MAX_BYTES && pdfs.length < MAX_PDFS) pdfs.push(source);
				return;
			}
			try {
				const page = await fetchPage(fetchFn, source.url, {
					domains: RESEARCH_DOMAINS,
					maxChars: 5_000_000,
					signal,
					allowLocal: import.meta.env.DEV
				});
				const excerpt = selectExcerpts(page.text, query, DEEP_RESEARCH_READ_CHARS);
				pages.set(source.n, page.text);
				cut.set(source.n, excerpt.cut);
				texts.push({ n: source.n, host: source.host, title: source.title, text: excerpt.text, cut: excerpt.cut });
			} catch {
				// A page that cannot be read is simply not used.
			}
		})
	);
	if (texts.length === 0 && pdfs.length === 0) return brief;
	texts.sort((a, b) => a.n - b.n);

	stage('writing');
	const input = writerInput(facts, topic, leads, texts);
	const ask = (withPdfs: typeof pdfs) => {
		const content: unknown[] = [];
		for (const pdf of withPdfs) {
			content.push({ type: 'input_text', text: `The next file is SOURCE [${pdf.n}] ${pdf.title} (${pdf.host}).` });
			content.push({ type: 'input_file', file_url: pdf.url });
		}
		content.push({ type: 'input_text', text: input });
		return post(
			fetchFn,
			'/responses',
			{
				model,
				instructions: WRITER_INSTRUCTIONS,
				input: [{ role: 'user', content }],
				text: { format: { type: 'json_schema', name: 'research_report', strict: true, schema: REPORT_SCHEMA } },
				max_output_tokens: DEEP_RESEARCH_WRITE_MAX_TOKENS,
				...(isReasoningModel(model) && { reasoning: { effort: DEEP_RESEARCH_REASONING_EFFORT } })
			},
			signal
		);
	};

	let response = await ask(pdfs);
	let usedPdfs = pdfs;
	if (!response.ok && pdfs.length > 0) {
		// A PDF the provider could not download should not cost the report from the pages we hold.
		console.error(`Reading PDFs failed (${response.status}); writing from pages only.`);
		usedPdfs = [];
		response = await ask([]);
	}
	if (!response.ok) {
		console.error(`Writing the report failed (${response.status}):`, await response.text());
		return brief;
	}

	const payload = await response.json();
	console.log(
		JSON.stringify({
			event: 'llm_usage',
			call: 'research_write',
			model,
			promptTokens: payload?.usage?.input_tokens ?? null,
			completionTokens: payload?.usage?.output_tokens ?? null,
			reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens ?? null,
			status: payload?.status ?? null,
			pages: texts.length,
			excerpted: [...cut.values()].filter(Boolean).length,
			pdfs: usedPdfs.length
		})
	);

	const reply = (Array.isArray(payload?.output) ? payload.output : [])
		.filter((item: any) => item?.type === 'message')
		.flatMap((item: any) => (Array.isArray(item.content) ? item.content : []))
		.map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
		.join('');
	const draft = parseDraft(reply);
	if (!draft) {
		console.error(`The writer's reply could not be read (status ${payload?.status}).`);
		return brief;
	}

	const pdfNumbers = new Set(usedPdfs.map((pdf) => pdf.n));
	const report = buildReport(draft, topic, { pages, pdfs: pdfNumbers });
	if (reportTally(report).lines === 0) return brief;

	return {
		...brief,
		report,
		sources: brief.sources.map((source) =>
			pages.has(source.n)
				? { ...source, read: 'text' as const, ...(cut.get(source.n) && { truncated: true }) }
				: pdfNumbers.has(source.n)
					? { ...source, read: 'pdf' as const }
					: source
		)
	};
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

				let finished = brief;
				if (DEEP_RESEARCH_READ_SOURCES > 0) {
					try {
						const writer = writeModelFor(tierOf(locals)) ?? model;
						finished = await writeReport(fetch, brief, facts, topic, writer, deadline.signal, (next) => send({ stage: next }));
					} catch (error) {
						if (cancelled) return;
						console.error('Writing the report failed:', error);
					}
				}

				send({ brief: finished });
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
