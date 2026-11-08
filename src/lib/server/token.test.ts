import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readGrant, signGrant, signStamp, stampValid } from './token.ts';
import type { Grant } from './token.ts';

const grant: Grant = { kind: 'research', who: 'search:abc', day: '2026-11', nonce: 'n1', urls: ['https://indiankanoon.org/doc/1/'], exp: Date.now() + 60_000 };

test('a grant signed with the key is read back', async () => {
	const token = await signGrant(grant, 'k1');
	assert.deepEqual(await readGrant(token, 'k1'), grant);
});

test('a grant signed with another key, altered, malformed or expired is refused', async () => {
	const token = await signGrant(grant, 'k1');
	assert.equal(await readGrant(token, 'k2'), null);
	const [payload, sig] = token.split('.');
	const forged = btoa(JSON.stringify({ ...grant, urls: ['https://indiankanoon.org/doc/2/'] })).replace(/=+$/, '');
	assert.equal(await readGrant(`${forged}.${sig}`, 'k1'), null, 'changing the addresses breaks the signature');
	assert.equal(await readGrant(`${payload}.${sig}x`, 'k1'), null);
	assert.equal(await readGrant('nonsense', 'k1'), null);
	assert.equal(await readGrant(`${payload}.${sig}.extra`, 'k1'), null);
	assert.equal(await readGrant(await signGrant({ ...grant, exp: Date.now() - 1 }, 'k1'), 'k1'), null);
});

test('a stamp is valid only for the address, hash and time it was signed for', async () => {
	const base = { url: 'https://api.sci.gov.in/a.pdf', sha256: 'ab'.repeat(32), fetchedAt: '2026-11-08T10:00:00.000Z' };
	const sig = await signStamp(base, 'k1');
	assert.equal(await stampValid({ ...base, sig }, 'k1'), true);
	assert.equal(await stampValid({ ...base, sig }, 'k2'), false);
	assert.equal(await stampValid({ ...base, sha256: 'cd'.repeat(32), sig }, 'k1'), false);
	assert.equal(await stampValid({ ...base, sig: '' }, 'k1'), false);
});
