# issue-spotter

Case Law "Issue Spotter" for law students and junior advocates.

Paste an unformatted factual summary of a hypothetical case and the app returns:
- primary legal issues,
- relevant legal doctrines,
- potential landmark precedents.

## Tech
- SvelteKit
- Tailwind CSS
- TypeScript
- OpenAI-compatible Chat Completions API

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` with:
   ```bash
   OPENAI_API_KEY=your_api_key
   # Optional overrides
   # OPENAI_BASE_URL=https://api.openai.com/v1
   # OPENAI_MODEL=gpt-4o-mini
   ```
3. Run locally:
   ```bash
   npm run dev
   ```
