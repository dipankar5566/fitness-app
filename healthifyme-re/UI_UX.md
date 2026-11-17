# HealthifyMe v31.7 — UI/UX teardown (static)

_Reference for ideas/patterns only. Nothing here (assets, icons, strings, code) is copied into
`apps/` - our own identity lives in `apps/mobile/src/theme/tokens.ts`._

Source: `Healthify_+AI+Diet+&+Fitness_v31.7_APKPure.xapk` → `com.healthifyme.basic.apk`
(sha256 4df75e63…0505). Resources dumped with `aapt2 dump resources`; class inventory via REA/JADX
(evidence `ev_a6a4f740…` dashboard classes, `ev_c3c22a6a…` `DashboardViewOrder`). Static only -
no runtime screenshots, and Compose layout internals are obfuscated, so exact in-card spacing is
unknown.

## Two design generations ship side by side
- **Legacy (Android Views)**: red brand (`base_brand_color #E02E2E`, `brand_red #D50000`), with a
  different theme colour per tracker - nutrition orange `#FF5722`, water blue `#3596C9`, workout
  navy `#07409C`, weight purple `#673AB7`, steps teal `#01AD97`. Busy; every tracker looks like a
  different app.
- **Current "Brew" / `new_gen` (Compose)**: one calm brand colour + warm neutrals.
  - primary deep teal `#21695C`, ripple at 20% alpha, tonal surfaces `#EAF0EF` / `#D4F3EA`
  - background `#F5F5F4`, surface white, stroke `#E7E5E4`, separator `#D6D3D1`
  - text `#0C0A09`, secondary `#78716C`, hint `#A8A29E`, disabled `#C0B9BA`
  - error `#C91D25`, accent yellow `#C68508`, AI/coach accent green `#4BD098`
  - The neutral ramp is warm ("stone"), not cool grey - reads softer next to food photos.

## Typography
- Poppins regular / medium / semibold / bold; a separate tabular-figure font
  (`roboto_medium_numbers`) for metrics so numbers don't jitter.
- Scale (`BrewTheme.Text.*`): H3 24 · H4 20 · H5 16 · H6 14 · P3/C1 12 · C2 10.
  Hierarchy is carried mostly by weight (medium/semibold), not by many sizes.

## Spacing & shape
- 4 / 8 / 12 / 16 / 20 / 24 / 32 dp grid; 16dp default gutter.
- Buttons 48dp (32dp small). Cards 8–16dp padding, rounded, ~2dp elevation, 1dp hairline strokes.
- No ALL-CAPS buttons (`textAllCaps=false` on Brew button styles).

## Information architecture
- Top-level tabs (Home / Coach / Me evidenced by `menu_coach_tab`, `me_tab`, `TabsContentKt`) plus
  a quick-action FAB (`dashboard.fab`).
- **Home is one scrolling column of cards, ordered by the server** (`DashboardViewOrder`):
  `Header` (greeting + date strip - `onDateChanged`) → `Stories` / `GrowthBanner` → `Tabs` →
  **`NutritionTracker`** → `AllTrackers` → `WeightTracker` → `Appointments` → `Path`
  (+ CGM / medicine / symptom cards when relevant).
- **Nutrition card is the hero**: front = calorie ring (eaten vs budget) with a "Track Meal" top
  CTA and a photo-log middle CTA; flip side = protein / fat / carbs / fibre breakdown.
  Logging starts *from the card*, not from a menu of buttons.
- Compact tracker cards (water, steps, weight, sleep, workout) with a "goal reached" state.
- Food diary is grouped by meal (breakfast, morning snack, lunch, evening snack, dinner) with a
  per-meal calorie budget and "next food" suggestions.

## Takeaways applied to our app
1. One brand colour + warm neutral ramp + tabular numbers.
2. Bottom tabs instead of a list of buttons on Home.
3. Home = hero calorie ring card with macro bars and the logging CTAs on it, then meal sections,
   then a workout card.
4. Meal-grouped diary with per-meal subtotals and an inline "+ Add".
5. Fewer font sizes, hierarchy by weight; 48dp primary buttons; cards with hairline borders.
