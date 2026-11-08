// Fails if a raw color appears anywhere in src/ except the token definitions.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS_FILE = join('src', 'routes', 'layout.css');
const EXTENSIONS = /\.(svelte|ts|js|css|html)$/;
const RAW_COLOR = /(?<![&\w])#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g;

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* walk(path);
		else if (EXTENSIONS.test(name)) yield path;
	}
}

const problems = [];
for (const file of walk('src')) {
	if (file === TOKENS_FILE) continue;
	readFileSync(file, 'utf8')
		.split('\n')
		.forEach((line, index) => {
			for (const match of line.matchAll(RAW_COLOR)) {
				problems.push(`${file}:${index + 1}: ${match[0]}`);
			}
		});
}

if (problems.length > 0) {
	console.error(`Raw colors found. Use a design token from ${TOKENS_FILE} instead:\n${problems.join('\n')}`);
	process.exit(1);
}
console.log('No raw colors outside the token definitions.');
