# Aziz Revenue — Notification Root Cause Analysis & Native Redesign

Date: 2026-07-12 · Scope: full notification architecture + application audit

---

## 1. Root Cause

**The notification pipeline lived entirely inside the WebView. Android was only ever handed a small, finite batch of one-shot alarms, and the only code able to refill that batch was React.**

Exact mechanism (verified in code):

1. `src/utils/notifications.ts` pre-computed concrete future timestamps and scheduled them via `@capacitor/local-notifications`, capped at **4 slots per reminder** (`MAX_SCHEDULES_PER_REMINDER`) and **64 total** (`MAX_NATIVE_SCHEDULED_NOTIFICATIONS`).
2. With `reminderFrequencyHours = 1–2`, those 4 slots per reminder cover only **a few hours**.
3. The only refill path was `syncScheduledNotifications()` in `src/App.tsx`, triggered by a React `useEffect` and the `appStateChange` listener — i.e. **only while the WebView process is alive**.
4. Android kills the WebView process minutes after backgrounding. The pre-armed alarms fire, the queue drains, and **nothing re-arms it** → silence until the next app open, which re-runs the sync → notifications "come back".

This matches the reported symptom exactly. It was **not** `setInterval`/`setTimeout` (the alarms themselves were real AlarmManager alarms), but the *replenishment loop* was JS-lifecycle-bound — the same class of defect.

### Aggravating defects (each independently causes missed/late notifications)

| # | Defect | File | Effect |
|---|--------|------|--------|
| A | Schedules sent without `allowWhileIdle`, so the Capacitor plugin used `setExact(AlarmManager.RTC, …)` — **RTC, not RTC_WAKEUP** | plugin `LocalNotificationManager.setExactIfPossible()` | Alarms cannot wake the device; in Doze (screen off for hours) delivery is deferred until the user wakes the phone |
| B | On Android 12+ without the exact-alarm grant, plugin falls back to `set(RTC)` — inexact **and** non-waking | same | Indefinite deferral in Doze |
| C | Exact-alarm state never checked (`exactAlarmStatus` hardcoded to "غير معروف") | `notifications.ts` | No visibility, no remediation path for the user |
| D | No `MY_PACKAGE_REPLACED` handling (plugin only restores on boot) | plugin manifest | Every app update silently wiped all pending alarms until next open |
| E | Scheduling state (`fingerprint`, tracked IDs) in WebView `localStorage` | `notifications.ts` | Lost/desynced if WebView storage is evicted |
| F | Business data itself in `localStorage` | `src/data/store.tsx` | Native side had no access to reminder facts; also a data-durability risk (see audit) |

Permissions were **not** the problem — `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED` were all declared and granted. Confirmed the user's suspicion in spirit: notifications depended on React being alive.

> **Note on "Force stop":** pressing *Force stop* in App Info (visible in your screenshot) puts any Android app into the *stopped state* — the OS cancels all its alarms and blocks all broadcasts until the app is manually launched. No architecture can survive that; it is an OS guarantee. Avoid Force stop.

---

## 2. The Redesign — Native-Owned Scheduling

**Principle: JS declares *what* to remind; Android decides *when* and *fires without the WebView*.**

```
React (data changes)
   └─ buildReminderPlan()  ──["plan": facts + settings, no timestamps]──►
        NativeRemindersPlugin.setPlan()
             └─ ReminderEngine (native, persistent)
                  ├─ SharedPreferences: plan + delivered-ledger  (survives process death, updates, reboots)
                  ├─ computes next occurrence lazily → UNLIMITED horizon (weeks/months)
                  ├─ arms ONE setExactAndAllowWhileIdle(RTC_WAKEUP) alarm  ── chain: each firing re-arms the next
                  ├─ ReminderAlarmReceiver: posts due notifications + ledger dedupe + re-arm
                  ├─ ReminderBootReceiver: BOOT / QUICKBOOT / MY_PACKAGE_REPLACED / TIME_SET / TIMEZONE_CHANGED → re-arm
                  └─ ReminderMaintenanceWorker: WorkManager every 6 h — safety net if an OEM kills the alarm chain
```

Why this architecture (and not the alternatives you listed):

- **AlarmManager (exact, wake-up)** is the correct primitive for user-facing, time-critical reminders — Google's own guidance. Used as the primary trigger.
- **WorkManager** cannot guarantee timing (deferrable) — wrong as primary, ideal as the **redundant safety net**; it is OS-persisted and survives reboots by itself.
- **Foreground Service** would require a permanent notification and is battery-hostile; unnecessary since reminders are discrete points in time. Rejected.

### Reliability properties

| Requirement | How it is met |
|---|---|
| App closed / WebView destroyed | Engine is native; receivers/worker run without the Activity or WebView |
| Screen off / Doze | `setExactAndAllowWhileIdle(RTC_WAKEUP)`; windowed wake-up fallback if exact denied |
| Phone reboot | `ReminderBootReceiver` + plan in SharedPreferences → full restore, incl. delivery of slots missed while off (12 h catch-up) |
| App update | `MY_PACKAGE_REPLACED` re-arms (this was silently broken before) |
| App crash / process death | Alarm PendingIntents + WorkManager live in the OS, plan on disk |
| Not opened for weeks | Occurrences computed lazily at each firing — no 64-alarm horizon limit |
| No duplicates | Persistent delivered-ledger keyed `reminderId|channel|slot` (14-day TTL); one-time migration cancels all legacy Capacitor alarms so there is a single writer |
| No missed notifications | Chain + 6 h WorkManager sweep + boot/update/time-change re-arm; 12 h late-delivery window |
| Per-type sounds | Same channel IDs as before (`payment_reminders`, `contract_reminders`, `maintenance_reminders`) with `res/raw/payment_overdue.wav`, `contract_reminder.wav`; user's existing channel customizations preserved |
| Custom hours/intervals/days-before | Plan carries `windowStart/windowEnd/allDay/frequencyHours/rentReminderDays/contractReminderDays/reminderWindow` — engine reproduces the exact JS windowing semantics |

### Files changed / added

**New native (package `com.aziz.revenue`, in `android/app/src/main/java/com/example/fluffyturtletrot/`):**
- `ReminderEngine.java` — occurrence math (port of `buildReminderScheduleTimes`), Arabic title/body port, alarm chaining, delivery, dedupe
- `ReminderPlanStore.java` — SharedPreferences plan + delivered-ledger
- `ReminderAlarmReceiver.java`, `ReminderBootReceiver.java`, `ReminderMaintenanceWorker.java`
- `NativeRemindersPlugin.java` — `setPlan` / `getStatus` / `openExactAlarmSettings`
- `NotificationChannels.java` — single source of truth for channels/sounds

**Modified:**
- `MainActivity.java` — registers `NativeRemindersPlugin`
- `AndroidManifest.xml` — two receivers (alarm + boot/update/time-change)
- `app/build.gradle` — `androidx.work:work-runtime:2.9.1`
- `src/utils/notifications.ts` — native path now pushes a declarative plan (`buildReminderPlan`), one-time legacy-alarm migration, real exact-alarm status, `openExactAlarmSystemSettings()` export; web fallback and test-notification flow unchanged; public API surface unchanged (no changes needed in `NotificationSettingsPage`)

---

## 3. Testing Strategy

**Build verification (run first):**
```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

**ADB scenario tests (the ones that used to fail):**
```bash
# 1. Queue-drain: set frequency=1h, close app, wait > 4 slots → notifications must continue
# 2. Process death:
adb shell am kill com.aziz.revenue          # (NOT force-stop)
# 3. Doze:
adb shell dumpsys deviceidle force-idle
adb shell dumpsys deviceidle step           # verify alarm fired via:
adb shell dumpsys alarm | grep -A4 aziz
# 4. Reboot:
adb reboot                                   # do not open the app; reminder must arrive
# 5. Update:
./gradlew installDebug                       # reinstall over itself; reminder must survive
# 6. Time change: change device clock forward past a slot → catch-up delivery, no duplicates
# 7. Exact alarms revoked: Settings → Alarms & reminders → off → verify windowed fallback (≤15 min drift)
```

**Regression checks:** channel sounds per type (payment/contract/maintenance), overdue-disabled setting stops overdue rent notifications, disabling notifications cancels the alarm (`dumpsys alarm`), no duplicate on rapid open/close (ledger), test-notification button still works.

**Recommended unit tests (JVM/Robolectric):** `ReminderEngine.hashId` parity with JS, `timesOfDayMinutes` vs `getNotificationTimesForDay`, `nextForReminder` window edges (due day, window start, overdue tails 90/3 days), ledger TTL pruning.

> Environment note: the build could not be executed in this session's sandbox; run the Gradle + `tsc` verification above before shipping.

---

## 4. Application Audit (beyond notifications)

**Critical**
1. **Data durability — `src/data/store.tsx`:** the entire business dataset lives in one WebView `localStorage` key; `loadData()` does `catch { return EMPTY_DATA }` — a single corrupt JSON silently wipes the app, and the next auto-save overwrites the corrupt-but-recoverable blob. Recommendation: move to SQLite (`@capacitor-community/sqlite`) or at minimum Capacitor `Filesystem` with write-then-rename, a corruption quarantine (never overwrite a blob that failed to parse), and a local rolling backup. This also lets the native engine read facts directly in the future.
2. **Backup dependency:** Google Drive backup is the only recovery path for #1 — verify it runs on a schedule, not only manually (the new native `ReminderMaintenanceWorker` pattern can host an auto-backup worker).

**High**
3. **Synchronous full-dataset writes on every state change** (`saveData` in a `useEffect` on `data`): main-thread `JSON.stringify` of everything on each keystroke-level update; will jank as data grows. Debounce + move to async storage.
4. **Migrations run on every load** (`migratePayments`/`migrateContracts` on each start, results re-saved) with no schema version number. Add `schemaVersion` and run migrations once.
5. **Secrets/config:** Google OAuth client IDs in `capacitor.config.ts` are fine (public identifiers), but confirm the Drive scope stays `drive.file` (it does today — good, least privilege).

**Medium**
6. `versionCode 1 / versionName "1.0"` never bumped — breaks update flows and crash triage; automate versioning.
7. `allowMixedContent: true` in Capacitor config is unnecessary attack surface if all content is bundled — remove unless required.
8. `android:allowBackup="true"` backs up `localStorage`? No — WebView storage is excluded on many OEMs; do not rely on it; another reason for #1.
9. Duplicate-looking notifications in your screenshot (same text 6:58 PM and 7:58 PM) were the *designed* hourly repetition, not a bug; the ledger now also guarantees one delivery per slot even if alarm + worker race.
10. Financial math (`helpers.ts`): fee/net-transfer rounding is done with `Math.round(x*100)/100` in several independent places (`netOwnerAmount`, `migratePayments`, `calculateNetAmountToTransferToOwner`) — consolidate into one function to avoid drift; note `Math.round(gross * percent) / 100` in `migratePayments` line 46 rounds *before* dividing (loses cents vs. the other call sites) — worth a unit test and unification.

**Working well:** RTL is set (`supportsRtl`), Arabic copy is consistent, channel architecture is sound, `collectReminders` is a clean single source of reminder truth (which is exactly what made the native plan approach possible), Ejar parser has tests (`tests/ejarParser.test.mjs`) — extend that habit to the financial helpers.

---

## 5. What to do next

1. `npm run build && npx cap sync android && cd android && ./gradlew assembleDebug` → install.
2. Open the app once (pushes the first plan, runs the legacy-alarm migration).
3. In-app diagnostics now show real exact-alarm status; if it reads "غير مسموح", call `openExactAlarmSystemSettings()` from the settings page (one-line button hookup).
4. Run the ADB scenarios in §3.
5. Schedule the storage hardening (audit #1) as the next production priority — it is the same "single point of failure" class of defect the notifications had.
