import { env } from 'cloudflare:workers';
import { DEEP_RESEARCH_MODEL, DEEP_RESEARCH_TIMEOUT_MS, OPENAI_API_KEY, OPENAI_MODEL } from '$app/env/private';
import { IDENTIFY_INSTRUCTIONS, pageIsCase, parseIdentification } from '#lib/server/compare.js';
import { Deadline } from '#lib/server/deadline.js';
import { isPdfUrl } from '#lib/server/ground.js';
import { identifySubjectFor } from '#lib/server/identity.js';
import { post, readAnswer } from '#lib/server/openai.js';
import { PageError, fetchPage } from '#lib/server/page.js';
import { quotaInfo, release, reserve } from '#lib/server/quota.js';
import { RESEARCH_DOMAINS, cleanUrl, isDocumentUrl, isOfficialHost } from '#lib/server/research.js';
import { hostOf, isAllowedHost } from '#lib/server/verify.js';
import type { CaseCandidate } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const MIN_INPUT = 8;
const MAX_INPUT = 600;

/**
 * Finds the two cases a student names and checks each: the page is opened and must be about the case
 * named. Nothing is compared here; the student confirms the cases first. It is a search, so it has
 * its own small daily limit, and a failure to find two cases gives the use back.
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
		return Response.json({ error: `Name the two cases, in ${MIN_INPUT} to ${MAX_INPUT} characters.` }, { status: 400 });
	}
	if (!OPENAI_API_KEY) return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const subject = identifySubjectFor(locals);
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{ error: `You have looked up cases to compare ${subject.limits.anon} times today. Try again tomorrow.`, code: 'identify_limit', quota: quotaInfo(subject, 0) },
			{ status: 429 }
		);
	}
	const refund = () => release(db, subject, reservation.day).catch((error) => console.error('Identify refund failed:', error));

	const deadline = new Deadline(DEEP_RESEARCH_TIMEOUT_MS, DEEP_RESEARCH_TIMEOUT_MS, request.signal);
	try {
		const model = DEEP_RESEARCH_MODEL ?? OPENAI_MODEL;
		const response = await post(
			fetch,
			'/responses',
			{
				model,
				instructions: IDENTIFY_INSTRUCTIONS,
				input,
				tools: [
					{
						type: 'web_search',
						filters: { allowed_domains: RESEARCH_DOMAINS },
						search_context_size: 'low',
						user_location: { type: 'approximate', country: 'IN' }
					}
				],
				max_tool_calls: 4,
				max_output_tokens: 1200
			},
			deadline.signal
		);
		if (!response.ok) {
			console.error(`Identifying cases failed (${response.status}):`, await response.text());
			await refund();
			return Response.json({ error: 'The cases could not be looked up right now. Please try again.' }, { status: 502 });
		}

		const payload = await response.json();
		const answer = readAnswer(payload);
		console.log(JSON.stringify({ event: 'llm_usage', call: 'compare_identify', model, promptTokens: payload?.usage?.input_tokens ?? null, completionTokens: payload?.usage?.output_tokens ?? null, webSearches: answer.searches }));

		const found = parseIdentification(answer.text);
		if (found.length < 2) {
			await refund();
			return Response.json(
				{ error: 'I could not tell two cases apart in that. Name both, for example "Pankaj Bansal v. Union of India and Ram Kishor Arora v. Directorate of Enforcement".' },
				{ status: 422 }
			);
		}

		const cases: CaseCandidate[] = await Promise.all(
			found.map(async (entry): Promise<CaseCandidate> => {
				const base = { query: entry.query, name: entry.name, court: entry.court, year: entry.year };
				const url = entry.url ? cleanUrl(entry.url) : '';
				const host = url ? hostOf(url) : null;
				const none = { ...base, url: '', title: '', host: host ?? '', official: false, verified: false, readable: false };

				if (!url || !host || !isAllowedHost(host, RESEARCH_DOMAINS) || !isDocumentUrl(url)) return { ...none, problem: 'I could not find a judgment page for this case.' };
				const official = isOfficialHost(host);
				if (isPdfUrl(url)) {
					return { ...none, url, host, official, problem: 'Only an official PDF was found, which the app cannot read yet. Try the Indian Kanoon citation.' };
				}
				try {
					const page = await fetchPage(fetch, url, { domains: RESEARCH_DOMAINS, maxChars: 30000, maxBytes: 250_000, signal: deadline.signal, allowLocal: import.meta.env.DEV });
					const verified = pageIsCase(entry.name, page.title, page.text);
					return {
						...base,
						url: page.url,
						title: page.title,
						host: page.host,
						official: isOfficialHost(page.host),
						verified,
						readable: true,
						...(!verified && { problem: 'The page I found does not look like this case. Check the name and try again.' })
					};
				} catch (error) {
					return { ...none, url, host, official, problem: error instanceof PageError ? error.message : 'That page could not be opened.' };
				}
			})
		);

		return Response.json({ cases });
	} catch (error) {
		await refund();
		console.error('Identifying cases failed:', error);
		return Response.json({ error: deadline.timedOut ? 'The lookup took too long. Please try again.' : 'The cases could not be looked up right now. Please try again.' }, { status: 502 });
	} finally {
		deadline.dispose();
	}
};
