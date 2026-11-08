import { defineEnvVars } from '@sveltejs/kit/env';

function positiveInt(value: string | undefined, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const variables = defineEnvVars({
	OPENAI_API_KEY: {
		description: 'API key for the OpenAI-compatible chat completions provider.',
		schema: (value) => value
	},
	OPENAI_BASE_URL: {
		description: 'Base URL of the OpenAI-compatible chat completions API.',
		schema: (value) => value || 'https://api.openai.com/v1'
	},
	ANON_DAILY_LIMIT: {
		description: 'Searches per day for each anonymous browser.',
		schema: (value) => positiveInt(value, 5)
	},
	ANON_IP_DAILY_LIMIT: {
		description: 'Searches per day for each IP across all anonymous browsers (shared networks).',
		schema: (value) => positiveInt(value, 25)
	},
	QUOTA_REJECTION_MULTIPLIER: {
		description: 'Non-legal rejections are free up to this multiple of the daily limits.',
		schema: (value) => positiveInt(value, 3)
	},
	QUOTA_SALT: {
		// Validated at request time (see hooks.server.ts): secrets are not present when Workers builds.
		description: 'Secret salt mixed into hashed IPs before they are stored. Required in production.',
		schema: (value) => value ?? ''
	},
	CLASSIFIER_MAX_TOKENS: {
		description: 'Output token cap for the legal-or-not classifier call.',
		schema: (value) => positiveInt(value, 8)
	},
	ANALYSIS_MAX_TOKENS: {
		description: 'Output token cap for the full analysis call.',
		schema: (value) => positiveInt(value, 2000)
	},
	OPENAI_MODEL: {
		description: 'Model name used for issue-spotting analysis.',
		schema: (value) => value || 'gpt-4o-mini'
	}
});
