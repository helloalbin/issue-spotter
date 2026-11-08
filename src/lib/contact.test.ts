import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contactMailto } from './contact.ts';

test('the topic goes in the subject and the message in the body', () => {
	const link = contactMailto('Billing', 'I want the Investigative plan.\nThanks', 'a@b.test');
	const url = new URL(link);
	assert.equal(url.protocol, 'mailto:');
	assert.equal(url.pathname, 'a@b.test');
	assert.equal(url.searchParams.get('subject'), '[Billing] Legal Spotter');
	assert.equal(url.searchParams.get('body'), 'I want the Investigative plan.\nThanks');
});

test('no topic leaves a plain subject, and the message is trimmed', () => {
	const url = new URL(contactMailto(null, '  hello  ', 'a@b.test'));
	assert.equal(url.searchParams.get('subject'), 'Legal Spotter');
	assert.equal(url.searchParams.get('body'), 'hello');
});

import { parseContact } from './contact.ts';

test('the form needs a message and an address to reply to', () => {
	assert.equal(parseContact({ message: ' ', email: 'a@b.test' }).ok, false);
	assert.equal(parseContact({ message: 'hi', email: 'nope' }).ok, false);
	assert.equal(parseContact({ message: 'x'.repeat(3001), email: 'a@b.test' }).ok, false);
	const ok = parseContact({ topic: 'Bug', message: ' hi ', email: ' a@b.test ' });
	assert.deepEqual(ok.ok && ok.input, { topic: 'Bug', message: 'hi', email: 'a@b.test' });
});

test('an unknown topic is dropped', () => {
	const result = parseContact({ topic: 'Spam', message: 'hi', email: 'a@b.test' });
	assert.equal(result.ok && result.input.topic, null);
});
