import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { GOOGLE_WEB_CLIENT_ID } from "./env";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
}

/** Opens the native Google Sign-In sheet and returns the ID token the server verifies
 * (apps/api's GoogleTokenVerifier). Throws if the user cancels or sign-in otherwise fails - callers
 * decide how to surface that (e.g. silently returning to the Welcome/Me screen). */
export async function signInWithGooglePrompt(): Promise<string> {
  ensureConfigured();
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  const idToken = result.data?.idToken;
  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token");
  }
  return idToken;
}

/** Clears the native Google session so the account picker reappears on the next sign-in attempt -
 * called from the app's own sign-out flow alongside clearSession()/wipeAccountData(). */
export async function signOutOfGoogle(): Promise<void> {
  ensureConfigured();
  await GoogleSignin.signOut();
}
