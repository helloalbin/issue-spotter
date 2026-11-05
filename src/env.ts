import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	OPENAI_API_KEY: {
		description: 'API key for the OpenAI-compatible chat completions provider.',
		schema: (value) => value
	},
	OPENAI_BASE_URL: {
		description: 'Base URL of the OpenAI-compatible chat completions API.',
		schema: (value) => value || 'https://api.openai.com/v1'
	},
	OPENAI_MODEL: {
		description: 'Model name used for issue-spotting analysis.',
		schema: (value) => value || 'gpt-4o-mini'
	}
});
