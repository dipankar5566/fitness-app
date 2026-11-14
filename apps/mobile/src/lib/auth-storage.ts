import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "fitness.accessToken";
const ACCOUNT_ID_KEY = "fitness.accountId";

export interface GuestSession {
  accessToken: string;
  accountId: string;
}

export async function saveGuestSession(session: GuestSession): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken);
  await SecureStore.setItemAsync(ACCOUNT_ID_KEY, session.accountId);
}

export async function loadGuestSession(): Promise<GuestSession | null> {
  const [accessToken, accountId] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(ACCOUNT_ID_KEY),
  ]);
  if (!accessToken || !accountId) {
    return null;
  }
  return { accessToken, accountId };
}
