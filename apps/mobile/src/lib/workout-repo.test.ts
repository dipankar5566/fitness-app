import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "./node-sqlite-test-db";
import type { SqlDb } from "./sql-db";
import {
  applyRemoteSessions,
  applyRemoteSets,
  endSession,
  getActiveSession,
  getDirtySessions,
  getDirtySets,
  getLastUsedProgramDayId,
  insertSession,
  insertSet,
  listSetsForExercise,
  listSetsForSession,
  markSessionClean,
  markSetClean,
  type LocalWorkoutSession,
  type LocalWorkoutSet,
} from "./workout-repo";

const SESSION: LocalWorkoutSession = {
  id: "11111111-1111-1111-1111-111111111111",
  accountId: "account-1",
  programDayId: null,
  startedAt: "2026-11-16T08:00:00.000Z",
  endedAt: null,
  isDeleted: false,
  updatedAt: "2026-11-16T08:00:00.000Z",
};

const SET: LocalWorkoutSet = {
  id: "22222222-2222-2222-2222-222222222222",
  accountId: "account-1",
  sessionId: SESSION.id,
  exerciseId: "Bench_Press",
  exerciseName: "Bench Press",
  setNo: 1,
  reps: 8,
  weightKg: 60,
  rpe: 8,
  isWarmup: false,
  isDeleted: false,
  updatedAt: "2026-11-16T08:05:00.000Z",
};

describe("workout-repo", () => {
  let db: SqlDb;

  beforeEach(async () => {
    db = await createTestDb();
  });

  it("round-trips a session through insertSession and getActiveSession", async () => {
    await insertSession(db, SESSION);

    expect(await getActiveSession(db, "account-1")).toEqual(SESSION);
  });

  it("getActiveSession returns null once the session has ended", async () => {
    await insertSession(db, SESSION);
    await endSession(db, SESSION.id, "2026-11-16T09:00:00.000Z", "2026-11-16T09:00:00.000Z");

    expect(await getActiveSession(db, "account-1")).toBeNull();
  });

  it("getLastUsedProgramDayId finds the most recent session's day among a program's own days", async () => {
    const dayOne = { ...SESSION, id: "55555555-5555-5555-5555-555555555555", programDayId: "day-1", startedAt: "2026-11-14T08:00:00.000Z" };
    const dayTwo = { ...SESSION, id: "66666666-6666-6666-6666-666666666666", programDayId: "day-2", startedAt: "2026-11-16T08:00:00.000Z" };
    await insertSession(db, dayOne);
    await insertSession(db, dayTwo);

    expect(await getLastUsedProgramDayId(db, "account-1", ["day-1", "day-2"])).toBe("day-2");
  });

  it("getLastUsedProgramDayId returns null when no session has ever used any of those days", async () => {
    await insertSession(db, SESSION); // programDayId: null

    expect(await getLastUsedProgramDayId(db, "account-1", ["day-1", "day-2"])).toBeNull();
  });

  it("round-trips a set through insertSet and listSetsForSession, including exerciseName", async () => {
    await insertSession(db, SESSION);
    await insertSet(db, SET);

    expect(await listSetsForSession(db, SESSION.id)).toEqual([SET]);
  });

  it("listSetsForExercise finds a set's history across sessions, for lifetime PR comparison", async () => {
    const earlierSession: LocalWorkoutSession = { ...SESSION, id: "33333333-3333-3333-3333-333333333333" };
    const earlierSet: LocalWorkoutSet = { ...SET, id: "44444444-4444-4444-4444-444444444444", sessionId: earlierSession.id };
    await insertSession(db, earlierSession);
    await insertSet(db, earlierSet);
    await insertSession(db, SESSION);
    await insertSet(db, SET);

    const history = await listSetsForExercise(db, "account-1", SET.exerciseId);
    expect(history.map((s) => s.id).sort()).toEqual([earlierSet.id, SET.id].sort());
  });

  it("marks a dirty session/set clean only for the exact pushed version", async () => {
    await insertSession(db, SESSION);
    await insertSet(db, SET);

    expect(await getDirtySessions(db)).toEqual([SESSION]);
    expect(await getDirtySets(db)).toEqual([SET]);

    await markSessionClean(db, SESSION.id, SESSION.updatedAt);
    await markSetClean(db, SET.id, SET.updatedAt);

    expect(await getDirtySessions(db)).toEqual([]);
    expect(await getDirtySets(db)).toEqual([]);
  });

  it("applyRemoteSessions overwrites a clean local session but leaves a dirty edit untouched", async () => {
    await insertSession(db, SESSION);
    await markSessionClean(db, SESSION.id, SESSION.updatedAt);

    await applyRemoteSessions(db, [{ ...SESSION, endedAt: "2026-11-16T09:00:00.000Z", updatedAt: "2026-11-16T09:00:00.000Z" }]);
    expect(await getActiveSession(db, "account-1")).toBeNull(); // now ended, per the pulled row
  });

  it("applyRemoteSessions ignores a pull older than an unpushed local edit", async () => {
    // Dirty local edit at T1 (still active, never ended); an incoming pull from before that edit
    // (T0 < T1) must not overwrite it - the push-in-flight exception from ARCHITECTURE.md §3.
    await insertSession(db, { ...SESSION, updatedAt: "2026-11-16T09:30:00.000Z" });

    await applyRemoteSessions(db, [
      { ...SESSION, endedAt: "2026-11-16T09:00:00.000Z", updatedAt: "2026-11-16T09:00:00.000Z" },
    ]);

    expect(await getActiveSession(db, "account-1")).not.toBeNull();
  });

  it("applyRemoteSets preserves the local exerciseName snapshot across a pull", async () => {
    await insertSession(db, SESSION);
    await insertSet(db, SET);
    await markSetClean(db, SET.id, SET.updatedAt);

    await applyRemoteSets(db, [
      {
        id: SET.id,
        accountId: SET.accountId,
        sessionId: SET.sessionId,
        exerciseId: SET.exerciseId,
        setNo: SET.setNo,
        reps: 10, // changed on another device
        weightKg: SET.weightKg,
        rpe: SET.rpe,
        isWarmup: SET.isWarmup,
        isDeleted: SET.isDeleted,
        updatedAt: "2026-11-16T08:10:00.000Z",
      },
    ]);

    const [updated] = await listSetsForSession(db, SESSION.id);
    expect(updated.reps).toBe(10);
    expect(updated.exerciseName).toBe("Bench Press"); // not wiped to null
  });
});
