import type { SqlDb } from "./sql-db";

export interface LocalWorkoutSession {
  id: string;
  accountId: string;
  programDayId: string | null;
  startedAt: string;
  endedAt: string | null;
  isDeleted: boolean;
  updatedAt: string;
}

export interface LocalWorkoutSet {
  id: string;
  accountId: string;
  sessionId: string;
  exerciseId: string;
  exerciseName: string | null;
  setNo: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
  isWarmup: boolean;
  isDeleted: boolean;
  updatedAt: string;
}

/** A row pulled from the server via GET /sync - the server has no exerciseName column (local-only
 * display snapshot), so a pulled row never carries one; the repo looks it up locally if needed. */
export type RemoteWorkoutSession = LocalWorkoutSession;
export type RemoteWorkoutSet = Omit<LocalWorkoutSet, "exerciseName">;

interface WorkoutSessionSqlRow {
  id: string;
  account_id: string;
  program_day_id: string | null;
  started_at: string;
  ended_at: string | null;
  is_deleted: number;
  updated_at: string;
}

interface WorkoutSetSqlRow {
  id: string;
  account_id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string | null;
  set_no: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: number;
  is_deleted: number;
  updated_at: string;
}

function fromSessionRow(row: WorkoutSessionSqlRow): LocalWorkoutSession {
  return {
    id: row.id,
    accountId: row.account_id,
    programDayId: row.program_day_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

function fromSetRow(row: WorkoutSetSqlRow): LocalWorkoutSet {
  return {
    id: row.id,
    accountId: row.account_id,
    sessionId: row.session_id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    setNo: row.set_no,
    reps: row.reps,
    weightKg: row.weight_kg,
    rpe: row.rpe,
    isWarmup: row.is_warmup === 1,
    isDeleted: row.is_deleted === 1,
    updatedAt: row.updated_at,
  };
}

// --- workout_session ---

export async function insertSession(db: SqlDb, row: LocalWorkoutSession): Promise<void> {
  await db.runAsync(
    `INSERT INTO workout_session (id, account_id, program_day_id, started_at, ended_at, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [row.id, row.accountId, row.programDayId, row.startedAt, row.endedAt, row.isDeleted ? 1 : 0, row.updatedAt],
  );
}

/** The most recent not-yet-ended session, if any - what WorkoutScreen resumes into on open. */
export async function getActiveSession(db: SqlDb, accountId: string): Promise<LocalWorkoutSession | null> {
  const row = await db.getFirstAsync<WorkoutSessionSqlRow>(
    `SELECT * FROM workout_session
     WHERE account_id = ? AND is_deleted = 0 AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
    [accountId],
  );
  return row ? fromSessionRow(row) : null;
}

export async function endSession(db: SqlDb, id: string, endedAt: string, updatedAt: string): Promise<void> {
  await db.runAsync(
    "UPDATE workout_session SET ended_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?",
    [endedAt, updatedAt, id],
  );
}

/** The program_day_id of the account's most recent session among `dayIds` (a followed program's
 * own days) - what nextProgramDayId (packages/shared) needs to pick today's day in the cycle.
 * Null if the account has never started a session for any of these days. */
export async function getLastUsedProgramDayId(
  db: SqlDb,
  accountId: string,
  dayIds: string[],
): Promise<string | null> {
  if (dayIds.length === 0) {
    return null;
  }
  const placeholders = dayIds.map(() => "?").join(", ");
  const row = await db.getFirstAsync<{ program_day_id: string }>(
    `SELECT program_day_id FROM workout_session
     WHERE account_id = ? AND program_day_id IN (${placeholders}) AND is_deleted = 0
     ORDER BY started_at DESC LIMIT 1`,
    [accountId, ...dayIds],
  );
  return row?.program_day_id ?? null;
}

/** Distinct local calendar days (started_at date prefix) with at least one non-deleted session
 * between two dates (inclusive) - feeds the Progress tab's workout-consistency grid
 * (packages/shared's buildWorkoutConsistency), which only needs "which days", not the sessions
 * themselves. */
export async function listSessionDaysBetween(
  db: SqlDb,
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT substr(started_at, 1, 10) AS day FROM workout_session
     WHERE account_id = ? AND is_deleted = 0 AND substr(started_at, 1, 10) BETWEEN ? AND ?`,
    [accountId, startDate, endDate],
  );
  return rows.map((row) => row.day);
}

export async function getDirtySessions(db: SqlDb): Promise<LocalWorkoutSession[]> {
  const rows = await db.getAllAsync<WorkoutSessionSqlRow>("SELECT * FROM workout_session WHERE is_dirty = 1");
  return rows.map(fromSessionRow);
}

export async function markSessionClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE workout_session SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

export async function applyRemoteSessions(db: SqlDb, rows: RemoteWorkoutSession[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number }>(
        "SELECT updated_at, is_dirty FROM workout_session WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO workout_session (id, account_id, program_day_id, started_at, ended_at, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, program_day_id = excluded.program_day_id,
           started_at = excluded.started_at, ended_at = excluded.ended_at,
           is_deleted = excluded.is_deleted, updated_at = excluded.updated_at, is_dirty = 0`,
        [row.id, row.accountId, row.programDayId, row.startedAt, row.endedAt, row.isDeleted ? 1 : 0, row.updatedAt],
      );
    }
  });
}

// --- workout_set ---

export async function insertSet(db: SqlDb, row: LocalWorkoutSet): Promise<void> {
  await db.runAsync(
    `INSERT INTO workout_set
       (id, account_id, session_id, exercise_id, exercise_name, set_no, reps, weight_kg, rpe, is_warmup, is_deleted, updated_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      row.id, row.accountId, row.sessionId, row.exerciseId, row.exerciseName, row.setNo, row.reps,
      row.weightKg, row.rpe, row.isWarmup ? 1 : 0, row.isDeleted ? 1 : 0, row.updatedAt,
    ],
  );
}

export async function listSetsForSession(db: SqlDb, sessionId: string): Promise<LocalWorkoutSet[]> {
  const rows = await db.getAllAsync<WorkoutSetSqlRow>(
    "SELECT * FROM workout_set WHERE session_id = ? AND is_deleted = 0 ORDER BY set_no",
    [sessionId],
  );
  return rows.map(fromSetRow);
}

/** Every non-deleted set ever logged for this exercise, across all sessions - the lifetime history
 * PR comparison needs (a PR is a lifetime record, not a per-session one). */
export async function listSetsForExercise(
  db: SqlDb,
  accountId: string,
  exerciseId: string,
): Promise<LocalWorkoutSet[]> {
  const rows = await db.getAllAsync<WorkoutSetSqlRow>(
    "SELECT * FROM workout_set WHERE account_id = ? AND exercise_id = ? AND is_deleted = 0",
    [accountId, exerciseId],
  );
  return rows.map(fromSetRow);
}

export async function getDirtySets(db: SqlDb): Promise<LocalWorkoutSet[]> {
  const rows = await db.getAllAsync<WorkoutSetSqlRow>("SELECT * FROM workout_set WHERE is_dirty = 1");
  return rows.map(fromSetRow);
}

export async function markSetClean(db: SqlDb, id: string, pushedUpdatedAt: string): Promise<void> {
  await db.runAsync("UPDATE workout_set SET is_dirty = 0 WHERE id = ? AND updated_at = ?", [id, pushedUpdatedAt]);
}

/**
 * Applies pulled set rows. The incoming row never has an exerciseName (server doesn't store one -
 * it's a local-only display snapshot), so an existing local name is preserved across the upsert
 * instead of being wiped to null.
 */
export async function applyRemoteSets(db: SqlDb, rows: RemoteWorkoutSet[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const local = await db.getFirstAsync<{ updated_at: string; is_dirty: number; exercise_name: string | null }>(
        "SELECT updated_at, is_dirty, exercise_name FROM workout_set WHERE id = ?",
        [row.id],
      );
      if (local && local.is_dirty === 1 && local.updated_at >= row.updatedAt) {
        continue;
      }
      await db.runAsync(
        `INSERT INTO workout_set
           (id, account_id, session_id, exercise_id, exercise_name, set_no, reps, weight_kg, rpe, is_warmup, is_deleted, updated_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT (id) DO UPDATE SET
           account_id = excluded.account_id, session_id = excluded.session_id, exercise_id = excluded.exercise_id,
           set_no = excluded.set_no, reps = excluded.reps, weight_kg = excluded.weight_kg, rpe = excluded.rpe,
           is_warmup = excluded.is_warmup, is_deleted = excluded.is_deleted, updated_at = excluded.updated_at,
           is_dirty = 0`,
        [
          row.id, row.accountId, row.sessionId, row.exerciseId, local?.exercise_name ?? null, row.setNo,
          row.reps, row.weightKg, row.rpe, row.isWarmup ? 1 : 0, row.isDeleted ? 1 : 0, row.updatedAt,
        ],
      );
    }
  });
}
