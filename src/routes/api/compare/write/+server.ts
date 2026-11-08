import { env } from 'cloudflare:workers';
import { DEEP_RESEARCH_MODEL, DEEP_RESEARCH_TIMEOUT_MS, OPENAI_MODEL } from '$app/env/private';
import { COMPARE_TEMPLATE } from '#lib/report.js';
import { attestReport } from '#lib/server/attest-run.js';
import { COMPARE_INSTRUCTIONS, compareInput } from '#lib/server/compare.js';
import { Deadline } from '#lib/server/deadline.js';
import { consumeGrant, signingKey } from '#lib/server/grants.js';
import { compareSubjectFor, grantSubject, tierOf, writeModelFor } from '#lib/server/identity.js';
import { intakeSources, sourceOf } from '#lib/server/intake.js';
import { post, readAnswer, writerBody } from '#lib/server/openai.js';
import { quotaInfo, release } from '#lib/server/quota.js';
import { readGrant } from '#lib/server/token.js';
import { COMPARE_SCHEMA, buildReport, parseDraft, reportTally } from '#lib/server/writer.js';
import type { CompareEvent } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

/**
 * The second half of a comparison when pages are read in the browser: the report is written from the
 * paragraphs the browser chose from each judgment, and every quote is checked against them. A
 * comparison that cannot be written is refunded.
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
	const names = (Array.isArray(body?.cases) ? body.cases : []).slice(0, 2).map((entry: any) => (typeof entry?.name === 'string' ? entry.name.trim().slice(0, 200) : ''));
	const leads = typeof body?.leads === 'string' ? body.leads.slice(0, 3000) : '';
	if (names.length !== 2 || names.some((name: string) => !name)) {
		return Response.json({ error: 'The comparison could not be completed. Please start again.' }, { status: 400 });
	}

	const key = signingKey();
	const grant = typeof body?.token === 'string' ? await readGrant(body.token, key) : null;
	if (!grant || grant.kind !== 'compare' || grant.who !== grantSubject(locals)) {
		return Response.json({ error: 'This request has expired. Please start the comparison again.', code: 'grant_invalid' }, { status: 403 });
	}
	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });
	if (!(await consumeGrant(db, grant))) {
		return Response.json({ error: 'This request has already been used.', code: 'grant_invalid' }, { status: 403 });
	}

	const subject = compareSubjectFor(locals);
	const intake = await intakeSources(body?.sources, grant, key);
	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;
	let remaining = 0;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: CompareEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			const fail = async (message: string) => {
				try {
					await release(db, subject, grant.day);
				} catch (error) {
					console.error('Compare quota refund failed:', error);
				}
				send({ error: message });
				send({ compare: quotaInfo(subject, remaining + 1) });
			};
			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				// Both judgments must have been read: a comparison of one is not a comparison.
				if (!intake.some((source) => source.n === 1) || !intake.some((source) => source.n === 2)) {
					return await fail('One of the judgments could not be read. It has not used any of your comparisons.');
				}
				send({ stage: 'writing' });

				const title = `${names[0]} and ${names[1]}`;
				const model = writeModelFor(tierOf(locals)) ?? DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;
				const texts = intake.map((source) => ({ n: source.n, host: source.host, title: source.title, text: source.excerpt, cut: source.cut }));
				const response = await post(fetch, '/responses', writerBody(model, COMPARE_INSTRUCTIONS, [{ type: 'input_text', text: compareInput(title, leads, texts) }], 'case_comparison', COMPARE_SCHEMA), deadline.signal);
				if (!response.ok) {
					console.error(`Writing the comparison failed (${response.status}):`, await response.text());
					return await fail('The comparison could not be written right now. It has not used any of your comparisons.');
				}
				const payload = await response.json();
				console.log(JSON.stringify({ event: 'llm_usage', call: 'compare_write', model, route: 'browser', promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens ?? null, status: payload?.status ?? null, pages: intake.length }));

				const draft = parseDraft(readAnswer(payload).text, COMPARE_TEMPLATE);
				if (!draft) return await fail('The comparison could not be read back. It has not used any of your comparisons.');

				const excerpts = new Map(intake.map((source) => [source.n, source.excerpt]));
				let report = buildReport(draft, title, { pages: excerpts, pdfs: new Set(), excerpts }, undefined, 'compare');
				if (reportTally(report).lines === 0) {
					return await fail('Nothing in the comparison could be confirmed against the pages. It has not used any of your comparisons.');
				}
				report = await attestReport(fetch, report, new Map(intake.filter((s) => s.kind === 'pdf').map((s) => [s.n, s.url])), deadline.signal);
				report = { ...report, readIn: 'browser' };
				if (reportTally(report).lines === 0) {
					return await fail('Nothing in the comparison could be confirmed against the official PDFs. It has not used any of your comparisons.');
				}

				send({ brief: { topic: title, blocks: [], sources: intake.map(sourceOf), searches: Number(body?.searches) > 0 ? Math.min(Number(body.searches), 50) : 0, report } });
			} catch (error) {
				if (cancelled) return;
				await fail(deadline.timedOut ? 'The comparison took too long. It has not used any of your comparisons. Please try again.' : 'The comparison could not be completed right now. It has not used any of your comparisons.');
				if (!deadline.timedOut) console.error('Case comparison failed:', error);
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
