import { env } from 'cloudflare:workers';
import { CONTACT_FROM, CONTACT_INBOX } from '$app/env/private';
import { parseContact } from '#lib/contact.js';
import { buildContactMail } from '#lib/server/contact-mail.js';
import { release, reserve } from '#lib/server/quota.js';
import type { Subject } from '#lib/server/quota.js';
import type { RequestHandler } from './$types';

/** Messages one browser may send a day, and one network, so the inbox cannot be flooded. */
const DAILY = { anon: 3, ip: 10 };

/**
 * Sends a Contact form message to the support inbox through Cloudflare's email binding. The message
 * is not stored. Without the binding or the inbox address it says so, and the page falls back to
 * the visitor's own mail app.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	if (locals.authFailed) {
		return Response.json({ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' }, { status: 401 });
	}
	const parsed = parseContact(await request.json().catch(() => null));
	if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

	const db = env.DB;
	if (!env.EMAIL || !CONTACT_INBOX || !db) {
		return Response.json({ error: 'Sending from here is not available right now.', code: 'unavailable' }, { status: 503 });
	}

	const subject: Subject = {
		ns: 'contact',
		id: locals.user?.uid ?? locals.visitor.anonId,
		ipHash: locals.visitor.ipHash,
		limits: DAILY
	};
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json({ error: 'You have sent several messages today. Please try again tomorrow.', code: 'limit' }, { status: 429 });
	}

	try {
		const { EmailMessage } = await import('cloudflare:email');
		const raw = buildContactMail({
			from: CONTACT_FROM,
			to: CONTACT_INBOX,
			input: parsed.input,
			name: locals.user?.name,
			signedIn: !!locals.user,
			now: new Date(),
			id: crypto.randomUUID()
		});
		await env.EMAIL.send(new EmailMessage(CONTACT_FROM, CONTACT_INBOX, raw));
	} catch (error) {
		console.error('Contact message could not be sent.', error);
		await release(db, subject, reservation.day);
		return Response.json({ error: 'The message could not be sent.', code: 'unavailable' }, { status: 502 });
	}
	return Response.json({ ok: true });
};
