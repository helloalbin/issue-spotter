import { env } from 'cloudflare:workers';
import {
	DEEP_RESEARCH_MAX_SEARCHES,
	DEEP_RESEARCH_MODEL,
	DEEP_RESEARCH_READ_CHARS,
	DEEP_RESEARCH_TIMEOUT_MS,
	OPENAI_API_KEY,
	OPENAI_MODEL,
	SOURCE_READING
} from '$app/env/private';
import { pageIsCase } from '#lib/server/compare.js';
import { Deadline } from '#lib/server/deadline.js';
import { selectExcerpts } from '#lib/server/excerpt.js';
import { isPdfUrl } from '#lib/server/ground.js';
import { issueGrant } from '#lib/server/grants.js';
import { grantSubject, tierOf, verifySubjectFor, writeModelFor } from '#lib/server/identity.js';
import { post, readAnswer } from '#lib/server/openai.js';
import { checkSupport } from '#lib/server/verify-run.js';
import { fetchPage } from '#lib/server/page.js';
import { quotaInfo, release, reserve } from '#lib/server/quota.js';
import { RESEARCH_DOMAINS, cleanUrl, isDocumentUrl, isOfficialHost } from '#lib/server/research.js';
import {
	FIND_INSTRUCTIONS,
	FIND_RETRY_INSTRUCTIONS,
	PARSE_INSTRUCTIONS,
	PARSE_SCHEMA,
	buildVerifyReport,
	checkDetails,
	findInput,
	parseFound,
	parseItems,
	parseSupport,
} from '#lib/server/verify-cites.js';
import type { Located } from '#lib/server/verify-cites.js';
import { hostOf, isAllowedHost } from '#lib/server/verify.js';
import type { ResearchSource, VerifyEvent } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const MIN_INPUT = 20;
const MAX_INPUT = 3000;

/**
 * Checks the cases a student cites at three levels: does the judgment exist, do the details they
 * wrote match it, and does it say what they cite it for. The pasted text is split into citations,
 * a search finds each page, the pages are opened here, and the app compares the details itself.
 * Only the "does it support the point" step is done by a model, and its quote is checked against the
 * page. A check that cannot run is refunded; a citation that is not found is a result, not a failure.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json({ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' }, { status: 401 });
	}

	let input = '';
	try {
		const body = await request.json();
		input = typeof body?.input === 'string' ? body.input.trim() : '';
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}
	if (input.length < MIN_INPUT || input.length > MAX_INPUT) {
		return Response.json({ error: `Paste the citations to check, in ${MIN_INPUT} to ${MAX_INPUT} characters.` }, { status: 400 });
	}
	if (!OPENAI_API_KEY) return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const subject = verifySubjectFor(locals);
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{ error: `You have used your citation checks for this month (${subject.limits.anon}).`, code: 'verify_limit', verify: quotaInfo(subject, 0) },
			{ status: 429 }
		);
	}

	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;
	let remaining = reservation.remaining;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: VerifyEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			const fail = async (message: string) => {
				try {
					await release(db, subject, reservation.day);
					remaining += 1;
				} catch (error) {
					console.error('Verify quota refund failed:', error);
				}
				send({ error: message });
				send({ verify: quotaInfo(subject, remaining) });
			};

			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				send({ verify: quotaInfo(subject, remaining) });
				send({ stage: 'reading' });
				const searchModel = DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;

				// 1. Split the pasted text into citations.
				const parseResponse = await post(
					fetch,
					'/responses',
					{
						model: OPENAI_MODEL,
						instructions: PARSE_INSTRUCTIONS,
						input,
						text: { format: { type: 'json_schema', name: 'citations', strict: true, schema: PARSE_SCHEMA } },
						max_output_tokens: 1500
					},
					deadline.signal
				);
				if (!parseResponse.ok) {
					console.error(`Reading the citations failed (${parseResponse.status}):`, await parseResponse.text());
					return await fail('The citations could not be read right now. It has not used any of your checks.');
				}
				const parsePayload = await parseResponse.json();
				console.log(JSON.stringify({ event: 'llm_usage', call: 'verify_parse', model: OPENAI_MODEL, promptTokens: parsePayload?.usage?.input_tokens ?? null, completionTokens: parsePayload?.usage?.output_tokens ?? null }));
				const items = parseItems(readAnswer(parsePayload).text);
				if (items.length === 0) {
					return await fail('I could not find a case citation in that. Paste the citations, with the point each is cited for if you can. It has not used any of your checks.');
				}

				// 2. Find a page for each.
				send({ stage: 'finding' });
				let searches = 0;
				let urls = new Map<number, string>();
				const findResponse = await post(
					fetch,
					'/responses',
					{
						model: searchModel,
						instructions: FIND_INSTRUCTIONS,
						input: findInput(items),
						tools: [{ type: 'web_search', filters: { allowed_domains: RESEARCH_DOMAINS }, search_context_size: 'low', user_location: { type: 'approximate', country: 'IN' } }],
						max_tool_calls: Math.min(2 * items.length, DEEP_RESEARCH_MAX_SEARCHES),
						max_output_tokens: 1500
					},
					deadline.signal
				);
				if (!findResponse.ok) {
					console.error(`Finding the judgments failed (${findResponse.status}):`, await findResponse.text());
					return await fail('The judgments could not be looked up right now. It has not used any of your checks.');
				}
				const findPayload = await findResponse.json();
				const found = readAnswer(findPayload);
				searches = found.searches;
				urls = parseFound(found.text);
				console.log(JSON.stringify({ event: 'llm_usage', call: 'verify_find', model: searchModel, promptTokens: findPayload?.usage?.input_tokens ?? null, completionTokens: findPayload?.usage?.output_tokens ?? null, webSearches: searches }));

				// A citation the search missed gets one more try by party names alone, so that a real case
				// is not reported as not found because of one unlucky search.
				const missed = items.filter((item) => !urls.has(item.id));
				if (missed.length > 0) {
					try {
						const retry = await post(
							fetch,
							'/responses',
							{
								model: searchModel,
								instructions: FIND_RETRY_INSTRUCTIONS,
								input: findInput(missed),
								tools: [{ type: 'web_search', filters: { allowed_domains: RESEARCH_DOMAINS }, search_context_size: 'low', user_location: { type: 'approximate', country: 'IN' } }],
								max_tool_calls: Math.min(2 * missed.length, DEEP_RESEARCH_MAX_SEARCHES),
								max_output_tokens: 1200
							},
							deadline.signal
						);
						if (retry.ok) {
							const retryPayload = await retry.json();
							const again = readAnswer(retryPayload);
							searches += again.searches;
							for (const [id, url] of parseFound(again.text)) if (missed.some((item) => item.id === id)) urls.set(id, url);
							console.log(JSON.stringify({ event: 'llm_usage', call: 'verify_find_retry', model: searchModel, promptTokens: retryPayload?.usage?.input_tokens ?? null, completionTokens: retryPayload?.usage?.output_tokens ?? null, webSearches: again.searches, missed: missed.length, recovered: missed.filter((item) => urls.has(item.id)).length }));
						}
					} catch (error) {
						if (cancelled) return;
						console.error('The second search failed:', error);
					}
				}

				if (SOURCE_READING === 'browser') {
					// The pages, official PDFs included, are read in the user's browser: hand it a signed list.
					const urlList: string[] = [];
					const itemSource: Record<number, number> = {};
					for (const item of items) {
						const raw = urls.get(item.id);
						const url = raw ? cleanUrl(raw) : '';
						const host = url ? hostOf(url) : null;
						if (!url || !host || !isAllowedHost(host, RESEARCH_DOMAINS) || !isDocumentUrl(url)) continue;
						if (!urlList.includes(url)) urlList.push(url);
						itemSource[item.id] = urlList.indexOf(url) + 1;
					}
					if (urlList.length > 0) {
						const sourcesList = urlList.map((url, at) => ({ n: at + 1, url, title: '', host: hostOf(url) ?? '', official: isOfficialHost(hostOf(url) ?? '') }));
						send({
							gather: {
								token: await issueGrant('verify', grantSubject(locals), reservation.day, urlList),
								sources: sourcesList,
								queries: Object.fromEntries(
									sourcesList.map((source) => [source.n, items.filter((item) => itemSource[item.id] === source.n).map((item) => `${item.proposition} ${item.name}`).join(' ')])
								),
								chars: DEEP_RESEARCH_READ_CHARS,
								needles: [...new Set(items.map((item) => item.reporter).filter(Boolean))],
								context: { items, itemSource, searches }
							}
						});
						send({ verify: quotaInfo(subject, remaining) });
						return;
					}
				}

				// 3. Open the pages. One page can answer more than one citation.
				send({ stage: 'opening' });
				const pagesByUrl = new Map<string, Awaited<ReturnType<typeof fetchPage>> | null>();
				const unreadable = new Set<number>();
				const wanted = new Map<number, string>();
				for (const item of items) {
					const raw = urls.get(item.id);
					const url = raw ? cleanUrl(raw) : '';
					const host = url ? hostOf(url) : null;
					if (!url || !host || !isAllowedHost(host, RESEARCH_DOMAINS) || !isDocumentUrl(url)) continue;
					if (isPdfUrl(url)) {
						unreadable.add(item.id);
						continue;
					}
					wanted.set(item.id, url);
				}
				await Promise.all(
					[...new Set(wanted.values())].map(async (url) => {
						pagesByUrl.set(url, await fetchPage(fetch, url, { domains: RESEARCH_DOMAINS, maxChars: 5_000_000, signal: deadline.signal, allowLocal: import.meta.env.DEV }).catch(() => null));
					})
				);

				const sources: ResearchSource[] = [];
				const numberOf = new Map<string, number>();
				const located = new Map<number, Located>();
				for (const item of items) {
					const url = wanted.get(item.id);
					const page = url ? pagesByUrl.get(url) : null;
					if (!url || !page) continue;
					let n = numberOf.get(page.url);
					if (!n) {
						n = sources.length + 1;
						numberOf.set(page.url, n);
						sources.push({ n, url: page.url, title: page.title, host: page.host, official: isOfficialHost(page.host), read: 'text' });
					}
					// With no name to compare, the reference printed on the page is the only way to tell it is the case cited.
					const verified = item.name ? pageIsCase(item.name, page.title, page.text) : checkDetails(item, page.title, page.text).reporter === 'found';
					const excerpt = item.proposition && verified ? selectExcerpts(page.text, `${item.proposition} ${item.name}`, DEEP_RESEARCH_READ_CHARS) : { text: '', cut: false };
					located.set(item.id, { n, title: page.title, page: page.text, excerpt: excerpt.text, cut: excerpt.cut, verified });
				}

				// 4. Does each judgment say what it is cited for? The only step a model does.
				const rows = items.filter((item) => item.proposition && located.get(item.id)?.verified).map((item) => ({ item, n: located.get(item.id)!.n }));
				let support = new Map<number, ReturnType<typeof parseSupport>[number]>();
				let supportChecked = true;
				if (rows.length > 0) {
					send({ stage: 'checking' });
					const used = new Map<number, { n: number; title: string; host: string; text: string; cut: boolean }>();
					for (const { item, n } of rows) {
						const page = located.get(item.id)!;
						const source = sources.find((entry) => entry.n === n)!;
						// A page cited for several points is shown once, with the passages chosen for the first.
						if (!used.has(n)) used.set(n, { n, title: page.title, host: source.host, text: page.excerpt, cut: page.cut });
					}
					const ran = await checkSupport(fetch, writeModelFor(tierOf(locals)) ?? searchModel, rows, [...used.values()].sort((a, b) => a.n - b.n), deadline.signal);
					support = ran.support;
					supportChecked = ran.checked;
				}

				const report = buildVerifyReport(items, located, support, { unreadable, supportChecked });
				send({ brief: { topic: 'Citation check', blocks: [], sources, searches, report } });
				send({ verify: quotaInfo(subject, remaining) });
			} catch (error) {
				// A stop keeps its count: the work was already running.
				if (cancelled) return;
				await fail(deadline.timedOut ? 'The check took too long. It has not used any of your checks. Please try again.' : 'The check could not be completed right now. It has not used any of your checks.');
				if (!deadline.timedOut) console.error('Citation check failed:', error);
			} finally {
				deadline.dispose();
				if (!cancelled) controller.close();
			}
		},
		cancel() {
			cancelled = true;
			upstream.abort();
			console.log(JSON.stringify({ event: 'verify_cancelled' }));
		}
	});

	return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform' } });
};
