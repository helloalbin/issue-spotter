import { env } from 'cloudflare:workers';
import { URL_FETCH_DAILY_LIMIT, URL_FETCH_IP_DAILY_LIMIT } from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { subjectFor } from '#lib/server/identity.js';
import { PageError, checkUrl, fetchPage } from '#lib/server/page.js';
import { release, reserve } from '#lib/server/quota.js';
import { SOURCE_DOMAINS } from '#lib/server/verify.js';
import { MAX_ATTACHMENT_CHARS } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Fetches a page from an allowed legal site and returns its text, so the user can attach it to a
 * case as background. Nothing is stored: the browser keeps it and sends it with each analysis.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json(
			{ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' },
			{ status: 401 }
		);
	}

	let raw = '';
	try {
		const body = await request.json();
		raw = typeof body?.url === 'string' ? body.url : '';
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	// A bad address costs nothing: it is turned away before any quota is taken.
	const allowLocal = import.meta.env.DEV;
	const check = raw.length <= 500 ? checkUrl(raw, SOURCE_DOMAINS, { allowLocal }) : null;
	if (!check || !check.ok) {
		return Response.json(
			{ error: check && !check.ok ? check.message : 'That link is too long.' },
			{ status: 400 }
		);
	}

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const base = subjectFor(locals);
	const subject = {
		...base,
		ns: `url:${base.ns}`,
		limits: { anon: URL_FETCH_DAILY_LIMIT, ip: URL_FETCH_IP_DAILY_LIMIT }
	};
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{ error: `You have added the most pages allowed for today (${URL_FETCH_DAILY_LIMIT}).`, code: 'url_limit' },
			{ status: 429 }
		);
	}

	const deadline = new Deadline(FETCH_TIMEOUT_MS, FETCH_TIMEOUT_MS);
	try {
		const attachment = await fetchPage(fetch, check.url.toString(), {
			domains: SOURCE_DOMAINS,
			maxChars: MAX_ATTACHMENT_CHARS,
			signal: deadline.signal,
			allowLocal
		});
		return Response.json({ attachment });
	} catch (error) {
		// Only pages that were really added count against the day.
		await release(db, subject, reservation.day).catch(() => {});
		if (error instanceof PageError) {
			return Response.json({ error: error.message }, { status: error.status });
		}
		console.error('Adding a page failed:', error);
		return Response.json({ error: 'That page could not be added.' }, { status: 502 });
	} finally {
		deadline.dispose();
	}
};
