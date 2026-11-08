import { env } from 'cloudflare:workers';
import { DEEP_RESEARCH_MODEL, DEEP_RESEARCH_TIMEOUT_MS, OPENAI_MODEL } from '$app/env/private';
import { pageIsCase } from '#lib/server/compare.js';
import { Deadline } from '#lib/server/deadline.js';
import { attestReport } from '#lib/server/attest-run.js';
import { consumeGrant, signingKey } from '#lib/server/grants.js';
import { grantSubject, tierOf, verifySubjectFor, writeModelFor } from '#lib/server/identity.js';
import { intakeSources, sourceOf } from '#lib/server/intake.js';
import { quotaInfo, release } from '#lib/server/quota.js';
import { closestPassage, quoteSupported } from '#lib/server/ground.js';
import { readGrant } from '#lib/server/token.js';
import { buildVerifyReport, normalizeItems } from '#lib/server/verify-cites.js';
import type { Located } from '#lib/server/verify-cites.js';
import { checkSupport } from '#lib/server/verify-run.js';
import type { VerifyEvent } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

/**
 * The second half of a citation check when pages are read in the browser. The details are compared
 * from what the browser read (the title, the opening, whether the reference is anywhere in the page);
 * support is checked by a model against the chosen paragraphs, with every quote checked against them;
 * quotes from a PDF are checked again by a model reading the official PDF itself.
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

	const key = signingKey();
	const grant = typeof body?.token === 'string' ? await readGrant(body.token, key) : null;
	if (!grant || grant.kind !== 'verify' || grant.who !== grantSubject(locals)) {
		return Response.json({ error: 'This request has expired. Please check the citations again.', code: 'grant_invalid' }, { status: 403 });
	}
	const items = normalizeItems(body?.context?.items);
	if (items.length === 0) return Response.json({ error: 'The check could not be completed. Please start again.' }, { status: 400 });

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });
	if (!(await consumeGrant(db, grant))) {
		return Response.json({ error: 'This request has already been used.', code: 'grant_invalid' }, { status: 403 });
	}

	const subject = verifySubjectFor(locals);
	const intake = await intakeSources(body?.sources, grant, key);
	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: VerifyEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				if (intake.length === 0) {
					// Nothing could be read, which is not the same as nothing being found: give the unit back.
					await release(db, subject, grant.day).catch((error) => console.error('Verify quota refund failed:', error));
					send({ error: 'The pages could not be read in your browser, so nothing was checked. It has not used any of your checks.' });
					send({ verify: quotaInfo(subject, 1) });
					return;
				}
				send({ stage: 'checking' });
				const itemSource: Record<string, unknown> = body?.context?.itemSource && typeof body.context.itemSource === 'object' ? body.context.itemSource : {};

				// What the browser read of each page, as the details and identity checks need it.
				const located = new Map<number, Located>();
				for (const item of items) {
					const n = Number(itemSource[item.id]);
					const read = intake.find((source) => source.n === n);
					if (!read) continue;
					const reporterFound = item.reporter ? read.needles[item.reporter] === true : undefined;
					const verified = item.name ? pageIsCase(item.name, read.title, read.opening) : reporterFound === true;
					located.set(item.id, { n: read.n, title: read.title, page: read.excerpt, excerpt: read.excerpt, cut: read.cut, verified, opening: read.opening, reporterFound });
				}

				const rows = items.filter((item) => item.proposition && located.get(item.id)?.verified).map((item) => ({ item, n: located.get(item.id)!.n }));
				const used = new Map<number, { n: number; title: string; host: string; text: string; cut: boolean }>();
				for (const { n } of rows) {
					const read = intake.find((source) => source.n === n)!;
					if (!used.has(n)) used.set(n, { n, title: read.title, host: read.host, text: read.excerpt, cut: read.cut });
				}
				const ran = await checkSupport(fetch, writeModelFor(tierOf(locals)) ?? DEEP_RESEARCH_MODEL ?? OPENAI_MODEL, rows, [...used.values()].sort((a, b) => a.n - b.n), deadline.signal);

				if (import.meta.env.DEV) {
					for (const [id, verdict] of ran.support) {
						const read = intake.find((source) => source.n === Number(itemSource[id]));
						console.log(JSON.stringify({ event: 'verify_support_debug', id, verdict: verdict.verdict, quote: verdict.quote.slice(0, 500), excerptHasStart: read ? read.excerpt.includes("directed to furnish the grounds of arrest in writing as a matter of course") : null, onExcerpt: read ? quoteSupported(verdict.quote, read.excerpt) : null, snapped: read ? !!closestPassage(verdict.quote, read.excerpt) : null }));
					}
				}
				let report = buildVerifyReport(items, located, ran.support, { supportChecked: ran.checked });
				report = await attestReport(fetch, report, new Map(intake.filter((s) => s.kind === 'pdf').map((s) => [s.n, s.url])), deadline.signal);
				report = { ...report, readIn: 'browser' };
				send({ brief: { topic: 'Citation check', blocks: [], sources: intake.map(sourceOf), searches: Number(body?.context?.searches) > 0 ? Math.min(Number(body.context.searches), 50) : 0, report } });
			} catch (error) {
				if (cancelled) return;
				try {
					await release(db, subject, grant.day);
				} catch (refundError) {
					console.error('Verify quota refund failed:', refundError);
				}
				send({ error: deadline.timedOut ? 'The check took too long. It has not used any of your checks. Please try again.' : 'The check could not be completed right now. It has not used any of your checks.' });
				send({ verify: quotaInfo(subject, 1) });
				if (!deadline.timedOut) console.error('Citation check failed:', error);
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
