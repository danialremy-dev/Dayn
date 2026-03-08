# How to review this code and turn it into a real app

This guide walks you through **reviewing** the codebase and **improving** it so it feels like a real, production-ready app.

---

## Part 1: Understand the structure

### Where everything lives

| Area | Path | What it does |
|------|------|--------------|
| **Screens (UI)** | `app/(tabs)/` | One file per tab: `index.tsx` (Today), `calendar.tsx`, `habits.tsx`, `sports.tsx`, `finance.tsx` |
| **Tab bar** | `app/(tabs)/_layout.tsx` | Defines the 5 tabs and their icons |
| **App shell** | `app/_layout.tsx` | Root layout, fonts, DB init, theme |
| **Database** | `src/db/` | SQLite schema and all data access |
| **Strava** | `src/strava/` | OAuth, token storage, API calls |
| **Shared UI** | `components/` | Themed `Text`/`View`; `constants/Colors.ts` for light/dark |
| **Helpers** | `src/utils/` | `dates.ts` (day keys), `id.ts` (UUIDs) |

### Data flow (how it works)

1. **Startup**: `app/_layout.tsx` calls `getDb()` → `src/db/client.ts` opens SQLite and runs migrations.
2. **Screens**: Each tab imports functions from `src/db/*` (e.g. `getTodosForDay`, `addTodo`) and calls them on button press or load.
3. **Strava**: Sports tab uses `src/strava/storage.ts` (SecureStore) for tokens and `src/strava/api.ts` for HTTP; imported activities are written via `src/db/sports.ts`.

So to **review** a feature, you follow: **screen → db/strava module → client**.

---

## Part 2: Run and test the app (review by using it)

### 1. Install and start

```bash
cd lifestyle-app
npm install
npm run start
```

- **Phone**: Install “Expo Go”, scan the QR code.
- **Android emulator**: Press `a` in the terminal (with emulator running).
- **Web**: Press `w` (some features like SQLite/SecureStore may be limited on web).

### 2. Test each area like a user

Use this checklist while you use the app:

| Tab | What to try | What to check |
|-----|-------------|---------------|
| **Today** | Add a to-do, mark habit done, mark to-do done | List updates; no crash on empty list |
| **Calendar** | Add an appointment (e.g. `2026-03-01 14:00`) | It appears under “Upcoming”; wrong format shows alert |
| **Habits** | Add a habit | It appears in “All habits” and on Today |
| **Sports** | Save Strava Client ID/Secret, Connect, Import | Activities list fills; goal saves |
| **Finance** | Add a goal and a debt | Both show in list with correct numbers |

If something doesn’t work, note the **tab** and **action** — that points you to the right file (see table in Part 1).

### 3. Review the code for that feature

- **Today**: `app/(tabs)/index.tsx` → `src/db/todos.ts`, `src/db/habits.ts`
- **Calendar**: `app/(tabs)/calendar.tsx` → `src/db/appointments.ts`
- **Habits**: `app/(tabs)/habits.tsx` → `src/db/habits.ts`
- **Sports**: `app/(tabs)/sports.tsx` → `src/strava/*`, `src/db/sports.ts`
- **Finance**: `app/(tabs)/finance.tsx` → `src/db/finance.ts`

Open the screen file first, then follow the imports to the db/strava modules. That’s your “review path” for each feature.

---

## Part 3: Turn it into a “real” app — what to improve

Treat these as a checklist. You don’t have to do everything at once.

### A. Reliability and errors

- [ ] **Loading states**  
  Screens don’t show a spinner; they just show data. Add a simple “Loading…” or `ActivityIndicator` until the first `getTodosForDay` / `getHabitsForToday` etc. finish (and handle DB errors).
- [ ] **Empty and error states**  
  You already have “No habits yet” style messages. Add explicit error messages (e.g. “Couldn’t load. Tap to retry”) and a retry action where it makes sense.
- [ ] **Validation**  
  Calendar already validates date format. Add validation for: goal/debt amounts (positive numbers), habit/todo non-empty title, Strava credentials non-empty before save.

### B. Data and persistence

- [ ] **Edits and deletes**  
  Right now you can only add. Add “edit” and “delete” for: appointments, habits, todos, goals, debts (and debt payments if you add them). That means new db functions (e.g. `updateTodo`, `deleteTodo`) and a way in the UI to trigger them (long-press menu or swipe).
- [ ] **Finance progress**  
  Goals have `current_amount` but no UI to update it. Add “Add progress” (e.g. +50) and show a simple progress bar (current/target).
- [ ] **Debt payments**  
  You have a `debt_payments` table. Add a screen or modal to log a payment and optionally decrease `current_balance` on the debt.

### C. UX polish

- [ ] **Scroll**  
  On small screens, Today/Calendar/Habits/Finance can overflow. Wrap content in `<ScrollView>` (or `FlatList` where you have long lists) so everything is reachable.
- [ ] **Feedback**  
  After “Add” or “Save”, show a short confirmation (e.g. “Saved” toast or a checkmark) so the user knows the action worked.
- [ ] **Keyboard**  
  On mobile, avoid the keyboard covering the “Add” button. Use `KeyboardAvoidingView` or scroll-to-input where needed.
- [ ] **Accessibility**  
  Add `accessibilityLabel` (and optionally `accessibilityHint`) to important buttons and inputs so screen readers work well.

### D. Strava and sports

- [ ] **Weekly goal view**  
  You store a weekly distance goal; add a small “This week: X km / Y km” (from `strava_activities` + goal) on the Sports tab.
- [ ] **Refresh token**  
  The code already refreshes the token when expired; ensure that when “Import from Strava” fails with 401, you try refresh once and retry before showing an error.
- [ ] **Clear error messages**  
  When Strava returns an error (e.g. “Invalid client”), show the message in an alert so the user knows what to fix.

### E. Build and distribution (real device / store)

- [ ] **Development build**  
  Expo Go is for development. For a “real” installable app, create a dev build:  
  `npx expo run:android` or `npx expo run:ios` (needs Android Studio / Xcode).
- [ ] **Production build**  
  For store or sideloading:  
  [EAS Build](https://docs.expo.dev/build/introduction/) — e.g. `eas build --platform android`.
- [ ] **Environment**  
  Don’t hardcode Strava Client ID/Secret in code. They’re already stored on-device after first save; for production, use EAS Secrets or env vars for any build-time config.
- [ ] **App name and icon**  
  Set a proper name and icon in `app.json` / `app.config.js` so the installed app looks like a real product.

### F. Optional but useful

- [ ] **Backup / export**  
  Export SQLite (or a JSON dump) to a file so the user can backup data (e.g. to Drive or Files).
- [ ] **Tests**  
  Add a few tests for the most important db functions (e.g. `addTodo` + `getTodosForDay` returns the new todo) and for date/dayKey logic.
- [ ] **Offline**  
  App is already local-first; document that it works offline and that Strava import needs network.

---

## Part 4: Suggested order of work

1. **Run the app and click through every screen** (Part 2). Fix any crash or wrong behavior you find.
2. **Add ScrollView** to tabs that can overflow (Today, Calendar, Habits, Finance).
3. **Add one “edit/delete” flow** (e.g. todos: long-press → delete, or edit title). Reuse the pattern for other modules.
4. **Finance**: add “update progress” for goals and “log payment” for debts.
5. **Sports**: show “This week: X / Y km” using existing goal + activities.
6. **Loading and error states** on at least Today and Sports.
7. **Build a dev build** and install on your phone; then consider EAS Build for a store-ready binary.

---

## Quick reference: main files to open when reviewing

| Goal | Open these files |
|------|------------------|
| See how a tab works | `app/(tabs)/index.tsx` (or calendar, habits, sports, finance) |
| See how data is stored | `src/db/client.ts` (schema), then `src/db/todos.ts` (example of queries) |
| Change tab order or icons | `app/(tabs)/_layout.tsx` |
| Strava connect + import | `app/(tabs)/sports.tsx`, `src/strava/api.ts`, `src/strava/storage.ts` |
| Add a new table or column | `src/db/client.ts` (migration), then a new or existing file in `src/db/` |

If you want, we can go through one feature end-to-end (e.g. “review and harden Today + todos”) and apply the checklist to that part first.
