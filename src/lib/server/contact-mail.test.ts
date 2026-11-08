import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildContactMail } from './contact-mail.ts';

const base = { from: 'noreply@legalspotter.com', to: 'inbox@example.test', signedIn: false, now: new Date('2026-11-09T10:00:00Z'), id: 'abc' };

function parts(raw: string) {
	const [head, ...rest] = raw.split('\r\n\r\n');
	return { head, body: Buffer.from(rest.join('').replace(/\r\n/g, ''), 'base64').toString('utf8') };
}

test('the person is in Reply-To and the message is in the body', () => {
	const { head, body } = parts(buildContactMail({ ...base, input: { topic: 'Billing', message: 'I want the plan ₹399.', email: 'a@b.test' } }));
	assert.match(head, /^From: Legal Spotter <noreply@legalspotter.com>$/m);
	assert.match(head, /^Reply-To: a@b\.test$/m);
	assert.match(head, /^Subject: \[Billing\] Legal Spotter message$/m);
	assert.match(body, /I want the plan ₹399\./);
	assert.match(body, /Signed in: no/);
});

test('a name with a line break cannot add headers', () => {
	const { head, body } = parts(buildContactMail({ ...base, name: 'Eve\r\nBcc: x@y.test', input: { topic: null, message: 'hi', email: 'a@b.test' } }));
	assert.doesNotMatch(head, /^Bcc:/m);
	assert.match(body, /From: Eve Bcc: x@y\.test <a@b\.test>/);
});
