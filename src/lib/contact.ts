export const CONTACT_TOPICS = ['Bug', 'Wrong result', 'Missing citation', 'Feature request', 'Billing', 'Other'] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

/** A link that opens the person's own mail app with the message ready, so no server or service sends it. */
export function contactMailto(topic: ContactTopic | null, message: string, email: string): string {
	const subject = topic ? `[${topic}] Legal Spotter` : 'Legal Spotter';
	return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.trim())}`;
}
