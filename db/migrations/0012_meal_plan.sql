-- AI sample-day meal plan (PRD §5.5), cached one per account per day like
-- 0010_coach_daily_insight.sql: MealPlanService returns the cached row on a same-day hit, so a plan
-- costs at most one successful generation per account per day. payload is the validated MealPlan
-- JSON (packages/shared/src/meal-plan.ts) - server-generated and read-only on the client, so this is
-- not a syncable table and carries no id/is_deleted/updated_at sync shape. Idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS app.meal_plan (
    account_id  uuid NOT NULL REFERENCES app.account(id) ON DELETE CASCADE,
    plan_date   date NOT NULL,
    payload     jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, plan_date)
);

-- Food logged straight from a plan is tagged source = 'ai_plan', so it's distinguishable from manual
-- and AI-parsed entries. Drop-then-add keeps this re-runnable.
ALTER TABLE app.food_log DROP CONSTRAINT IF EXISTS food_log_source_check;
ALTER TABLE app.food_log ADD CONSTRAINT food_log_source_check
    CHECK (source IN ('manual', 'ai_text', 'ai_photo', 'barcode', 'ai_plan'));
