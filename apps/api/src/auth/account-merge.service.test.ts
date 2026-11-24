import { describe, expect, it, vi } from "vitest";
import { AccountMergeService } from "./account-merge.service.js";

function fakeClient(responses: Record<string, { rowCount: number }>) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = vi.fn().mockImplementation((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    for (const [needle, result] of Object.entries(responses)) {
      if (sql.includes(needle)) return Promise.resolve(result);
    }
    return Promise.resolve({ rowCount: 0 });
  });
  return { client: { query }, calls };
}

describe("AccountMergeService", () => {
  it("keeps the guest's profile when the target has none, and deletes it when the target already has one", async () => {
    const merge = new AccountMergeService();

    const noTarget = fakeClient({ "SELECT 1 FROM app.profile": { rowCount: 0 } });
    await merge.mergeGuestInto(noTarget.client as never, "guest-1", "target-1");
    expect(noTarget.calls.some((c) => c.sql.includes("UPDATE app.profile") && c.params[0] === "target-1")).toBe(
      true,
    );
    expect(noTarget.calls.some((c) => c.sql.startsWith("DELETE FROM app.profile"))).toBe(false);

    const hasTarget = fakeClient({ "SELECT 1 FROM app.profile": { rowCount: 1 } });
    await merge.mergeGuestInto(hasTarget.client as never, "guest-1", "target-1");
    expect(hasTarget.calls.some((c) => c.sql.startsWith("DELETE FROM app.profile") && c.params[0] === "guest-1")).toBe(
      true,
    );
  });

  it("deactivates the guest's goals before moving them when the target already has an active goal", async () => {
    const merge = new AccountMergeService();
    const { client, calls } = fakeClient({ "SELECT 1 FROM app.goal WHERE account_id = $1 AND is_active": { rowCount: 1 } });

    await merge.mergeGuestInto(client as never, "guest-1", "target-1");

    const deactivate = calls.find(
      (c) => c.sql.includes("UPDATE app.goal SET is_active = false") && c.params[0] === "guest-1",
    );
    expect(deactivate).toBeDefined();
    const move = calls.find((c) => c.sql.includes("UPDATE app.goal SET account_id"));
    expect(move?.params).toEqual(["target-1", "guest-1"]);
  });

  it("does not deactivate the guest's goals when the target has no active goal", async () => {
    const merge = new AccountMergeService();
    const { client, calls } = fakeClient({});

    await merge.mergeGuestInto(client as never, "guest-1", "target-1");

    expect(calls.some((c) => c.sql.includes("UPDATE app.goal SET is_active = false"))).toBe(false);
  });

  it("drops a guest's per-day cache row when the target already has that date", async () => {
    const merge = new AccountMergeService();
    const { client, calls } = fakeClient({});

    await merge.mergeGuestInto(client as never, "guest-1", "target-1");

    expect(
      calls.some(
        (c) => c.sql.includes("DELETE FROM app.coach_daily_insight") && c.params[0] === "guest-1" && c.params[1] === "target-1",
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) => c.sql.includes("DELETE FROM app.meal_plan") && c.params[0] === "guest-1" && c.params[1] === "target-1",
      ),
    ).toBe(true);
  });

  it("reassigns every syncable table's account_id and bumps server_updated_at", async () => {
    const merge = new AccountMergeService();
    const { client, calls } = fakeClient({});

    await merge.mergeGuestInto(client as never, "guest-1", "target-1");

    for (const table of [
      "app.custom_food",
      "app.custom_food_ingredient",
      "app.food_log",
      "app.workout_session",
      "app.workout_set",
      "app.body_metric",
      "app.water_log",
      "app.fasting_log",
    ]) {
      const call = calls.find((c) => c.sql.includes(`UPDATE ${table} SET account_id`));
      expect(call?.sql).toContain("server_updated_at = now()");
      expect(call?.params).toEqual(["target-1", "guest-1"]);
    }
  });

  it("soft-deletes the guest account at the end", async () => {
    const merge = new AccountMergeService();
    const { client, calls } = fakeClient({});

    await merge.mergeGuestInto(client as never, "guest-1", "target-1");

    const last = calls.at(-1);
    expect(last?.sql).toContain("UPDATE app.account SET deleted_at = now()");
    expect(last?.params).toEqual(["guest-1"]);
  });
});
