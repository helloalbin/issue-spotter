<script lang="ts">
	import ContentPage from '#lib/components/ContentPage.svelte';

	const terms = [
		['Actus reus', 'The physical element of an offence: the prohibited act, or a failure to act when the law requires it.'],
		['Burden of proof', 'The duty to prove a fact. In a civil case it usually rests on the person making the claim; in a criminal case it rests on the prosecution.'],
		['Cause of action', 'The set of facts that gives a person the right to bring a claim in court.'],
		['Causation', 'The link between a wrong and the harm that followed. Courts ask whether the harm would have happened without the wrong, and whether it is too remote.'],
		['Consideration', 'Something of value given in exchange for a promise. A contract generally needs it to be enforceable.'],
		['Contributory negligence', "A defence or a reduction: the claimant's own carelessness helped cause the harm, so the damages are lowered."],
		['Damages', 'Money awarded by a court to compensate a loss.'],
		['Defendant', 'The person a claim or case is brought against.'],
		['Doctrine', 'An established principle, or a body of rules built up by courts or statute, that governs a type of situation.'],
		['Duty of care', 'A legal obligation to take reasonable care so as not to harm others in circumstances the law recognises.'],
		['Injunction', 'A court order requiring a person to do something or to stop doing something.'],
		['Issue', 'A question of law or fact that a court has to decide.'],
		['Jurisdiction', 'The power of a court to hear a case, or the area or subject matter a court has authority over.'],
		['Limitation', 'The time limit for starting a claim. In India it is set largely by the Limitation Act, 1963.'],
		['Liquidated damages', 'A sum fixed in a contract in advance as the compensation for a breach.'],
		['Locus standi', 'The standing to bring a case: the right of a person to be heard because they are affected.'],
		['Mens rea', 'The mental element of an offence, such as intention or knowledge.'],
		['Obiter dictum', "A remark in a judgment that is not needed to decide the case. It can persuade, but it does not bind."],
		['Plaintiff', 'The person who brings a civil suit.'],
		['Precedent', 'An earlier decision that a court follows, or is guided by, when deciding a similar case.'],
		['Ratio decidendi', 'The legal reasoning on which a decision rests. This is the part of a judgment that binds later courts.'],
		['Remoteness of damage', 'The limit on recovery: a wrongdoer is liable only for harm that was a reasonably foreseeable result of the wrong.'],
		['Res ipsa loquitur', '"The thing speaks for itself." The accident is of a kind that does not normally happen without negligence, so negligence may be inferred.'],
		['Stare decisis', 'The practice of following earlier decisions so that like cases are treated alike.'],
		['Strict liability', 'Liability that does not depend on fault. India also recognises a stricter form, absolute liability, for hazardous industries.'],
		['Tort', 'A civil wrong, other than a breach of contract, for which the law gives a remedy, usually damages.'],
		['Vicarious liability', 'Liability for a wrong committed by someone else, for example an employer for an employee acting in the course of employment.'],
		['Void and voidable', 'A void agreement has no legal effect. A voidable contract is valid until the party entitled to do so sets it aside.'],
		['Volenti non fit injuria', 'A defence: a person who freely accepted a risk cannot complain of the harm that results.']
	];
</script>

<ContentPage
	title="Glossary"
	lead="Plain-language meanings of terms you will meet in issue-spotting. They are for study and are not authoritative, so check a textbook or the statute before relying on one."
	prose={false}
>
	<dl class="divide-y divide-border-subtle border-t border-border-subtle">
		{#each terms as [term, meaning]}
			<div class="py-4 sm:grid sm:grid-cols-[11rem_1fr] sm:gap-6">
				<dt class="type-label text-text-primary">{term}</dt>
				<dd class="mt-1 text-text-secondary sm:mt-0">{meaning}</dd>
			</div>
		{/each}
	</dl>
</ContentPage>
