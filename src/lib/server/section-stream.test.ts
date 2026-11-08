import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SectionParser } from './section-stream.ts';
import type { Piece } from './section-stream.ts';

const reply = JSON.stringify(
	{
		issues: [
			'Negligence of the "landlord"',
			'Breach, of duty [s.108]',
			'Back\\slash and é and “quotes”'
		],
		jurisdiction: 'India',
		doctrines: ['Res ipsa loquitur'],
		precedents: [],
		acts: [
			{
				act: 'The Indian Contract Act, 1872',
				sections: ['Section 73', 'Section 74'],
				relevance: 'Damages {for} breach, "quoted".'
			},
			{ act: 'Transfer of Property Act, 1882', sections: [], relevance: 'Lessor duties.' }
		],
		extra: [1, 2, { a: [1] }]
	},
	null,
	2
);

const expected = [
	'issues:Negligence of the "landlord"',
	'issues:Breach, of duty [s.108]',
	'issues:Back\\slash and é and “quotes”',
	'done:issues',
	'doctrines:Res ipsa loquitur',
	'done:doctrines',
	'done:precedents',
	'acts:The Indian Contract Act, 1872',
	'acts:Transfer of Property Act, 1882',
	'done:acts'
];

function run(chunks: Iterable<string>): Piece[] {
	const parser = new SectionParser();
	return [...chunks].flatMap((chunk) => parser.push(chunk));
}

function label(piece: Piece): string {
	if ('done' in piece) return `done:${piece.done}`;
	const { section, value } = piece.item;
	return `${section}:${typeof value === 'string' ? value : (value as { act: string }).act}`;
}

test('reports every element and finished section, skipping other keys', () => {
	assert.deepEqual(run([reply]).map(label), expected);
});

test('keeps an object element whole, with nested arrays and braces inside strings', () => {
	const act = run([reply]).find((piece) => 'item' in piece && piece.item.section === 'acts');
	assert.deepEqual(act && 'item' in act && act.item.value, {
		act: 'The Indian Contract Act, 1872',
		sections: ['Section 73', 'Section 74'],
		relevance: 'Damages {for} breach, "quoted".'
	});
});

test('gives the same result however the reply is chunked', () => {
	assert.deepEqual(run(reply).map(label), expected, 'one character at a time');
	for (let i = 1; i < reply.length; i++) {
		assert.deepEqual(run([reply.slice(0, i), reply.slice(i)]).map(label), expected, `split at ${i}`);
	}
});

test('works on compact JSON with no whitespace', () => {
	assert.deepEqual(run([JSON.stringify(JSON.parse(reply))]).map(label), expected);
});

test('reports an element as soon as it is complete, not before', () => {
	assert.deepEqual(run(['{"issues":["a","b']).map(label), ['issues:a']);
	assert.deepEqual(run(['{"issues":["a","b', '","c"']).map(label), ['issues:a', 'issues:b', 'issues:c']);
});

test('does not throw on empty or malformed input', () => {
	assert.deepEqual(run(['']), []);
	assert.doesNotThrow(() => run(['not json at all ]]] }}} "', '{"issues": [ {"x": ']));
});

test('streams the parts of a draft, with newlines, brackets and quotes inside their text', () => {
	const reply = JSON.stringify(
		{
			jurisdiction: 'India',
			documentType: 'Police complaint',
			draft: [
				{ heading: 'To', text: 'The Station House Officer,\n[Name of Police Station]' },
				{ heading: 'Facts', text: '1. I, [Name], state that "two men" assaulted me.\n2. They took {my phone}.' }
			],
			openQuestions: ['Name and address of the complainant'],
			draftNotes: ['An advocate must review this.', 'Verify [Section 115 BNS, 2023].']
		},
		null,
		2
	);
	const want = ['draft:To', 'draft:Facts', 'done:draft', 'openQuestions:Name and address of the complainant', 'done:openQuestions', 'draftNotes:An advocate must review this.', 'draftNotes:Verify [Section 115 BNS, 2023].', 'done:draftNotes'];
	const name = (piece: Piece) => {
		if ('done' in piece) return `done:${piece.done}`;
		const { section, value } = piece.item;
		return `${section}:${typeof value === 'string' ? value : (value as { heading: string }).heading}`;
	};
	assert.deepEqual(run([reply]).map(name), want);
	assert.deepEqual(run(reply).map(name), want, 'one character at a time');
	for (let i = 1; i < reply.length; i += 7) assert.deepEqual(run([reply.slice(0, i), reply.slice(i)]).map(name), want, `split at ${i}`);
});
