import { env } from 'cloudflare:workers';
import {
	FILE_READ_DAILY_LIMIT,
	FILE_READ_IP_DAILY_LIMIT,
	OPENAI_API_KEY,
	OPENAI_BASE_URL,
	OPENAI_MODEL
} from '$app/env/private';
import { Deadline } from '#lib/server/deadline.js';
import { subjectFor } from '#lib/server/identity.js';
import { release, reserve } from '#lib/server/quota.js';
import { parseFileRequest, parseReadingReply, readingMessages } from '#lib/server/reading.js';
import type { Attachment } from '#lib/spotter.js';
import type { RequestHandler } from './$types';

const READ_TIMEOUT_MS = 45_000;

/**
 * Reads a file the user uploaded: tells them what it is and what it says, and whether it is legal
 * material at all. The browser has already pulled the text out of a PDF or Word file; an image is
 * transcribed here. Nothing is stored: the text goes back to the browser, which sends it with each
 * analysis of the case.
 */
export const POST: RequestHandler = async ({ request, fetch, locals }) => {
	if (locals.authFailed) {
		return Response.json(
			{ error: 'Your sign-in has expired. Please sign in again.', code: 'auth_invalid' },
			{ status: 401 }
		);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
	}

	// A file that cannot be read is turned away before any quota or model call is spent.
	const file = parseFileRequest(body);
	if (!file.ok) return Response.json({ error: file.error }, { status: 400 });
	if (!OPENAI_API_KEY) {
		return Response.json({ error: 'Server is missing OPENAI_API_KEY configuration.' }, { status: 500 });
	}

	const db = env.DB;
	if (!db) return Response.json({ error: 'Quota store is unavailable.' }, { status: 503 });

	const base = subjectFor(locals);
	const subject = {
		...base,
		ns: `file:${base.ns}`,
		limits: { anon: FILE_READ_DAILY_LIMIT, ip: FILE_READ_IP_DAILY_LIMIT }
	};
	const reservation = await reserve(db, subject);
	if (!reservation.ok) {
		return Response.json(
			{ error: `You have uploaded the most files allowed for today (${FILE_READ_DAILY_LIMIT}).`, code: 'file_limit' },
			{ status: 429 }
		);
	}
	const refund = () => release(db, subject, reservation.day).catch(() => {});

	const deadline = new Deadline(READ_TIMEOUT_MS, READ_TIMEOUT_MS);
	try {
		const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
			method: 'POST',
			signal: deadline.signal,
			headers: {
				Authorization: ['Bearer', OPENAI_API_KEY].join(' '),
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: OPENAI_MODEL,
				temperature: 0,
				max_tokens: file.kind === 'image' ? 2500 : 700,
				response_format: { type: 'json_object' },
				messages: readingMessages(file)
			})
		});

		if (!response.ok) {
			console.error(`File reading failed (${response.status}):`, await response.text());
			await refund();
			return Response.json({ error: 'That file could not be read right now. Please try again.' }, { status: 502 });
		}

		const payload = await response.json();
		console.log(
			JSON.stringify({
				event: 'llm_usage',
				call: 'file',
				model: OPENAI_MODEL,
				promptTokens: payload?.usage?.prompt_tokens ?? null,
				completionTokens: payload?.usage?.completion_tokens ?? null
			})
		);

		const reading = parseReadingReply(payload?.choices?.[0]?.message?.content ?? '');
		if (!reading) {
			await refund();
			return Response.json({ error: 'That file could not be understood. Try another.' }, { status: 422 });
		}

		// An unrelated file costs nothing: it is told so, and not attached.
		if (!reading.legal) {
			await refund();
			return Response.json({ legal: false, documentKind: reading.documentKind, description: reading.summary });
		}

		const text =
			file.kind === 'image'
				? reading.text || `Image of a ${reading.reading.documentKind}. ${reading.reading.summary.join(' ')}`
				: file.text;
		const attachment: Attachment = {
			id: `file:${file.name}`,
			kind: 'file',
			fileName: file.name,
			title: reading.title,
			text,
			truncated: file.truncated,
			reading: reading.reading
		};
		return Response.json({ legal: true, attachment });
	} catch (error) {
		await refund();
		if (deadline.timedOut) {
			return Response.json({ error: 'Reading that file took too long. Please try again.' }, { status: 504 });
		}
		console.error('File reading failed:', error);
		return Response.json({ error: 'That file could not be read right now. Please try again.' }, { status: 502 });
	} finally {
		deadline.dispose();
	}
};
