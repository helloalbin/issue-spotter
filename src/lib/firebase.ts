import { getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth } from 'firebase/auth';

export { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

export type FirebaseConfig = {
	apiKey: string;
	authDomain: string;
	projectId: string;
	appId: string;
	/** Local Auth emulator URL, for development only. */
	emulatorUrl?: string;
};

let auth: Auth | undefined;

/** Browser only. Firebase's web config is public; no secret is involved. */
export function getFirebaseAuth(config: FirebaseConfig): Auth {
	if (auth) return auth;
	const { emulatorUrl, ...options } = config;
	auth = getAuth(getApps().length ? getApp() : initializeApp(options));
	if (emulatorUrl) connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
	return auth;
}
