import assert from 'node:assert/strict';
import { test } from 'node:test';
import { networkOf } from './network.ts';

test('an IPv4 address stands for itself', () => {
	assert.equal(networkOf('203.0.113.5'), '203.0.113.5');
});

test('addresses in the same /64 are one network, in different /64s are not', () => {
	const a = networkOf('2001:db8:1234:5678:aaaa:bbbb:cccc:dddd');
	assert.equal(a, '2001:db8:1234:5678::/64');
	assert.equal(networkOf('2001:0DB8:1234:5678::1'), a);
	assert.equal(networkOf('2001:db8:1234:5678:ffff:ffff:ffff:ffff'), a);
	assert.notEqual(networkOf('2001:db8:1234:5679::1'), a);
});

test('shorthand forms are expanded before the /64 is taken', () => {
	assert.equal(networkOf('2001:db8::1'), '2001:db8:0:0::/64');
	assert.equal(networkOf('::1'), '0:0:0:0::/64');
	assert.equal(networkOf('2001:db8:0:0:1::'), '2001:db8:0:0::/64');
});

test('an IPv4 address in IPv6 form counts as the IPv4 address', () => {
	assert.equal(networkOf('::ffff:203.0.113.5'), '203.0.113.5');
	assert.equal(networkOf('::ffff:cb00:7105'), '203.0.113.5');
});

test('brackets and zone ids are ignored, and unreadable input is kept', () => {
	assert.equal(networkOf('[2001:db8::1]'), '2001:db8:0:0::/64');
	assert.equal(networkOf('fe80::1%eth0'), 'fe80:0:0:0::/64');
	assert.equal(networkOf('not an ip'), 'not an ip');
	assert.equal(networkOf('1:2:3:4:5:6:7:8:9'), '1:2:3:4:5:6:7:8:9');
	assert.equal(networkOf('2001::db8::1'), '2001::db8::1');
});
