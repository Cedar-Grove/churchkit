import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, generatePassword } from '@churchkit/config/password';

test('hashPassword then verifyPassword round-trips the same password', () => {
	const hash = hashPassword('correct horse battery staple');
	assert.equal(verifyPassword('correct horse battery staple', hash), true);
});

test('verifyPassword rejects a wrong password', () => {
	const hash = hashPassword('correct horse battery staple');
	assert.equal(verifyPassword('wrong password', hash), false);
});

test('two hashes of the same password differ (random salt)', () => {
	const a = hashPassword('same password');
	const b = hashPassword('same password');
	assert.notEqual(a, b);
	assert.equal(verifyPassword('same password', a), true);
	assert.equal(verifyPassword('same password', b), true);
});

test('verifyPassword fails closed on a malformed stored value', () => {
	assert.equal(verifyPassword('anything', ''), false);
	assert.equal(verifyPassword('anything', 'not-a-hash'), false);
	assert.equal(verifyPassword('anything', 'scrypt$not$enough$parts'), false);
	assert.equal(verifyPassword('anything', null), false);
	assert.equal(verifyPassword('anything', undefined), false);
});

test('generatePassword returns the requested length from a shell-safe alphabet', () => {
	const pw = generatePassword(24);
	assert.equal(pw.length, 24);
	assert.match(pw, /^[A-Za-z0-9]+$/);
});

test('generatePassword does not repeat across calls', () => {
	const a = generatePassword();
	const b = generatePassword();
	assert.notEqual(a, b);
});
