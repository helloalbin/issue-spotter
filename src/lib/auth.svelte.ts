import {
	FIREBASE_API_KEY,
	FIREBASE_APP_ID,
	FIREBASE_AUTH_DOMAIN,
	FIREBASE_AUTH_EMULATOR_URL,
	FIREBASE_PROJECT_ID
} from '$app/env/public';
import type { Auth } from 'firebase/auth';

type Firebase = typeof import('#lib/firebase.js');

/** Who is signed in. Browser-only state: nothing here is set while rendering on the server. */
class AuthStore {
	readonly configured = Boolean(
		FIREBASE_API_KEY && FIREBASE_AUTH_DOMAIN && FIREBASE_PROJECT_ID && FIREBASE_APP_ID
	);
	user = $state<{ name: string | null; email: string | null } | null>(null);
	/** True once the Firebase SDK has loaded and sign-in can start. */
	ready = $state(false);
	signingIn = $state(false);
	error = $state('');
	dialogOpen = $state(false);
	/** Counts sign-ins and sign-outs, so anything that depends on who is acting can refresh. */
	changes = $state(0);

	#firebase: Firebase | null = null;
	#auth: Auth | null = null;

	async init() {
		if (!this.configured || this.#auth) return;

		// The emulator is a development tool and is never used in a production build.
		const emulatorUrl = import.meta.env.PROD ? undefined : FIREBASE_AUTH_EMULATOR_URL;
		const firebase = await import('#lib/firebase.js');
		const auth = firebase.getFirebaseAuth({
			apiKey: FIREBASE_API_KEY!,
			authDomain: FIREBASE_AUTH_DOMAIN!,
			projectId: FIREBASE_PROJECT_ID!,
			appId: FIREBASE_APP_ID!,
			emulatorUrl
		});
		this.#firebase = firebase;
		this.#auth = auth;
		this.ready = true;
		firebase.onAuthStateChanged(auth, (current) => {
			this.user = current ? { name: current.displayName, email: current.email } : null;
			if (current) this.dialogOpen = false;
			this.changes += 1;
		});
	}

	/** The Firebase ID token (refreshed by the SDK when needed) as a request header, if signed in. */
	async headers(): Promise<Record<string, string>> {
		const token = await this.#auth?.currentUser?.getIdToken();
		return token ? { authorization: `Bearer ${token}` } : {};
	}

	async signIn() {
		if (!this.#firebase || !this.#auth) return;
		this.error = '';
		this.signingIn = true;
		try {
			await this.#firebase.signInWithPopup(this.#auth, new this.#firebase.GoogleAuthProvider());
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
				this.error = 'Sign-in failed. Please try again.';
			}
		} finally {
			this.signingIn = false;
		}
	}

	async signOut() {
		if (this.#firebase && this.#auth) await this.#firebase.signOut(this.#auth);
	}

	openDialog() {
		this.error = '';
		this.dialogOpen = true;
	}
}

export const auth = new AuthStore();
