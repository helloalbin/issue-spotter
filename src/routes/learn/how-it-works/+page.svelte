<script lang="ts">
	import ContentPage from '#lib/components/ContentPage.svelte';
	import { SITE_NAME } from '#lib/site.js';
</script>

<ContentPage
	title="How it works"
	lead="What happens between pressing Spot issues and seeing the analysis, and what to keep in mind when you read it."
>
	<h2>1. You paste the facts</h2>
	<p>
		Write or paste a short factual scenario, real or hypothetical. It needs at least 20 characters
		and can run to 12,000. Say who did what to whom and what harm, dispute or right is at stake. The
		more concrete the facts, the better the issues.
	</p>

	<h2>2. A quick check</h2>
	<p>
		{SITE_NAME} first checks that the text reads like a legal fact pattern. If it contains clear
		legal vocabulary, it goes straight on. If not, a small, cheap model check decides. A text that is
		not a fact pattern is turned back with a note, your text stays where it is, and the search is
		normally not counted against your day.
	</p>

	<h2>3. The analysis</h2>
	<p>
		A language model reads the facts and returns four things. It uses the jurisdiction the facts
		imply and defaults to Indian law.
	</p>
	<ul>
		<li><strong>Primary legal issues:</strong> the questions a court would need to answer.</li>
		<li><strong>Relevant doctrines:</strong> the principles that govern those questions.</li>
		<li><strong>Landmark precedents:</strong> decisions worth reading for each issue.</li>
		<li>
			<strong>Applicable acts and sections:</strong> the statutes and provisions to open first.
		</li>
	</ul>

	<h2>4. Adding more facts</h2>
	<p>
		The box under the analysis is for more facts about the same case: what you remembered, or what
		happened next. {SITE_NAME} puts them together with everything you have already given and reads
		the whole case again, so the new analysis replaces the old one and covers all of it. Each added
		message counts as one search. To start a different case, use New analysis.
	</p>

	<h2>5. What to keep in mind</h2>
	<ul>
		<li>
			<strong>It can be wrong.</strong> The model can miss an issue, misstate the law, or name a case
			or section that does not exist. It does not look anything up in a case-law database.
		</li>
		<li>
			<strong>Verify before you cite.</strong> Open the bare act and the judgment itself. Treat the
			output as a checklist to compare with your own reasoning, not as an answer.
		</li>
		<li>
			<strong>It is not legal advice.</strong> It is a study aid for practising issue-spotting.
		</li>
	</ul>

	<h2>6. Daily searches</h2>
	<p>
		Each analysis counts as one search. Visitors who are not signed in get a small number a day;
		signing in with Google raises it. If a search fails on our side, it is given back. The counter
		resets once a day and the page shows the time in your own time zone.
	</p>

	<h2>7. Your data</h2>
	<p>
		We do not store your case facts. They are sent to an AI model provider to produce the analysis.
		See the <a href="/privacy">privacy policy</a> for the details, and avoid entering confidential
		client information.
	</p>
</ContentPage>
