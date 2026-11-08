<script lang="ts">
	import ContentPage from '#lib/components/ContentPage.svelte';
	import { CONTACT_EMAIL, LEGAL_UPDATED, SITE_NAME } from '#lib/site.js';
</script>

<ContentPage title="Privacy Policy" updated={LEGAL_UPDATED}>
	<p>
		{SITE_NAME} is a study aid for law students and junior advocates. This page explains what we
		collect when you use it, why, and who else handles it. We have tried to keep it short and
		specific. Questions go to <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.
	</p>

	<h2>The facts you type</h2>
	<p>
		When you press Spot issues, the text you typed is sent to a third-party AI model provider so it
		can produce the analysis. We do not save your case facts in our own database. The provider
		handles that text under its own terms and may keep it for a period we do not control.
	</p>
	<p>
		<strong>Do not enter confidential, privileged or identifying information about real clients or
		cases.</strong> Use hypothetical or anonymised facts.
	</p>

	<h2>What we collect</h2>
	<ul>
		<li>
			<strong>If you do not sign in:</strong> a random ID stored in a cookie, and a scrambled
			(hashed) form of your IP address. We use them only to count how many searches you have made
			today and to limit abuse. We cannot turn the hash back into your IP address.
		</li>
		<li>
			<strong>If you sign in with Google:</strong> your Google account ID, name and email address,
			which Google shares with us through Firebase Authentication. We use your account ID to count
			your daily searches and to know who you are when you return. We never see your Google
			password.
		</li>
		<li>
			<strong>Usage counts:</strong> a daily counter per visitor or account, and the number of
			tokens each model request used (a size measure, not the text itself). We also keep technical
			error logs.
		</li>
		<li>
			<strong>Network data:</strong> our hosting provider, Cloudflare, sees your IP address and
			request details because it delivers the site to you.
		</li>
	</ul>

	<h2>Files you upload</h2>
	<p>
		When you attach a PDF, a Word file or an image, the text is read in your browser (an image is
		shrunk first) and sent to our server and on to the AI model provider, so it can say what the
		file is, whether it is legal material, and what it says. An image is transcribed by the
		provider. We do not store the file or its text. They stay in your browser and are sent again,
		with your facts, each time the case is analysed. A file that is not legal material is not
		attached. We count uploads per day, using the same random ID and hashed IP address as your
		searches, so the feature cannot be abused. <strong>Do not upload confidential or privileged
		documents.</strong>
	</p>

	<h2>Drafts</h2>
	<p>
		A draft is written from the facts and files you give, by the same AI model provider, and is
		not stored by us. Copying or downloading it happens in your browser.
	</p>

	<h2>How pages are read</h2>
	<p>
		When a feature needs to read court or statute pages, our server fetches each page and passes it
		straight on to your browser, which reads it, including any PDF, and chooses the passages that
		matter. Only those passages, the page title and the opening of the text are sent back to us and
		on to the AI model provider. We do not store them. For a PDF, we also send its web address to
		the provider so that it can check quoted passages against the official file. We record a
		fingerprint (a hash) of each file and the time we fetched it, which appears in your report.
	</p>

	<h2>Deep research</h2>
	<p>
		Deep research sends your case and the point you ask about to the AI model provider, which
		searches court and statute websites (such as the Supreme Court of India and India Code) for
		pages to cite. Our server then fetches the pages it cited and sends their text, or the PDF's
		address, to the same provider to check each statement against them. The brief is not stored by us; it stays in your browser. We count runs per
		month, using the same random ID and hashed IP address as your searches.
	</p>

	<h2>Checking citations</h2>
	<p>
		The citations you paste, and the point each is cited for, are sent to the AI model provider,
		which splits them up and searches court and statute websites for each judgment. Our server then
		fetches those pages and sends their text to the same provider to check whether each says what
		you cite it for. The report is not stored by us; it stays in your browser. We count checks per
		month using the same random ID and hashed IP address as your searches.
	</p>

	<h2>Comparing cases</h2>
	<p>
		The names you give are sent to the AI model provider, which searches court and statute websites
		to find the two judgments. Our server then fetches those pages and sends their text, with the
		text of any later decision that may have overturned either, to the same provider to write the
		comparison. We do not store the result; it stays in your browser. We count comparisons per month
		and lookups per day, using the same random ID and hashed IP address as your searches.
	</p>

	<h2>Pages you add</h2>
	<p>
		When you add a link, our server fetches that one page from Indian Kanoon, India Code or the
		Supreme Court of India's site and reads its text. We do not store it. It stays in your browser,
		and it is sent to the AI model provider along with your facts every time the case is analysed,
		together with any skills you switched on. We count how many pages you add each day so the
		feature cannot be abused, using the same random ID and hashed IP address as your searches.
	</p>

	<h2>Checking references</h2>
	<p>
		When reference checking is on, the names of the cases, acts and sections in an analysis are sent
		to OpenAI's web search to look for their pages on legal sites. The facts you typed are not part
		of that request.
	</p>

	<h2>Links to other sites</h2>
	<p>
		References in an analysis link to a search on Indian Kanoon, or on Google when the facts point
		to another country's law. A link opens in a new tab and sends that site the case or section name
		in the address. We do not send them anything else, and their handling of it is their own. A link
		is a search, not a confirmation that a case or section exists.
	</p>

	<h2>Cookies and local storage</h2>
	<ul>
		<li>
			<code>anon_id</code> cookie: a random ID that counts anonymous searches. It lasts one year
			and is needed for the daily limit to work.
		</li>
		<li>
			<code>theme</code> in your browser's local storage: remembers whether you chose the light or
			dark theme. It never leaves your device.
		</li>
		<li>
			<code>pane</code> in local storage: remembers whether you hid the verification pane. It never
			leaves your device.
		</li>
		<li>
			If you sign in, Firebase keeps a sign-in session in your browser so you stay signed in.
		</li>
	</ul>
	<p>
		We do not use advertising or analytics trackers, and the site loads its fonts from our own
		server.
	</p>

	<h2>Who handles your data</h2>
	<ul>
		<li><strong>Cloudflare</strong> hosts the site and stores the daily search counters.</li>
		<li><strong>Google Firebase</strong> handles sign-in and stores your account details.</li>
		<li>
			<strong>An AI model provider</strong> receives the facts you submit, the files and pages you
			attach, and any skills you switch on, to produce the analysis or draft.
		</li>
		<li>
			<strong>OpenAI's web search</strong>, when reference checking is on, receives the names of
			the references to find their pages.
		</li>
	</ul>
	<p>We do not sell your data or use it for advertising.</p>

	<h2>How long we keep it</h2>
	<p>
		Search counters are small records tied to a random ID, an account ID or a hashed IP address. We
		keep them so the daily limits work, and we do not yet delete old ones automatically. Your
		account details stay until you ask us to remove them.
	</p>

	<h2>Your choices</h2>
	<p>
		You can use {SITE_NAME} without signing in, sign out at any time, and clear your cookies and
		local storage in your browser. To ask what we hold about you, to correct it, or to delete your
		account data, email <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.
	</p>

	<h2>Who this is for</h2>
	<p>{SITE_NAME} is meant for adults. We do not knowingly collect data from children.</p>

	<h2>Changes</h2>
	<p>
		If we change what we collect or who handles it, we will update this page and its date. For
		changes that matter, we will say so on the site.
	</p>
</ContentPage>
