# Known Issues — `apps/mobile` UI/UX redesign

Deferred or deliberately-accepted items from the 9-stage redesign (`docs/REDESIGN_CHANGELOG.md`).
Nothing here is a regression introduced by the redesign - each is either pre-existing (and
confirmed as such in the original plan) or a scoping decision made explicit at the stage that
could have done it.

## Deferred (planned, not built)

- **Ring/bar fill animations + reduced-motion handling.** `ProgressRing`, `MacroBar`, `BarChart`
  render their fill level instantly on each data change rather than animating to it, and there is
  no `AccessibilityInfo.isReduceMotionEnabled()` check anywhere in the app yet. Planned for
  Stage 9; not built this pass.
- **Skeleton loaders.** Every screen's loading state is still `ActivityIndicator` (a spinner), not
  a content-shaped skeleton. Planned for Stage 9; not built.
- **Snackbar component (log success + Undo).** Deleting a food entry already confirms via
  `Alert.alert` (Stage 4), but there's no toast/snackbar anywhere - a successful log/save has no
  transient confirmation beyond the screen's own state changing. Planned for Stage 9; not built.
- **200% system font-scale audit.** Not checked on any screen (`docs/QA_REPORT.md`). The DOB
  Stepper bug found in Stage 8 (three Steppers in one row clipped a 4-digit year at *normal* text
  scale) is the kind of bug most likely to recur elsewhere under a doubled font scale - any screen
  with multiple fixed-width Steppers/chips side by side is the highest-risk candidate for a future
  pass to check first.
- **Compact/large density (`wm size` override) screenshots.** Not taken at any stage - only the
  AVD's native resolution was used.

## Pre-existing, not introduced by this redesign

- **`HomeScreen.todayDate()` uses the UTC date, not local time.** Between midnight and 05:30 IST,
  "today" on the Today tab is still showing yesterday. This is business logic (which calendar day
  a log belongs to), not a UI/UX concern, so it was explicitly out of scope for this pass per the
  original plan - flagged there as "document, not fix."

## Deliberate design choices worth knowing about, not defects

- **Macro colours (protein/carb/fat/fibre) are verified at the 3:1 large-text/graphics WCAG
  threshold against the surface colour, not the stricter 4.5:1 normal-text threshold**
  (`theme/contrast.test.ts`). This is intentional, not an oversight: every value these colours
  appear on (`MacroBar`, the Progress calorie bar's target line, badge dots) is always paired with
  a text label carrying the actual number - colour is never the sole carrier of the information,
  which is the condition WCAG's stricter threshold exists to protect against.
- **`CoachChatScreen` has no explicit `SafeAreaView`/bottom-inset handling** - it uses a bare
  `KeyboardAvoidingView` as its root (needed for the keyboard-avoiding behavior `Screen` doesn't
  support), unlike every other screen which goes through `Screen`'s `edges` prop. The native-stack
  header covers the top inset; on a gesture-navigation device the bottom input row has not been
  confirmed clear of the system gesture bar. Not changed this pass - noted for a future
  accessibility/motion-focused stage rather than fixed speculatively without a device to confirm
  against.

## Environment quirks, not product bugs

- **Intermittent `adb shell input tap` failures against the emulator** during this session's live
  verification - see `docs/QA_REPORT.md`'s dedicated section. Confirmed each time to be a dropped
  input event (re-dumping `uiautomator` bounds and retrying the identical tap always succeeded),
  not a real touch-target or responsiveness problem in the app.
