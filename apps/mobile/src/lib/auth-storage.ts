import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "fitness.accessToken";
const ACCOUNT_ID_KEY = "fitness.accountId";
const IS_GUEST_KEY = "fitness.isGuest";
const EMAIL_KEY = "fitness.email";
// Set on sign-out, cleared on "Continue as guest" - GuestLoadingScreen reads this to decide whether
// a missing session means "open Welcome" (the user chose to sign out) vs "silently create a guest"
// (first launch ever, the historical behavior every existing session predates).
const SIGNED_OUT_KEY = "fitness.signedOut";

export interface GuestSession {
  accessToken: string;
  accountId: string;
  // Absent on every session saved before Google Sign-In existed - treated as a guest session (see
  // loadGuestSession below), since a guest was the only kind of session that could ever be saved then.
  isGuest?: boolean;
  email?: string;
}

export async function saveGuestSession(session: GuestSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  await SecureStore.setItemAsync(ACCOUNT_ID_KEY, session.accountId);
  await SecureStore.setItemAsync(IS_GUEST_KEY, session.isGuest === false ? "false" : "true");
  if (session.email) {
    await SecureStore.setItemAsync(EMAIL_KEY, session.email);
  } else {
    await SecureStore.deleteItemAsync(EMAIL_KEY);
  }
  await SecureStore.deleteItemAsync(SIGNED_OUT_KEY);
}

export async function loadGuestSession(): Promise<GuestSession | null> {
  const [accessToken, accountId, isGuestRaw, email] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(ACCOUNT_ID_KEY),
    SecureStore.getItemAsync(IS_GUEST_KEY),
    SecureStore.getItemAsync(EMAIL_KEY),
  ]);
  if (!accessToken || !accountId) {
    return null;
  }
  return {
    accessToken,
    accountId,
    isGuest: isGuestRaw === null ? true : isGuestRaw === "true",
    email: email ?? undefined,
  };
}

/** Clears the stored session (sign-out). Local SQLite data is wiped separately via
 * local-wipe.ts's wipeAccountData - this function only touches SecureStore. */
export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(ACCOUNT_ID_KEY),
    SecureStore.deleteItemAsync(IS_GUEST_KEY),
    SecureStore.deleteItemAsync(EMAIL_KEY),
  ]);
}

export async function markSignedOut(): Promise<void> {
  await SecureStore.setItemAsync(SIGNED_OUT_KEY, "true");
}

export async function wasSignedOut(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SIGNED_OUT_KEY)) === "true";
}

/** "Continue as guest" on WelcomeScreen clears just this flag (no session to save yet) and then
 * routes back to GuestLoading, which creates the fresh guest itself - saveGuestSession's own
 * SIGNED_OUT_KEY cleanup only fires once that guest session actually exists. */
export async function clearSignedOutFlag(): Promise<void> {
  await SecureStore.deleteItemAsync(SIGNED_OUT_KEY);
}
