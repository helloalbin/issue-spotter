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
		<li><strong>An AI model provider</strong> receives the facts you submit to produce the analysis.</li>
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
