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
		The box under the analysis is for more facts about the same case: something you remembered, or
		what happened next. {SITE_NAME} reads the whole case again with your new facts included and
		adds an update below. The update leads with what changed: a headline, a short explanation, and
		the issues, doctrines, cases and acts that are new. What still applies is folded away and what
		no longer matters is listed apart. It also lists facts that are still unknown and would sharpen
		the case. Your earlier analysis stays where it is, so you can compare them.
		Each added message counts as one search. To start a different case, use New analysis.
	</p>

	<h2>5. Pages and skills</h2>
	<p>
		The + button next to the box opens a drawer. You can paste a link to a case or statute on
		Indian Kanoon, India Code or the Supreme Court site, and {SITE_NAME} reads the page and uses it
		as background for your case. Long pages are cut to their first part, and the page says so. Two
		skills change the analysis: <strong>Summarize</strong> adds a short plain-language summary of
		the facts, and <strong>Counter-args</strong> adds the strongest point the other side could make
		on each main issue. A skill stays on until you turn it off with the small x beside the box.
	</p>

	<h2>6. Uploading a file and drafting</h2>
	<p>
		Choose <strong>Upload files</strong> in the same drawer to attach a PDF, a Word (.docx) file or
		an image (PNG, JPEG or WebP). Other kinds of file cannot be attached. {SITE_NAME} reads the file
		and tells you what it is and what it says. If you send the file without typing anything, it
		answers with what it understood and asks what you would like to do next. If the file is not
		legal material at all, such as a recipe or a holiday photo, it says so and does not attach it.
		A scanned PDF with no text cannot be read: upload its pages as images instead.
	</p>
	<p>
		The <strong>Draft</strong> skill writes a first draft of a document for the facts you give: a
		police complaint or FIR, a complaint to a Magistrate, or a civil or criminal petition. Details
		it does not know are left in [square brackets] for you to fill in, and the section numbers are
		in brackets too, so you check them. It is a study draft, not a document ready to file.
	</p>

	<h2>7. Deep research</h2>
	<p>
		Once you have an analysis on screen, switch on <strong>Deep research</strong> in the drawer and
		name a point within your case to look into, such as what the law requires of an arresting
		officer. {SITE_NAME} searches court and statute sites (the Supreme Court of India, India Code,
		the e-Gazette and High Court sites, plus Indian Kanoon copies) and writes a short brief. Every
		statement carries the numbers of the pages it came from, and a statement with no page is marked
		<em>no source</em>. The app then opens the cited pages and writes the report from them, in a
		fixed layout: a numbered synopsis, the governing law, the key authorities, how it applies to your
		facts, what cuts the other way, and what could not be confirmed. A statement stays in the report
		only if the passage given for it is found on the page, and you can read each passage under
		<em>What the pages say</em>. Your own facts are applied by reasoning, which is marked
		<em>inference</em>. A topic outside your case is turned away and costs nothing. It is limited to
		a few runs a month because each one costs far more than a search. Read the pages before you
		rely on them.
	</p>

	<h2>8. Comparing two cases</h2>
	<p>
		Switch on <strong>Compare cases</strong> in the drawer and name two cases, by party names or part
		of a citation. {SITE_NAME} finds each judgment and opens its page to check it is the case you
		meant, then shows you the two cases to confirm. Only after you confirm does it compare them: first
		the facts, then what each court decided, where they agree and differ, and any later decision that
		reversed, doubted or followed either. The report uses the same layout and the same checks as deep
		research. Only Indian Kanoon pages can be compared for now. It is limited to a few comparisons a
		month.
	</p>

	<h2>9. Checking citations</h2>
	<p>
		Switch on <strong>Verify cites</strong> and paste up to five citations, with the point each is
		cited for if you can. {SITE_NAME} checks three things for each: that the judgment exists (a page
		about that case was found), that the details you wrote match it (the parties, the year, the court
		and the law-report reference), and that it says what you cite it for, with the passage quoted. The
		first two are worked out by the app itself. A citation it cannot find is not declared false, and a
		case that shares its party names with another is flagged. It does not check whether the case has
		since been overruled.
	</p>

	<h2>10. Where pages are read</h2>
	<p>
		The pages and PDFs a report is built from are fetched through {SITE_NAME} but read in your own
		browser, which picks out the relevant passages. Each source in a report shows a fingerprint of the
		file as it was fetched and when. Passages taken from a PDF are checked a second time by a model
		reading the official PDF.
	</p>

	<h2>11. What to keep in mind</h2>
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

	<h2>8. Daily searches</h2>
	<p>
		Each analysis counts as one search. Visitors who are not signed in get a small number a day;
		signing in with Google raises it. If a search fails on our side, it is given back. The counter
		resets once a day and the page shows the time in your own time zone.
	</p>

	<h2>9. Your data</h2>
	<p>
		We do not store your case facts. They are sent to an AI model provider to produce the analysis.
		See the <a href="/privacy">privacy policy</a> for the details, and avoid entering confidential
		client information.
	</p>
</ContentPage>
