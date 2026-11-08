<script lang="ts">
	import ContentPage from '#lib/components/ContentPage.svelte';
	import { SITE_NAME } from '#lib/site.js';
</script>

<ContentPage
	title="Issue-spotting guide"
	lead="A routine for turning a page of facts into a list of legal questions, and for writing them up so a marker can follow your reasoning."
>
	<h2>What issue spotting is</h2>
	<p>
		An issue is a question a court would have to answer, either about the law or about how the law
		applies to the facts. Spotting issues means reading a fact pattern and naming those questions
		before you try to answer any of them.
	</p>

	<h2>A routine that works</h2>
	<ul>
		<li>
			<strong>Read twice.</strong> Once for the story, then again with a pen, marking the facts that
			seem to matter: dates, promises, injuries, notices, who knew what.
		</li>
		<li>
			<strong>List the parties and how they relate.</strong> Landlord and tenant, employer and
			employee, buyer and seller, stranger and stranger. The relationship often decides which branch
			of law applies.
		</li>
		<li>
			<strong>Name the harm or the dispute.</strong> What does each side want, and what stands in the
			way?
		</li>
		<li>
			<strong>Map to branches of law.</strong> One set of facts often touches several: contract,
			tort, property, criminal law, consumer law. Do not stop at the first one you find.
		</li>
		<li>
			<strong>Break each issue into its elements.</strong> Negligence needs a duty, a breach,
			causation and damage. Breach of contract needs a valid contract, a failure to perform and a
			loss. Each element can become its own sub-issue.
		</li>
		<li>
			<strong>Look for the other side.</strong> What defences exist, what would the opponent argue,
			and which facts cut against your side?
		</li>
		<li>
			<strong>Check remedies and limits.</strong> What can be claimed (damages, an injunction), and
			are there questions of jurisdiction or limitation?
		</li>
	</ul>

	<h2>Writing it up: IRAC</h2>
	<p>For each issue, work through four steps.</p>
	<ul>
		<li><strong>Issue:</strong> state the question in one sentence.</li>
		<li><strong>Rule:</strong> state the law that governs it, with the statute or case.</li>
		<li>
			<strong>Application:</strong> apply the rule to these facts, using the facts themselves, and
			give the counter-argument.
		</li>
		<li><strong>Conclusion:</strong> say which way it probably goes and why.</li>
	</ul>

	<h2>A short example</h2>
	<p>
		A tenant slips on a wet staircase after repeated written complaints to the landlord about a leak,
		and breaks an ankle. Reading the facts, you might list these issues.
	</p>
	<ul>
		<li>Did the landlord owe the tenant a duty of care, and was it breached by ignoring the complaints?</li>
		<li>Did the lease or the Transfer of Property Act create a duty to repair?</li>
		<li>Did the leak cause the fall, and is the injury too remote to claim for?</li>
		<li>Does the tenant's own conduct, such as walking there knowing of the leak, reduce the claim?</li>
		<li>What damages can be claimed: medical costs, lost income, pain and suffering?</li>
	</ul>
	<p>
		Notice that the facts about repeated written complaints do two jobs: they point to a breach, and
		they point to the landlord's knowledge.
	</p>

	<h2>Common mistakes</h2>
	<ul>
		<li>Jumping to a conclusion before listing the issues.</li>
		<li>Stating a rule without applying it to the facts.</li>
		<li>Naming a case you half remember. Cite only what you can check.</li>
		<li>Ignoring facts that weaken your side.</li>
		<li>Forgetting remedies, or the issue that sits behind the obvious one.</li>
	</ul>

	<h2>Using {SITE_NAME} with this routine</h2>
	<p>
		Try the issues yourself first, then run the facts and compare. Look for what it found that you
		missed, and what you found that it did not. Then check every case and section it names against a
		primary source, because it can get them wrong.
	</p>
</ContentPage>
