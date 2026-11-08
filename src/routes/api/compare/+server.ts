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
import {
	COMPARE_INSTRUCTIONS,
	COMPARE_QUERY,
	TREATMENT_INSTRUCTIONS,
	compareInput,
	treatmentInput
} from '#lib/server/compare.js';
import { Deadline } from '#lib/server/deadline.js';
import { selectExcerpts } from '#lib/server/excerpt.js';
import { isPdfUrl } from '#lib/server/ground.js';
import { issueGrant } from '#lib/server/grants.js';
import { compareSubjectFor, grantSubject, tierOf, writeModelFor } from '#lib/server/identity.js';
import { post, readAnswer, writerBody } from '#lib/server/openai.js';
import { fetchPage } from '#lib/server/page.js';
import { quotaInfo, release, reserve } from '#lib/server/quota.js';
import { RESEARCH_DOMAINS, cleanUrl, isDocumentUrl, isOfficialHost } from '#lib/server/research.js';
import { hostOf, isAllowedHost } from '#lib/server/verify.js';
import { COMPARE_SCHEMA, buildReport, parseDraft, reportTally } from '#lib/server/writer.js';
import type { SourceText } from '#lib/server/writer.js';
import { COMPARE_TEMPLATE } from '#lib/report.js';
import type { CompareEvent, ResearchSource } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

/** Decisions that overturned either case are read too, but only a few. */
const MAX_TREATMENT_PAGES = 3;

type Chosen = { url: string; name: string };

/** The two confirmed cases from the request, each on an allowed site and not a PDF. */
function parseCases(raw: unknown): Chosen[] | null {
	if (!Array.isArray(raw) || raw.length !== 2) return null;
	const cases: Chosen[] = [];
	for (const entry of raw as any[]) {
		const url = typeof entry?.url === 'string' ? cleanUrl(entry.url.trim()) : '';
		const name = typeof entry?.name === 'string' ? entry.name.trim().slice(0, 200) : '';
		const host = url ? hostOf(url) : null;
		if (!name || !host || !isAllowedHost(host, RESEARCH_DOMAINS) || isPdfUrl(url) || !isDocumentUrl(url)) return null;
		cases.push({ url, name });
	}
	return cases[0].url === cases[1].url ? null : cases;
}

/**
 * Compares the two confirmed cases: their facts, then what each court decided, and any decision
 * that overturned either. Both judgments are opened here and cut down to their most relevant
 * paragraphs; the report is written from those pages only, with every quote checked against its
 * page. A comparison that cannot be written is refunded.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json({ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' }, { status: 401 });
	}

	let chosen: Chosen[] | null = null;
	try {
		chosen = parseCases((await request.json())?.cases);
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}
	if (!chosen) return Response.json({ error: 'Choose two different cases on Indian Kanoon or a court or statute site.' }, { status: 400 });
	if (!OPENAI_API_KEY) return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const subject = compareSubjectFor(locals);
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{ error: `You have used your case comparisons for this month (${subject.limits.anon}).`, code: 'compare_limit', compare: quotaInfo(subject, 0) },
			{ status: 429 }
		);
	}

	const encoder = new TextEncoder();
	const upstream = new AbortController();
	let cancelled = false;
	let remaining = reservation.remaining;

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: CompareEvent) => {
				if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
			};
			const refund = async () => {
				try {
					await release(db, subject, reservation.day);
					remaining += 1;
				} catch (error) {
					console.error('Compare quota refund failed:', error);
				}
			};
			const fail = async (message: string) => {
				await refund();
				send({ error: message });
				send({ compare: quotaInfo(subject, remaining) });
			};

			const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, upstream.signal);
			try {
				send({ compare: quotaInfo(subject, remaining) });
				const inBrowser = SOURCE_READING === 'browser';

				// 1. Open both judgments. With browser reading, the user's browser does this later.
				let pages: NonNullable<Awaited<ReturnType<typeof fetchPage>>>[] = [];
				if (!inBrowser) {
					send({ stage: 'opening' });
					const opened = await Promise.all(
						chosen!.map((entry) =>
							fetchPage(fetch, entry.url, { domains: RESEARCH_DOMAINS, maxChars: 5_000_000, signal: deadline.signal, allowLocal: import.meta.env.DEV }).catch(() => null)
						)
					);
					if (opened.some((page) => page === null)) {
						return await fail('One of the judgments could not be opened right now. It has not used any of your comparisons.');
					}
					pages = opened as typeof pages;
				}

				// 2. Look for decisions that overturned either; the comparison goes on without them if the search fails.
				send({ stage: 'treatment' });
				const model = DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;
				let leads = '';
				let searches = 0;
				const treatmentUrls: string[] = [];
				try {
					const response = await post(
						fetch,
						'/responses',
						{
							model,
							instructions: TREATMENT_INSTRUCTIONS,
							input: treatmentInput(chosen![0].name, chosen![1].name),
							tools: [
								{
									type: 'web_search',
									filters: { allowed_domains: RESEARCH_DOMAINS },
									search_context_size: 'medium',
									user_location: { type: 'approximate', country: 'IN' }
								}
							],
							max_tool_calls: Math.min(5, DEEP_RESEARCH_MAX_SEARCHES),
							max_output_tokens: 1500
						},
						deadline.signal
					);
					if (response.ok) {
						const payload = await response.json();
						const answer = readAnswer(payload);
						searches = answer.searches;
						leads = answer.text.slice(0, 3000);
						console.log(JSON.stringify({ event: 'llm_usage', call: 'compare_treatment', model, promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, webSearches: searches }));
						for (const { url } of answer.urls) {
							const clean = cleanUrl(url);
							const host = hostOf(clean);
							if (host && isAllowedHost(host, RESEARCH_DOMAINS) && !isPdfUrl(clean) && isDocumentUrl(clean) && !(inBrowser ? chosen!.some((entry) => entry.url === clean) : pages.some((page) => page.url === clean)) && !treatmentUrls.includes(clean)) {
								treatmentUrls.push(clean);
							}
						}
					} else {
						console.error(`Looking for overturning decisions failed (${response.status}).`);
					}
				} catch (error) {
					if (cancelled) return;
					console.error('Looking for overturning decisions failed:', error);
				}

				if (inBrowser) {
					// The pages are read in the user's browser: hand it a signed list and wait for it to come back.
					const urls = [chosen![0].url, chosen![1].url, ...treatmentUrls.slice(0, MAX_TREATMENT_PAGES)];
					const names = `${chosen![0].name} ${chosen![1].name}`;
					const sources = urls.map((url, at) => ({ n: at + 1, url, title: at < 2 ? chosen![at].name : '', host: hostOf(url) ?? '', official: isOfficialHost(hostOf(url) ?? '') }));
					send({
						gather: {
							token: await issueGrant('compare', grantSubject(locals), reservation.day, urls),
							sources,
							queries: Object.fromEntries(sources.map((source) => [source.n, source.n <= 2 ? `${chosen![source.n - 1].name} ${COMPARE_QUERY}` : `${names} overruled reversed set aside doubted distinguished ${leads}`])),
							chars: DEEP_RESEARCH_READ_CHARS,
							context: { leads, searches }
						}
					});
					send({ compare: quotaInfo(subject, remaining) });
					return;
				}

				// 3. Open those, and choose the passages of everything.
				send({ stage: 'reading' });
				const extra = (
					await Promise.all(
						treatmentUrls.slice(0, MAX_TREATMENT_PAGES).map((url) =>
							fetchPage(fetch, url, { domains: RESEARCH_DOMAINS, maxChars: 5_000_000, signal: deadline.signal, allowLocal: import.meta.env.DEV }).catch(() => null)
						)
					)
				).filter((page): page is NonNullable<typeof page> => page !== null);

				const all = [...pages, ...extra];
				const fullText = new Map<number, string>();
				const excerpts = new Map<number, string>();
				const cut = new Map<number, boolean>();
				const texts: SourceText[] = all.map((page, at) => {
					const n = at + 1;
					const own = at < 2;
					const query = own
						? `${chosen![at].name} ${COMPARE_QUERY}`
						: `${chosen![0].name} ${chosen![1].name} overruled reversed set aside doubted distinguished ${leads}`;
					const excerpt = selectExcerpts(page.text, query, DEEP_RESEARCH_READ_CHARS);
					fullText.set(n, page.text);
					excerpts.set(n, excerpt.text);
					cut.set(n, excerpt.cut);
					return { n, host: page.host, title: page.title, text: excerpt.text, cut: excerpt.cut };
				});

				// 4. Write and verify.
				send({ stage: 'writing' });
				const title = `${chosen![0].name} and ${chosen![1].name}`;
				const writer = writeModelFor(tierOf(locals)) ?? model;
				const response = await post(
					fetch,
					'/responses',
					writerBody(writer, COMPARE_INSTRUCTIONS, [{ type: 'input_text', text: compareInput(title, leads, texts) }], 'case_comparison', COMPARE_SCHEMA),
					deadline.signal
				);
				if (!response.ok) {
					console.error(`Writing the comparison failed (${response.status}):`, await response.text());
					return await fail('The comparison could not be written right now. It has not used any of your comparisons.');
				}
				const payload = await response.json();
				console.log(JSON.stringify({ event: 'llm_usage', call: 'compare_write', model: writer, promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, reasoningTokens: payload?.usage?.output_tokens_details?.reasoning_tokens ?? null, status: payload?.status ?? null, pages: all.length }));

				const draft = parseDraft(readAnswer(payload).text, COMPARE_TEMPLATE);
				if (!draft) return await fail('The comparison could not be read back. It has not used any of your comparisons.');

				const drops: { text: string; source: number; why: string }[] = [];
				const report = buildReport(draft, title, { pages: fullText, pdfs: new Set(), excerpts }, (info) => drops.push(info), 'compare');
				if (drops.length > 0) console.log(JSON.stringify({ event: 'compare_dropped', count: drops.length }));
				if (reportTally(report).lines === 0) {
					return await fail('Nothing in the comparison could be confirmed against the pages. It has not used any of your comparisons.');
				}

				const sources: ResearchSource[] = all.map((page, at) => ({
					n: at + 1,
					url: page.url,
					title: page.title,
					host: page.host,
					official: isOfficialHost(page.host),
					read: 'text',
					...(cut.get(at + 1) && { truncated: true })
				}));
				send({ brief: { topic: title, blocks: [], sources, searches, report } });
				send({ compare: quotaInfo(subject, remaining) });
			} catch (error) {
				// A stop keeps its count: the work was already running.
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
			console.log(JSON.stringify({ event: 'compare_cancelled' }));
		}
	});

	return new Response(stream, {
		headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform' }
	});
};
