export const CONTACT_TOPICS = ['Bug', 'Wrong result', 'Missing citation', 'Feature request', 'Billing', 'Other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const MAX_MESSAGE = 3000;
const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export type ContactInput = { topic: ContactTopic | null; message: string; email: string };

/** Checks what the contact form sends, on both sides. Returns the cleaned input or a reason. */
export function parseContact(body: unknown): { ok: true; input: ContactInput } | { ok: false; error: string } {
	const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
	const message = typeof raw.message === 'string' ? raw.message.trim() : '';
	const email = typeof raw.email === 'string' ? raw.email.trim() : '';
	const topic = CONTACT_TOPICS.find((t) => t === raw.topic) ?? null;
	if (!message) return { ok: false, error: 'Write a message first.' };
	if (message.length > MAX_MESSAGE) return { ok: false, error: `Keep the message under ${MAX_MESSAGE} characters.` };
	if (!EMAIL.test(email) || email.length > 254) return { ok: false, error: 'Enter an email address we can reply to.' };
	return { ok: true, input: { topic, message, email } };
}

/** A link that opens the person's own mail app with the message ready. Used when sending from here fails. */
export function contactMailto(topic: ContactTopic | null, message: string, email: string): string {
	const subject = topic ? `[${topic}] Legal Spotter` : 'Legal Spotter';
	return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.trim())}`;
}
