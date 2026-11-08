import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { Deadline } from './deadline.ts';

test('fires when nothing happens for the idle time', async () => {
	const deadline = new Deadline(30, 1000);
	await sleep(80);
	assert.equal(deadline.signal.aborted, true);
	assert.equal(deadline.reason, 'idle');
	assert.equal(deadline.timedOut, true);
});

test('touch keeps a call that is making progress alive', async () => {
	const deadline = new Deadline(50, 1000);
	for (let i = 0; i < 4; i++) {
		await sleep(25);
		deadline.touch();
	}
	assert.equal(deadline.signal.aborted, false, 'still alive after 100ms with a 50ms idle limit');
	deadline.dispose();
});

test('the total limit fires even while chunks keep arriving', async () => {
	const deadline = new Deadline(50, 90);
	for (let i = 0; i < 6 && !deadline.signal.aborted; i++) {
		await sleep(25);
		deadline.touch();
	}
	assert.equal(deadline.signal.aborted, true);
	assert.equal(deadline.reason, 'total');
});

test("the user's abort passes through and is not a timeout", () => {
	const parent = new AbortController();
	const deadline = new Deadline(1000, 1000, parent.signal);
	parent.abort();
	assert.equal(deadline.signal.aborted, true);
	assert.equal(deadline.timedOut, false);
	deadline.dispose();
});

test('dispose stops the timers', async () => {
	const deadline = new Deadline(20, 40);
	deadline.dispose();
	await sleep(80);
	assert.equal(deadline.signal.aborted, false);
	assert.equal(deadline.timedOut, false);
});
