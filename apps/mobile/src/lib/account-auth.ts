import { signInWithGoogle as apiSignInWithGoogle } from "./api";
import { clearSession, loadGuestSession, markSignedOut, saveGuestSession } from "./auth-storage";
import { signInWithGooglePrompt, signOutOfGoogle } from "./google-auth";
import { wipeAccountData } from "./local-wipe";
import type { SqlDb } from "./sql-db";
import { syncNow } from "./sync-engine";

// Same eight syncable tables sync-engine.ts pushes - a dirty row here means a push attempt either
// never ran (offline) or failed, so sign-out/merge need to know before they wipe local data.
const DIRTY_TABLES = [
  "food_log",
  "custom_food",
  "custom_food_ingredient",
  "workout_session",
  "workout_set",
  "body_metric",
  "water_log",
  "fasting_log",
] as const;

export async function countDirtyRows(db: SqlDb): Promise<number> {
  let total = 0;
  for (const table of DIRTY_TABLES) {
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM ${table} WHERE is_dirty = 1`);
    total += row?.count ?? 0;
  }
  return total;
}

/** Best-effort sync: swallows everything, since both callers below only want "did it get pushed",
 * never a hard failure - a stale/expired token here shouldn't block signing in or out. */
async function trySyncNow(db: SqlDb, apiUrl: string, accessToken: string): Promise<void> {
  try {
    await syncNow(db, apiUrl, accessToken);
  } catch {
    // Already tracked inside syncNow itself (sync_offline/sync_failed) - nothing more to do here.
  }
}

export interface GoogleSignInOutcome {
  accountId: string;
  email: string;
  merged: boolean;
}

/**
 * Full Google sign-in flow (the plan's "sign-in flow"): push the device's unsynced guest data
 * first, open the native Google prompt, call the server, then either keep local data (upgrade in
 * place, same account id) or wipe-and-repull (merge into an existing account, different id).
 * Navigation/UI feedback is the caller's job - this only moves data and the stored session.
 */
export async function signInWithGoogleFlow(db: SqlDb, apiUrl: string): Promise<GoogleSignInOutcome> {
  const existing = await loadGuestSession();
  if (existing) {
    await trySyncNow(db, apiUrl, existing.accessToken);
  }

  const idToken = await signInWithGooglePrompt();
  const result = await apiSignInWithGoogle(apiUrl, idToken, existing?.accessToken);
  const merged = existing !== null && existing.accountId !== result.accountId;

  if (merged) {
    await wipeAccountData(db);
  }
  await saveGuestSession({
    accessToken: result.accessToken,
    accountId: result.accountId,
    isGuest: false,
    email: result.email,
  });
  if (merged) {
    await trySyncNow(db, apiUrl, result.accessToken);
  }

  return { accountId: result.accountId, email: result.email, merged };
}

export type SignOutResult = "signed_out" | "cancelled" | "no_session";

/**
 * Signs out of the current account (the plan's "sign-out flow"): pushes any unsynced data, lets the
 * caller confirm before proceeding if some couldn't be pushed, then clears the native Google
 * session, the stored session, and all local account data. `confirmDataLoss` is injected so this
 * stays testable without react-native's Alert - the Me tab screen supplies the real dialog.
 */
export async function signOutFlow(
  db: SqlDb,
  apiUrl: string,
  confirmDataLoss: (unsyncedCount: number) => Promise<boolean>,
): Promise<SignOutResult> {
  const session = await loadGuestSession();
  if (!session) return "no_session";

  await trySyncNow(db, apiUrl, session.accessToken);
  const unsynced = await countDirtyRows(db);
  if (unsynced > 0) {
    const proceed = await confirmDataLoss(unsynced);
    if (!proceed) return "cancelled";
  }

  await signOutOfGoogle();
  await clearSession();
  await wipeAccountData(db);
  await markSignedOut();
  return "signed_out";
}
