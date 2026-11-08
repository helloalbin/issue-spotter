import { env } from 'cloudflare:workers';
import { DEEP_RESEARCH_MODEL, DEEP_RESEARCH_TIMEOUT_MS, OPENAI_MODEL } from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { attestReport } from '#lib/server/attest-run.js';
import { signingKey } from '#lib/server/grants.js';
import { consumeGrant } from '#lib/server/grants.js';
import { grantSubject, tierOf, writeModelFor } from '#lib/server/identity.js';
import { intakeSources, sourceOf } from '#lib/server/intake.js';
import { post, readAnswer, writerBody } from '#lib/server/openai.js';
import { readGrant } from '#lib/server/token.js';
import { REPORT_SCHEMA, WRITER_INSTRUCTIONS, buildReport, parseDraft, reportTally, writerInput } from '#lib/server/writer.js';
import { MAX_FACTS } from '#lib/spotter.js';
import type { ResearchEvent } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

/**
 * The second half of a deep research run when pages are read in the browser. The browser sends the
 * paragraphs it chose from each page; the report is written from those, and every quote is checked
 * against them. Quotes from a PDF are checked again by a model reading the official PDF itself.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json({ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' }, { status: 401 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}
	const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
	const facts = typeof body?.facts === 'string' ? body.facts.trim() : '';
	const leads = typeof body?.leads === 'string' ? body.leads.slice(0, 3000) : '';
	if (facts.length < 20 || facts.length > MAX_FACTS || topic.length < 10 || topic.length > 1000) {
		return Response.json({ error: 'The research could not be completed. Please start again.' }, { status: 400 });
	}

	const key = signingKey();
	const grant = typeof body?.token === 'string' ? await readGrant(body.token, key) : null;
	if (!grant || grant.kind !== 'research' || grant.who !== grantSubject(locals)) {
		return Response.json({ error: 'This request has expired. Please start the research again.', code: 'grant_invalid' }, { status: 403 });
	}
	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });
	if (!(await consumeGrant(db, grant))) {
		return Response.json({ error: 'This request has already been used.', code: 'grant_invalid' }, { status: 403 });
	}

	const intake = await intakeSources(body?.sources, grant, key);
	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: ResearchEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				if (intake.length === 0) {
					send({ error: 'None of the pages could be read, so there is no report.' });
					return;
				}
				send({ stage: 'writing' });

				const model = writeModelFor(tierOf(locals)) ?? DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;
				const texts = intake.map((source) => ({ n: source.n, host: source.host, title: source.title, text: source.excerpt, cut: source.cut }));
				const response = await post(fetch, '/responses', writerBody(model, WRITER_INSTRUCTIONS, [{ type: 'input_text', text: writerInput(facts, topic, leads, texts) }], 'research_report', REPORT_SCHEMA), deadline.signal);
				if (!response.ok) {
					console.error(`Writing the report failed (${response.status}):`, await response.text());
					send({ error: 'The report could not be written right now.' });
					return;
				}
				const payload = await response.json();
				console.log(JSON.stringify({ event: 'llm_usage', call: 'research_write', model, route: 'browser', promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens ?? null, status: payload?.status ?? null, pages: intake.length, pdfs: intake.filter((s) => s.kind === 'pdf').length }));

				const draft = parseDraft(readAnswer(payload).text);
				if (!draft) {
					send({ error: 'The report could not be read back.' });
					return;
				}

				// What the browser sent is all there is to check against: the writer saw nothing else.
				const excerpts = new Map(intake.map((source) => [source.n, source.excerpt]));
				let report = buildReport(draft, topic, { pages: excerpts, pdfs: new Set(), excerpts });
				if (reportTally(report).lines === 0) {
					send({ error: 'Nothing in the report could be confirmed against the pages.' });
					return;
				}

				report = await attestReport(fetch, report, new Map(intake.filter((s) => s.kind === 'pdf').map((s) => [s.n, s.url])), deadline.signal);
				report = { ...report, readIn: 'browser' };
				if (reportTally(report).lines === 0) {
					send({ error: 'Nothing in the report could be confirmed against the official PDFs.' });
					return;
				}

				send({ brief: { topic, blocks: [], sources: intake.map(sourceOf), searches: Number(body?.searches) > 0 ? Math.min(Number(body.searches), 50) : 0, report } });
			} catch (error) {
				if (cancelled) return;
				console.error('Writing the research report failed:', error);
				send({ error: deadline.timedOut ? 'The report took too long to write.' : 'The report could not be written right now.' });
			} finally {
				deadline.dispose();
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			upstream.abort();
		}
	});

	return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform' } });
};
