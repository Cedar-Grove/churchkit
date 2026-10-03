import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOME_SECTIONS, HOME_LAYOUTS, listHomeLayouts, resolveHomeLayout } from '@churchkit/config/home-layouts';

const sectionIds = new Set(Object.keys(HOME_SECTIONS));

test('every layout uses only known section ids', () => {
	for (const [id, layout] of Object.entries(HOME_LAYOUTS)) {
		for (const section of layout.sections) {
			assert.ok(sectionIds.has(section), `${id} references unknown section "${section}"`);
		}
	}
});

test('every layout orders every known section exactly once', () => {
	for (const [id, layout] of Object.entries(HOME_LAYOUTS)) {
		assert.equal(layout.sections.length, sectionIds.size, `${id} should list every section exactly once`);
		assert.equal(new Set(layout.sections).size, layout.sections.length, `${id} has a duplicate section`);
	}
});

test('classic exists and is the fallback for an unset or unknown value', () => {
	assert.ok(HOME_LAYOUTS.classic);
	assert.equal(resolveHomeLayout(undefined), HOME_LAYOUTS.classic);
	assert.equal(resolveHomeLayout(''), HOME_LAYOUTS.classic);
	assert.equal(resolveHomeLayout('not-a-real-layout'), HOME_LAYOUTS.classic);
});

test('resolveHomeLayout returns the named layout when it exists', () => {
	assert.equal(resolveHomeLayout('events-first'), HOME_LAYOUTS['events-first']);
});

test('there are at least 5 layouts to choose between', () => {
	assert.ok(Object.keys(HOME_LAYOUTS).length >= 5);
});

test('listHomeLayouts returns one labeled entry per layout, in definition order', () => {
	const listed = listHomeLayouts();
	assert.deepEqual(listed.map(([id]) => id), Object.keys(HOME_LAYOUTS));
	for (const [, label] of listed) {
		assert.match(label, /^.+ — .+$/);
	}
});
