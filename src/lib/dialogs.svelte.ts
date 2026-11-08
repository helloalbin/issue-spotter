import type { ContactTopic } from '#lib/contact.js';

/** Which of the app-wide dialogs is open, and what the contact form starts with. */
class Dialogs {
	plansOpen = $state(false);
	contactOpen = $state(false);
	contactTopic = $state<ContactTopic | null>(null);
	contactMessage = $state('');

	openPlans() {
		this.contactOpen = false;
		this.plansOpen = true;
	}

	openContact(topic: ContactTopic | null = null, message = '') {
		this.plansOpen = false;
		this.contactTopic = topic;
		this.contactMessage = message;
		this.contactOpen = true;
	}
}

export const dialogs = new Dialogs();
