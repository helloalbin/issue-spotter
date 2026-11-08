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
	QUOTA_SALT: {
		description: 'Secret salt mixed into hashed IPs before they are stored. Set a long random value in production.',
		schema: (value) => value || 'dev-salt'
	},
	OPENAI_MODEL: {
		description: 'Model name used for issue-spotting analysis.',
		schema: (value) => value || 'gpt-4o-mini'
	}
});
