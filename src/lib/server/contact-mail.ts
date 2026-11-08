import type { ContactInput } from '../contact.ts';

const clean = (value: string) => value.replace(/[\r\n]+/g, ' ').trim();

function base64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** A header value that is safe for any characters: plain when it is ASCII, else RFC 2047. */
const header = (value: string) => (/^[\x20-\x7e]*$/.test(clean(value)) ? clean(value) : `=?UTF-8?B?${base64(clean(value))}?=`);

export type ContactMail = {
	from: string;
	to: string;
	input: ContactInput;
	/** The signed-in name, if there is one. */
	name?: string | null;
	signedIn: boolean;
	now: Date;
	id: string;
};

/** The raw message the contact form sends to the inbox. The person's address is in Reply-To, never From. */
export function buildContactMail({ from, to, input, name, signedIn, now, id }: ContactMail): string {
	const domain = from.split('@')[1] ?? 'localhost';
	const body = [
		input.message,
		'',
		'---',
		`From: ${clean(name ?? '') || 'not given'} <${input.email}>`,
		`Signed in: ${signedIn ? 'yes' : 'no'}`
	].join('\r\n');
	const lines = base64(body).match(/.{1,76}/g) ?? [];
	return [
		`From: Legal Spotter <${clean(from)}>`,
		`To: ${clean(to)}`,
		`Reply-To: ${clean(input.email)}`,
		`Subject: ${header(input.topic ? `[${input.topic}] Legal Spotter message` : 'Legal Spotter message')}`,
		`Date: ${now.toUTCString()}`,
		`Message-ID: <${clean(id)}@${domain}>`,
		'MIME-Version: 1.0',
		'Content-Type: text/plain; charset=utf-8',
		'Content-Transfer-Encoding: base64',
		'',
		...lines,
		''
	].join('\r\n');
}
