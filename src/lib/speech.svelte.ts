import { RATES, chunkText, parsePrefs, pickVoice } from '#lib/speech.js';

const KEY = 'legalspotter:speech';

/**
 * Reading a result aloud with the browser's own speech engine: free, with nothing sent to us. The text
 * is spoken a sentence or two at a time, because some voices cut off a long utterance. Only one thing
 * is read at a time. The speed and voice are remembered in this browser.
 */
class Speech {
	/** The browser can speak at all. */
	supported = $state(false);
	status = $state<'idle' | 'speaking' | 'paused'>('idle');
	/** What is being read, so each result's button knows if it is the one speaking. */
	activeId = $state<string | null>(null);
	rate = $state<number>(1);

	#voiceURI: string | undefined;
	#voices: SpeechSynthesisVoice[] = [];
	#chunks: string[] = [];
	#index = 0;
	/** Tells one reading from the next, so a cancelled one cannot touch the state of a newer one. */
	#token = 0;

	/** Called once in the browser. */
	init() {
		if (this.supported || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
		try {
			const prefs = parsePrefs(localStorage.getItem(KEY));
			this.rate = prefs.rate;
			this.#voiceURI = prefs.voice;
		} catch {
			// No saved choice.
		}
		const load = () => (this.#voices = speechSynthesis.getVoices());
		load();
		// Voices arrive a moment after the page loads in some browsers.
		speechSynthesis.addEventListener('voiceschanged', load);
		this.supported = true;
	}

	#save() {
		try {
			localStorage.setItem(KEY, JSON.stringify({ rate: this.rate, ...(this.#voiceURI && { voice: this.#voiceURI }) }));
		} catch {
			// The choice still applies for this visit.
		}
	}

	/** Reads `script` if nothing is being read; pauses or resumes if this is what is being read. */
	toggle(id: string, script: string) {
		if (this.activeId === id) {
			if (this.status === 'speaking') this.pause();
			else if (this.status === 'paused') this.resume();
			return;
		}
		this.start(id, script);
	}

	start(id: string, script: string) {
		this.stop();
		const chunks = chunkText(script);
		if (chunks.length === 0) return;
		this.#chunks = chunks;
		this.#index = 0;
		this.activeId = id;
		this.status = 'speaking';
		this.#speak();
	}

	#speak() {
		const token = this.#token;
		const utterance = new SpeechSynthesisUtterance(this.#chunks[this.#index]);
		const voice = pickVoice(this.#voices, this.#voiceURI);
		if (voice) {
			utterance.voice = voice;
			utterance.lang = voice.lang;
		} else {
			utterance.lang = 'en-IN';
		}
		utterance.rate = this.rate;
		utterance.onend = () => {
			if (token !== this.#token) return;
			this.#index += 1;
			if (this.#index >= this.#chunks.length) this.stop();
			else this.#speak();
		};
		utterance.onerror = (event) => {
			// Our own cancels have already moved the token on, so they are ignored here. Anything that
			// still carries the current token, an engine failure or a cancel from outside, ends the reading.
			if (token !== this.#token) return;
			this.stop();
		};
		speechSynthesis.speak(utterance);
	}

	pause() {
		if (this.status !== 'speaking') return;
		speechSynthesis.pause();
		this.status = 'paused';
	}

	resume() {
		if (this.status !== 'paused') return;
		speechSynthesis.resume();
		this.status = 'speaking';
	}

	stop() {
		this.#token += 1;
		if (this.supported) speechSynthesis.cancel();
		this.status = 'idle';
		this.activeId = null;
		this.#chunks = [];
		this.#index = 0;
	}

	/** A new speed applies to the sentence being read as well as the ones to come. */
	setRate(rate: number) {
		if (!(RATES as readonly number[]).includes(rate)) return;
		this.rate = rate;
		this.#save();
		if (this.activeId === null) return;
		this.#token += 1;
		speechSynthesis.cancel();
		this.status = 'speaking';
		// A moment's gap, because some browsers drop speech started right after a cancel.
		setTimeout(() => this.activeId !== null && this.#speak(), 50);
	}

	/** The voice to use from now on (a voice's `voiceURI`); undefined goes back to the automatic choice. */
	setVoice(voiceURI: string | undefined) {
		this.#voiceURI = voiceURI;
		this.#save();
	}

	/** The voices the browser offers, for a settings page to list. */
	get voices(): SpeechSynthesisVoice[] {
		return this.#voices;
	}
}

export const speech = new Speech();
