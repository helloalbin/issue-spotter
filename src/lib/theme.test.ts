import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MODES, parseMode, resolveMode } from './theme.ts';

test('a saved light or dark is kept; nothing saved, or anything else, follows the system', () => {
	assert.equal(parseMode('light'), 'light');
	assert.equal(parseMode('dark'), 'dark');
	assert.equal(parseMode('system'), 'system');
	assert.equal(parseMode(null), 'system');
	assert.equal(parseMode(undefined), 'system');
	assert.equal(parseMode('purple'), 'system');
});

test('system follows the device, and an explicit mode ignores it', () => {
	assert.equal(resolveMode('system', true), 'light');
	assert.equal(resolveMode('system', false), 'dark');
	assert.equal(resolveMode('light', false), 'light');
	assert.equal(resolveMode('dark', true), 'dark');
});

test('the three modes are listed in the order the page shows them', () => {
	assert.deepEqual([...MODES], ['light', 'system', 'dark']);
});
