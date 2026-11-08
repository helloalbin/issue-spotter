import { env } from 'cloudflare:workers';
import {
	ANALYSIS_MAX_TOKENS,
	ANALYSIS_TOTAL_TIMEOUT_MS,
	CLASSIFIER_MAX_TOKENS,
	CLASSIFIER_TIMEOUT_MS,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL,
	PROVIDER_IDLE_TIMEOUT_MS,
	QUOTA_REJECTION_MULTIPLIER,
	SOURCE_VERIFICATION
} from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { subjectFor } from '#lib/server/identity.js';
import {
	analysisTokens,
	buildSystemPrompt,
	buildUserText,
	parseContext,
	parseSkills
} from '#lib/server/prompt.js';
import { SectionParser } from '#lib/server/section-stream.js';
import { verifySources } from '#lib/server/sources.js';
import { quotaInfo, rejectionSubject, release, reserve } from '#lib/server/quota.js';
import { MAX_FACTS, MIN_FACTS, looksLegal } from '#lib/spotter.js';
import type { ActiveSkill } from '#lib/skills.js';
import type {
	ActReference,
	CounterArgument,
	Precedent,
	SpotEvent,
	SpotItem,
	SpotSection,
	SpotterResult
} from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const CLASSIFIER_PROMPT =
	'Decide whether the user message describes a factual scenario that could raise legal issues ' +
	'(a real or hypothetical case fact pattern). Answer with exactly one word: yes or no.';

function normalizeList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string')
		.map((item) => item.trim())
		.filter(Boolean)
		.slice(0, 8);
}

function normalizePrecedents(value: unknown): Precedent[] {
	if (!Array.isArray(value)) return [];
	const precedents: Precedent[] = [];
	for (const item of value) {
		if (typeof item === 'string') {
			const name = item.trim();
			if (name) precedents.push({ name });
		} else if (item && typeof item === 'object') {
			const record = item as Record<string, unknown>;
			const name = ['case', 'name', 'title']
				.map((key) => record[key])
				.find((field): field is string => typeof field === 'string' && field.trim().length > 0);
			if (!name) continue;
			const year = String(record.year ?? '').trim();
			precedents.push(/^\d{4}$/.test(year) ? { name: name.trim(), year } : { name: name.trim() });
		}
		if (precedents.length >= 8) break;
	}
	return precedents;
}

function normalizeCounterArguments(value: unknown): CounterArgument[] {
	if (!Array.isArray(value)) return [];
	const items: CounterArgument[] = [];
	for (const item of value) {
		if (item && typeof item === 'object') {
			const record = item as Record<string, unknown>;
			const issue = typeof record.issue === 'string' ? record.issue.trim() : '';
			const argument = typeof record.argument === 'string' ? record.argument.trim() : '';
			if (issue && argument) items.push({ issue, argument });
		}
		if (items.length >= 6) break;
	}
	return items;
}

function normalizeJurisdiction(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim().slice(0, 60) : undefined;
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

/** What went wrong, in a few words, for the development console and error text. Never shown in production. */
function describeFailure(error: unknown): string {
	type Cause = { code?: string; message?: string; address?: string; port?: number; errors?: Cause[] };
	const cause = (error as { cause?: Cause })?.cause;
	// A failed connect to several addresses arrives as a list; the first is enough to go on.
	const detail = cause?.errors?.[0] ?? cause;
	const where = detail?.address ? ` ${detail.address}${detail.port ? `:${detail.port}` : ''}` : '';
	return `${detail?.code ?? detail?.message ?? (error as Error)?.message ?? 'unknown error'}${where}`;
}

const TIMEOUT_MESSAGE = 'The model provider took too long to respond. Please try again.';

/**
 * Runs one provider call under a deadline. A stall or an overrun becomes a SpotError (so the
 * search is refunded and the user sees a clear message); the user's own abort passes through.
 */
async function underDeadline<T>(
	label: string,
	deadline: Deadline,
	run: () => Promise<T>
): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (deadline.timedOut) {
			console.error(`Model provider ${label} call timed out (${deadline.reason}).`);
			throw new SpotError(TIMEOUT_MESSAGE);
		}
		throw error;
	} finally {
		deadline.dispose();
	}
}

type ChatOptions = {
	label: 'classifier' | 'analysis';
	system: string;
	user: string;
	maxTokens: number;
	temperature: number;
	jsonMode?: boolean;
};

/** Token counts as reported by the provider. Null when the provider omits them. */
type Usage = { promptTokens: number | null; completionTokens: number | null };

type ChatResult = { content: string; usage: Usage };

async function chat(fetchFn: typeof fetch, options: ChatOptions): Promise<ChatResult> {
	const deadline = new Deadline(CLASSIFIER_TIMEOUT_MS, CLASSIFIER_TIMEOUT_MS);
	return underDeadline(options.label, deadline, () => chatOnce(fetchFn, options, deadline.signal));
}

async function chatOnce(
	fetchFn: typeof fetch,
	options: ChatOptions,
	signal: AbortSignal
): Promise<ChatResult> {
	let response: Response;

	try {
		response = await fetchFn(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			signal,
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
		if (signal.aborted) throw error;
		console.error('Model provider request failed:', error, (error as Error)?.cause);
		throw new SpotError(
			import.meta.env.DEV
				? `Unable to reach the model provider (${describeFailure(error)}).`
				: 'Unable to reach the model provider.'
		);
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

	const usage = readUsage(payload);
	console.log(JSON.stringify({ event: 'llm_usage', call: options.label, model: OPENAI_MODEL, ...usage }));

	return { content, usage };
}

function readUsage(payload: any): Usage {
	return {
		promptTokens: typeof payload?.usage?.prompt_tokens === 'number' ? payload.usage.prompt_tokens : null,
		completionTokens:
			typeof payload?.usage?.completion_tokens === 'number' ? payload.usage.completion_tokens : null
	};
}

/**
 * Like `chat`, but asks the provider to stream and hands each piece of text to `onText` as it
 * arrives. Aborting `signal` stops the provider generating, so a cancelled search stops costing.
 * A provider that ignores `stream` and answers in one JSON body still works.
 */
async function chatStream(
	fetchFn: typeof fetch,
	options: ChatOptions,
	cancel: AbortSignal,
	onText: (text: string) => void
): Promise<ChatResult> {
	const deadline = new Deadline(PROVIDER_IDLE_TIMEOUT_MS, ANALYSIS_TOTAL_TIMEOUT_MS, cancel);
	return underDeadline(options.label, deadline, () =>
		chatStreamOnce(fetchFn, options, deadline, onText)
	);
}

async function chatStreamOnce(
	fetchFn: typeof fetch,
	options: ChatOptions,
	deadline: Deadline,
	onText: (text: string) => void
): Promise<ChatResult> {
	const signal = deadline.signal;
	let response: Response;

	try {
		response = await fetchFn(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			signal,
			headers: {
				Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				temperature: options.temperature,
				max_tokens: options.maxTokens,
				stream: true,
				stream_options: { include_usage: true },
				...(options.jsonMode && { response_format: { type: 'json_object' } }),
				messages: [
					{ role: 'system', content: options.system },
					{ role: 'user', content: options.user }
				]
			})
		});
	} catch (error) {
		if (signal.aborted) throw error;
		console.error('Model provider request failed:', error, (error as Error)?.cause);
		throw new SpotError(
			import.meta.env.DEV
				? `Unable to reach the model provider (${describeFailure(error)}).`
				: 'Unable to reach the model provider.'
		);
	}

	if (!response.ok) {
		console.error(`Model provider error (${response.status}):`, await response.text());
		throw new SpotError(`Analysis request failed (${response.status}).`);
	}

	// The response headers arrived, so the provider is alive; each chunk below keeps it that way.
	deadline.touch();

	let content = '';
	let usage: Usage = { promptTokens: null, completionTokens: null };

	if (!response.body || !(response.headers.get('content-type') ?? '').includes('text/event-stream')) {
		const payload = await response.json();
		const text = payload?.choices?.[0]?.message?.content;
		if (typeof text !== 'string') throw new SpotError('Model returned an empty response.');
		content = text;
		usage = readUsage(payload);
		onText(text);
	} else {
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		while (true) {
			const { done, value } = await reader.read();
			deadline.touch();
			buffer += decoder.decode(value, { stream: !done });
			const lines = buffer.split('\n');
			buffer = done ? '' : (lines.pop() ?? '');

			for (const line of lines) {
				if (!line.startsWith('data:')) continue;
				const data = line.slice(5).trim();
				if (!data || data === '[DONE]') continue;

				let payload: any;
				try {
					payload = JSON.parse(data);
				} catch {
					continue;
				}

				const delta = payload?.choices?.[0]?.delta?.content;
				if (typeof delta === 'string' && delta) {
					content += delta;
					onText(delta);
				}
				if (payload?.usage) usage = readUsage(payload);
			}

			if (done) break;
		}

		if (!content) throw new SpotError('Model returned an empty response.');
	}

	console.log(JSON.stringify({ event: 'llm_usage', call: options.label, model: OPENAI_MODEL, ...usage }));
	return { content, usage };
}

/** Fails open: if the classifier errors or answers unclearly, the analysis proceeds. */
async function isLegalFactPattern(fetchFn: typeof fetch, facts: string): Promise<boolean> {
	try {
		const { content: answer } = await chat(fetchFn, {
			label: 'classifier',
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

const MAX_ITEMS: Record<SpotSection, number> = {
	summary: 5,
	issues: 8,
	doctrines: 8,
	precedents: 8,
	acts: 6,
	counterArguments: 6
};

/**
 * Streams the analysis: `emit` gets each item and each finished section while the model is still
 * writing, and the returned result is the whole reply, parsed and normalized once it ends.
 */
async function analyze(
	fetchFn: typeof fetch,
	request: { system: string; user: string; maxTokens: number; skills: ActiveSkill[] },
	signal: AbortSignal,
	emit: (event: SpotEvent) => void
): Promise<SpotterResult> {
	const parser = new SectionParser();
	const counts: Record<SpotSection, number> = {
		summary: 0,
		issues: 0,
		doctrines: 0,
		precedents: 0,
		acts: 0,
		counterArguments: 0
	};

	const { content } = await chatStream(
		fetchFn,
		{
			label: 'analysis',
			system: request.system,
			user: request.user,
			maxTokens: request.maxTokens,
			temperature: 0.2,
			jsonMode: true
		},
		signal,
		(text) => {
			for (const piece of parser.push(text)) {
				if ('done' in piece) {
					emit({ sectionDone: piece.done });
					continue;
				}

				const { section, value } = piece.item;
				if (counts[section] >= MAX_ITEMS[section]) continue;

				const entry =
					section === 'acts'
						? normalizeActs([value])[0]
						: section === 'precedents'
							? normalizePrecedents([value])[0]
							: section === 'counterArguments'
								? normalizeCounterArguments([value])[0]
								: normalizeList([value])[0];
				if (!entry) continue;

				counts[section] += 1;
				emit({ item: { section, value: entry } as SpotItem });
			}
		}
	);

	let parsed: Partial<Record<keyof SpotterResult, unknown>>;

	try {
		parsed = JSON.parse(content);
	} catch {
		throw new SpotError('Model response was not valid JSON.');
	}

	return {
		...(request.skills.includes('summarize') && { summary: normalizeList(parsed.summary).slice(0, 5) }),
		jurisdiction: normalizeJurisdiction(parsed.jurisdiction),
		issues: normalizeList(parsed.issues),
		doctrines: normalizeList(parsed.doctrines),
		precedents: normalizePrecedents(parsed.precedents),
		acts: normalizeActs(parsed.acts),
		...(request.skills.includes('counter-arguments') && {
			counterArguments: normalizeCounterArguments(parsed.counterArguments)
		})
	};
}

export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json(
			{ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' },
			{ status: 401 }
		);
	}

	let facts = '';
	let rawSkills: unknown;
	let rawContext: unknown;

	try {
		const body = await request.json();
		facts = typeof body?.facts === 'string' ? body.facts : '';
		rawSkills = body?.skills;
		rawContext = body?.context;
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
	const parsedContext = parseContext(rawContext, { allowLocal: import.meta.env.DEV });
	if (!parsedContext.ok) {
		return Response.json({ error: parsedContext.error }, { status: 400 });
	}
	if (!OPENAI_API_KEY) {
		return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });
	}
	const skills = parseSkills(rawSkills);
	const context = parsedContext.context;

	const db = env.DB;
	if (!db) {
		return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });
	}

	const subject = subjectFor(locals);
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{
				error: `You have used today's ${subject.limits.anon} searches.`,
				code: 'quota_exceeded',
				quota: quotaInfo(subject, 0)
			},
			{ status: 429 }
		);
	}

	const trimmed = facts.trim();
	const analysisRequest = {
		system: buildSystemPrompt(skills, context.length > 0),
		user: buildUserText(trimmed, context),
		maxTokens: analysisTokens(ANALYSIS_MAX_TOKENS, skills),
		skills
	};
	const encoder = new TextEncoder();
	let remaining = reservation.remaining;

	/** Gives the search back, e.g. after a provider error. Never throws. */
	const refund = async () => {
		try {
			await release(db, subject, reservation.day);
			remaining += 1;
		} catch (error) {
			console.error('Quota refund failed:', error);
		}
	};

	// Aborting this stops the provider mid-reply, so a search the user cancels stops costing tokens.
	const upstream = new AbortController();
	let cancelled = false;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: SpotEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};

			try {
				send({ quota: quotaInfo(subject, remaining) });

				// Clear legal vocabulary skips the classifier call; anything unsure is checked.
				// An attached legal page shows the case is legal even when the typed text is short, such as
				// "summarize this", so the classifier is skipped then.
				if (context.length === 0 && !looksLegal(trimmed)) {
					send({ stage: 'verifying' });
					if (!(await isLegalFactPattern(fetch, trimmed))) {
						// A rejection is free, up to a cap, so it can't be spammed.
						const rejections = await reserve(
							db,
							rejectionSubject(subject, QUOTA_REJECTION_MULTIPLIER)
						);
						if (rejections.ok) await refund();
						send({ notLegal: true });
						send({ quota: quotaInfo(subject, remaining) });
						return;
					}
				}

				send({ stage: 'analyzing' });
				const startedAt = Date.now();
				const result = await analyze(fetch, analysisRequest, upstream.signal, send);
				send({ meta: { model: OPENAI_MODEL, ms: Date.now() - startedAt } });
				send({ result });

				// Real links for the references, found after the answer is already on screen. Only for
				// Indian law (the sites searched are Indian) and only when switched on for this user.
				const signedIn = subject.ns !== 'search';
				const indian = !result.jurisdiction || /\bindia/i.test(result.jurisdiction);
				if (indian && (SOURCE_VERIFICATION === 'all' || (SOURCE_VERIFICATION === 'signed-in' && signedIn))) {
					send({ stage: 'sourcing' });
					send({ sources: await verifySources(fetch, result, upstream.signal) });
				}
			} catch (error) {
				// A cancelled search keeps its count: the provider already did part of the work.
				if (cancelled) return;
				await refund();
				send({ quota: quotaInfo(subject, remaining) });
				send({
					error: error instanceof SpotError ? error.message : 'Unexpected error while analyzing.'
				});
			} finally {
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			upstream.abort();
			console.log(JSON.stringify({ event: 'search_cancelled' }));
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'application/x-ndjson; charset=utf-8',
			'cache-control': 'no-cache, no-transform'
		}
	});
};
