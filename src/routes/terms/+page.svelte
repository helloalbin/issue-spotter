<script lang="ts">
	import LegalDocument from '#lib/components/LegalDocument.svelte';
	import { CONTACT_EMAIL, SITE_NAME } from '#lib/site.js';
</script>

<LegalDocument title="Terms of Use">
	<p>
		By using {SITE_NAME} you agree to these terms. If you do not agree, please do not use the
		service.
	</p>

	<h2>It is a study aid, not legal advice</h2>
	<p>
		{SITE_NAME} helps you practise issue-spotting. It does not give legal advice, and using it does
		not create a lawyer-client relationship. Do not rely on it for a real matter, a filing, an
		opinion or an exam submission without checking the law yourself.
	</p>

	<h2>The output can be wrong</h2>
	<p>
		The analysis is written by an AI model. It can miss issues, misstate the law, rely on outdated
		material, and name cases, acts or sections that do not exist or do not say what it claims.
		<strong>Always verify every citation and section against primary sources before using it.</strong>
		You are responsible for what you do with the output.
	</p>

	<h2>What you may and may not do</h2>
	<ul>
		<li>Do not submit confidential or privileged information about real clients or cases.</li>
		<li>Do not use the service to break the law or to harm, harass or deceive anyone.</li>
		<li>
			Do not try to get around the search limits, overload the service, scrape it automatically, or
			probe it for security weaknesses without our written permission.
		</li>
		<li>Do not resell or republish the service itself.</li>
	</ul>

	<h2>Accounts and limits</h2>
	<p>
		You can use {SITE_NAME} without an account for a small number of searches each day. Signed-in
		accounts get a higher limit. We may change these limits at any time. We may later add paid
		features or credits, which will come with their own terms before you are charged.
	</p>
	<p>
		You are responsible for activity on your account. We may suspend or remove access if these terms
		are broken or the service is being abused.
	</p>

	<h2>Your content</h2>
	<p>
		You keep ownership of the facts you submit. You allow us, and the AI provider we use, to process
		them so the service can produce your analysis. The privacy policy explains how that works.
	</p>

	<h2>The service as it is</h2>
	<p>
		{SITE_NAME} is an early version. It is provided as it is and as available, with no promise that
		it will be accurate, uninterrupted or error-free. To the extent the law allows, we are not
		liable for losses that come from using it or from relying on its output.
	</p>

	<h2>Changes</h2>
	<p>
		We may update these terms. The date at the top shows the latest version, and using the service
		after a change means you accept it.
	</p>

	<h2>Contact</h2>
	<p>Questions about these terms: <a href="mailto:{CONTACT_EMAIL}">{CONTACT_EMAIL}</a>.</p>
</LegalDocument>
