# Attendance Frontend (`attendenceFrontEnd`)

## 1. Project Overview

`attendenceFrontEnd` is the Expo/React Native client for the company attendance application. It lets employees create an account, sign in with Firebase email/password auth, view today's attendance status, and check in/check out through the backend API.

| Area | Current implementation |
| --- | --- |
| Runtime | Expo SDK 54 on Android/iOS/Web |
| UI framework | React Native 0.81 + React 19 |
| Routing | Expo Router 6 using the `app/` directory |
| Authentication | Firebase Auth email/password |
| Account metadata | Firestore collection `employees` |
| API client | Axios |
| Session persistence | Firebase Auth with AsyncStorage on native, default web persistence on web |
| Backend target | Express API in `attendanceBE`, default `http://10.0.2.2:3031/api/v1` |

Main responsibilities:

- Render the login screen.
- Render the employee account creation screen.
- Keep the Firebase Auth session alive across app restarts.
- Protect the attendance dashboard from unauthenticated access.
- Fetch and display today's attendance record.
- Send Firebase ID tokens to the backend for check-in/check-out calls.
- Normalize backend URL handling for Android emulator and web.

This frontend does not write attendance logs directly. Attendance logs are written by the backend to Supabase.

## 2. Architecture

### High-level architecture

```text
Expo Router app
  app/_layout.js
    |
    +-- app/login.js      -> Firebase Auth sign-in
    +-- app/register.js   -> Firebase Auth sign-up + Firestore employee doc
    +-- app/index.js      -> protected attendance dashboard
    +-- app/home.js       -> re-exports index dashboard

src/config/firebase.js
  -> Firebase app/auth/firestore initialization

src/services/authServices.js
  -> login/register/logout/session/token helpers

src/services/api.js
  -> axios instance, API URL normalization, attendance API calls

src/components/StatusCard.js
  -> attendance status presentation
```

### Data flow

```text
Employee opens app
  -> Expo Router loads app/index.js
  -> subscribeAuthState() checks Firebase session
  -> unauthenticated: router.replace("/login")
  -> authenticated: getCurrentEmployeeToken(true)
  -> setAuthToken(token) stores Bearer token on axios instance
  -> dashboard calls GET /attendance/today
  -> backend verifies Firebase token
  -> backend reads Supabase attendance_logs by token email
  -> StatusCard renders returned row
```

### Check-in/check-out flow

```text
Press Check-in or Check-out
  -> app/index.js refreshEmployeeToken()
  -> src/services/api.js sends axios request
  -> Authorization: Bearer <Firebase ID token>
  -> backend derives employee email
  -> backend writes Supabase
  -> frontend updates local today state from response.data
```

### Auth flow

```text
register.js
  -> registerEmployee(email, password)
  -> createUserWithEmailAndPassword()
  -> setDoc(db, "employees/{uid}", profile)
  -> router.replace("/")

login.js
  -> loginEmployee(email, password)
  -> signInWithEmailAndPassword()
  -> ensure employees/{uid} exists
  -> router.replace("/")

index.js
  -> subscribeAuthState()
  -> if employee exists: request Firebase ID token
  -> set axios Authorization header
```

### Backend/frontend interaction

The frontend calls only the backend API. It does not import Supabase and does not know Supabase table structure.

```text
Frontend Firebase Auth -> ID token -> Backend -> Supabase attendance_logs
Frontend Firestore -> employees collection for account metadata only
```

## 3. Folder Structure

Real project tree, excluding `node_modules/` and generated `.expo/` cache:

```text
attendenceFrontEnd/
├── .env
├── .env.example
├── .gitignore
├── app.json
├── index.js
├── package.json
├── package-lock.json
├── app/
│   ├── _layout.js
│   ├── home.js
│   ├── index.js
│   ├── login.js
│   └── register.js
├── assets/
│   ├── adaptive-icon.png
│   ├── favicon.png
│   ├── icon.png
│   └── splash-icon.png
└── src/
    ├── components/
    │   └── StatusCard.js
    ├── config/
    │   └── firebase.js
    ├── screens/                 # currently empty
    └── services/
        ├── api.js
        └── authServices.js
```

Important files:

| File | Purpose | Relationships |
| --- | --- | --- |
| `index.js` | Expo root entry. Imports `expo-router/entry`. | Package `main` also points to `expo-router/entry`. |
| `app/_layout.js` | Root navigation stack with hidden headers. | Registers `index`, `home`, `login`, `register`. |
| `app/index.js` | Protected attendance dashboard and main screen. | Uses auth service, API service, `StatusCard`, Expo Router redirects. |
| `app/home.js` | Compatibility route. Re-exports `app/index.js`. | Keeps `/home` pointing at the dashboard. |
| `app/login.js` | Employee login screen. | Calls `loginEmployee()`, redirects to `/`. |
| `app/register.js` | Employee account creation screen. | Calls `registerEmployee()`, writes Firebase Auth user and Firestore employee doc. |
| `src/config/firebase.js` | Firebase app/auth/firestore initialization. | Used by `authServices.js`. |
| `src/services/authServices.js` | Firebase Auth and Firestore account helpers. | Used by login/register/dashboard. |
| `src/services/api.js` | Axios instance and attendance API functions. | Used by dashboard. |
| `src/components/StatusCard.js` | Presents today's attendance state. | Used by dashboard. |
| `app.json` | Expo app metadata, icons, Android edge-to-edge, web favicon. | Used by Expo CLI. |

## 4. Startup Flow

### Expo runtime startup

```text
package.json main: expo-router/entry
  -> index.js also imports expo-router/entry
  -> Expo Router scans app/
  -> app/_layout.js creates Stack navigator
  -> route "/" loads app/index.js
```

### Initial route behavior

1. `app/index.js` renders `AttendanceDashboard`.
2. It subscribes to Firebase session state through `subscribeAuthState()`.
3. While Firebase checks persistence, dashboard shows `LoadingScreen`.
4. If no employee session exists, `router.replace("/login")`.
5. If a session exists:
   - refresh Firebase ID token with `getCurrentEmployeeToken(true)`
   - call `setAuthToken(token)` to set axios default Authorization header
   - call `refreshAll()` to check backend health and load today's attendance

### Login startup

1. `app/login.js` renders email/password form.
2. It also subscribes to auth state.
3. If an employee is already logged in, it redirects to `/`.
4. On successful login, it calls `router.replace("/")`.

### Register startup

1. `app/register.js` renders email/password account creation form.
2. If an employee is already logged in, it redirects to `/`.
3. On successful registration, Firebase Auth signs the user in automatically and the screen redirects to `/`.

## 5. API Flow

### API client

`src/services/api.js` owns the Axios client:

```js
export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});
```

### URL normalization

`EXPO_PUBLIC_API_URL` is expected to include the `/api/v1` prefix.

Default:

```text
http://10.0.2.2:3031/api/v1
```

Why `10.0.2.2`:

- Android emulator uses `10.0.2.2` to reach the host computer.
- Web cannot use `10.0.2.2`, so `normalizeApiUrl()` rewrites it to `localhost` on `Platform.OS === "web"`.

### API functions

| Function | HTTP request | Payload | Returns |
| --- | --- | --- | --- |
| `healthCheck()` | `GET <base-without-/api/vN>/health` | None | backend health JSON |
| `getTodayAttendance()` | `GET /attendance/today` | None | `{ success, data }` |
| `checkIn(note)` | `POST /attendance/check-in` | `{ note }` if note is non-empty | `{ success, data }` |
| `checkOut(note)` | `POST /attendance/check-out` | `{ note }` if note is non-empty | `{ success, data }` |
| `setAuthToken(token)` | No request | Mutates axios defaults | Adds/removes `Authorization` header |
| `formatApiError(error)` | No request | Axios/native error | Prefer backend `response.data.message` |

### Headers and token handling

Before protected API calls, `app/index.js` calls:

```text
getCurrentEmployeeToken()
  -> setAuthToken(token)
  -> api.defaults.headers.common.Authorization = `Bearer ${token}`
```

The backend uses this token to derive `employee_email`. The frontend never sends an email directly for attendance identity.

## 6. Authentication System

### Firebase initialization

`src/config/firebase.js` initializes Firebase using the same project config pattern as the previous `chat-messenger` project.

Current Firebase project:

```text
projectId: chat-messenger-71c1e
authDomain: chat-messenger-71c1e.firebaseapp.com
```

Native persistence:

```text
Platform.OS !== "web"
  -> initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  -> fallback to getAuth(app) if Firebase was already initialized
```

Web persistence:

```text
Platform.OS === "web"
  -> getAuth(app)
```

### Account creation

`registerEmployee(email, password)`:

1. Normalizes email using `trim().toLowerCase()`.
2. Calls `createUserWithEmailAndPassword(auth, email, password)`.
3. Creates/sets Firestore document:

```text
employees/{uid}
├── uid
├── email
├── role: "employee"
├── status: "active"
├── createdAt: serverTimestamp()
└── updatedAt: serverTimestamp()
```

4. Returns `{ uid, email }`.

### Login

`loginEmployee(email, password)`:

1. Normalizes email.
2. Calls `signInWithEmailAndPassword`.
3. Reads `employees/{uid}`.
4. If missing, creates the employee document with default role/status.
5. Returns `{ uid, email }`.

### Logout

`logoutEmployee()` calls Firebase `signOut(auth)`. The dashboard also clears the axios Authorization header and local `today` state.

### Session persistence

Firebase manages session persistence. The app observes state via:

```text
subscribeAuthState(callback)
  -> onAuthStateChanged(auth, user => callback(toEmployee(user)))
```

### Protected routes

Protection is implemented in `app/index.js`, not in a separate route guard component:

- `authReady=false`: show loading screen.
- `authReady=true` and no employee: redirect to `/login`.
- employee exists: fetch token and load dashboard data.

`app/home.js` reuses the same protected dashboard.

## 7. Database / Backend Logic

### Firebase data owned by frontend

The frontend writes employee account metadata to Firestore:

```text
Firestore
└── employees
    └── {firebaseAuthUid}
        ├── uid
        ├── email
        ├── role
        ├── status
        ├── createdAt
        └── updatedAt
```

Firebase Auth stores the actual email/password account. Passwords are not stored in Firestore or this codebase.

### Supabase data owned by backend

Attendance data is stored by `attendanceBE`, not this app:

```text
Supabase
└── attendance_logs
    ├── id
    ├── employee_email
    ├── checkin_at
    ├── checkout_at
    ├── note
    └── created_at
```

The frontend does not know Supabase credentials and should not import Supabase.

### Relationship between systems

```text
Firebase Auth user.email
        |
        v
Firebase ID token email claim
        |
        v
backend req.auth.email
        |
        v
Supabase attendance_logs.employee_email
```

The relationship is email-based. If an employee changes their Firebase email, historical Supabase rows will remain under the old email unless a migration is performed.

## 8. Environment Variables

Use `.env.example` as the template. Do not commit real `.env` values.

| Variable | Required | Example | Used by | Notes |
| --- | --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | Yes | `http://10.0.2.2:3031/api/v1` | `src/services/api.js` | Must include `/api/v1`. Expo exposes `EXPO_PUBLIC_*` values to client code. |

Security notes:

- Firebase web config in `src/config/firebase.js` is client-side configuration, not a server secret.
- Backend Supabase keys must not be added to frontend env.
- Do not place service-role keys in Expo env files.
- After changing `.env`, restart Expo with cache clear if Metro does not pick it up.

## 9. Important Features

### Login screen

File: `app/login.js`

- Email/password form.
- Validates non-empty fields before calling Firebase.
- Shows Firebase error messages through `getAuthErrorMessage()`.
- Redirects authenticated users to `/`.
- Link to `/register`.

### Register screen

File: `app/register.js`

- Email/password account creation.
- Creates Firebase Auth user.
- Creates Firestore `employees/{uid}` metadata.
- Redirects to dashboard after success.
- Link back to `/login`.

### Protected attendance dashboard

File: `app/index.js`

- Watches Firebase Auth state.
- Redirects unauthenticated users to `/login`.
- Refreshes Firebase ID token before protected backend calls.
- Displays backend connection state.
- Displays current employee email.
- Supports pull-to-refresh through `RefreshControl`.

### Status card

File: `src/components/StatusCard.js`

Maps today's attendance row to status:

| Row state | UI status |
| --- | --- |
| no row or no `checkin_at` | not checked in |
| `checkin_at` exists and `checkout_at` empty | working/open shift |
| both `checkin_at` and `checkout_at` exist | completed |

### Check-in/check-out

The dashboard calls:

- `checkIn(note)`
- `checkOut(note)`

The note is trimmed and omitted from the request body when empty.

### Backend health check

`healthCheck()` is used by the dashboard to display backend connectivity. It calls `/health`, not `/api/v1/health`, by stripping the `/api/vN` suffix.

## 10. Error Handling

### UI pattern

Screens use `try/catch` around async actions and show `Alert.alert()`:

- login failure
- registration failure
- backend health failure
- attendance load failure
- check-in/check-out failure
- logout failure

### API error formatting

`formatApiError(error)` prefers backend messages:

```text
error.response?.data?.message
  -> error.message
  -> "Unexpected error"
```

### Firebase error formatting

`getAuthErrorMessage(error)` maps known Firebase auth codes:

- `auth/invalid-email`
- `auth/missing-password`
- `auth/weak-password`
- `auth/email-already-in-use`
- `auth/invalid-credential`
- `auth/user-not-found`
- `auth/wrong-password`

### Loading state

The dashboard uses one `loadingAction` string:

| Value | Meaning |
| --- | --- |
| `checkIn` | Check-in request is running. |
| `checkOut` | Check-out request is running. |
| `refresh` | Manual data refresh is running. |
| `logout` | Logout is running. |
| empty string | No action running. |

## 11. Coding Rules

Follow these patterns when extending the frontend:

- Keep route screens in `app/`.
- Keep reusable UI in `src/components/`.
- Keep external service clients/helpers in `src/services/`.
- Keep external SDK configuration in `src/config/`.
- Use `.js` files; the current frontend source is JavaScript, not TypeScript.
- Use Expo Router navigation (`router.push`, `router.replace`) inside route screens.
- Use Firebase Auth for employee identity; do not invent local password storage.
- Use `getCurrentEmployeeToken()` before protected API calls.
- Use `setAuthToken("")` after logout or auth failure.
- Use `formatApiError()` for backend request failures.
- Keep backend API paths in `src/services/api.js`; avoid inline axios calls from screens.
- Do not import Supabase in frontend.
- Do not put backend secrets in Expo env files.

Style conventions visible in the current code:

- Functional React components.
- Local `StyleSheet.create()` per screen/component.
- `Pressable` for buttons.
- Cards use `borderRadius: 8`.
- Loading state uses `ActivityIndicator`.
- Forms validate required fields before async calls.

## 12. AI AGENT GUIDE

This section is for Codex, ChatGPT, Claude, Cursor, Copilot, and other AI coding agents.

### How to modify safely

1. Read `src/services/api.js` before changing backend calls.
2. Read `src/services/authServices.js` before changing login/register/session behavior.
3. Read `app/index.js` before changing dashboard, auth guard, token refresh, or attendance actions.
4. Read `src/config/firebase.js` before changing Firebase project config.
5. Do not edit `.env`; update `.env.example` and README when documenting env changes.
6. After dependency changes, run `npx expo install --check`.
7. After Firebase or route changes, run an Android bundle/export check.
8. If Android reports a stale module resolution error, restart Metro with `npx expo start -c`.

### Files requiring extra care

| File | Why it is sensitive |
| --- | --- |
| `src/config/firebase.js` | Project ID must match backend `FIREBASE_PROJECT_ID`. Incorrect persistence setup breaks mobile login persistence. |
| `src/services/authServices.js` | Owns account creation and Firestore writes. Changes can create inconsistent employee records. |
| `src/services/api.js` | Owns API URL and token header. Incorrect URL breaks Android/web networking. |
| `app/index.js` | Combines auth guard, token refresh, dashboard state, API calls, and logout. |
| `app/_layout.js` | Route registration for all app screens. |

### Architectural constraints

- Employee account metadata is stored in Firestore `employees`.
- Attendance records are stored in backend/Supabase `attendance_logs`.
- Auth token is a Firebase ID token, not a custom token stored manually.
- `EXPO_PUBLIC_API_URL` must include `/api/v1`.
- Android emulator host access uses `10.0.2.2`.
- Web rewrites `10.0.2.2` to `localhost`.

### Forbidden or risky changes

- Do not store passwords in Firestore.
- Do not send employee email as the authority for attendance identity; backend should derive it from token.
- Do not move Supabase credentials into frontend.
- Do not bypass `refreshEmployeeToken()` before attendance mutations.
- Do not add new direct backend calls in screens when they belong in `src/services/api.js`.

### Safe extension examples

| Feature | Recommended files |
| --- | --- |
| Add attendance history screen | Add `app/history.js`, add API helper in `src/services/api.js`, add backend endpoint. |
| Add profile screen | Add `app/profile.js`, extend `authServices.js` for Firestore profile reads/writes. |
| Add manager/admin role UI | Extend Firestore `employees` schema and backend authorization; do not trust frontend role only. |
| Add password reset | Add helper in `authServices.js`, then add screen or link in `login.js`. |

## 13. Common Problems

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Unable to resolve module firebase/auth` | Metro cache/dev server started before Firebase dependency was installed | Stop Expo and run `npx expo start -c`. |
| App cannot reach backend on Android emulator | API URL uses `localhost` instead of `10.0.2.2` | Use `EXPO_PUBLIC_API_URL=http://10.0.2.2:3031/api/v1`. |
| Web cannot reach backend with `10.0.2.2` | Browser cannot resolve emulator host alias | Code rewrites to `localhost`; ensure backend is on host port `3031`. |
| `Network Error` from Axios | Backend not running, wrong port, or device not on same network | Check `/health` and API URL. |
| Attendance routes return `401` | Firebase ID token missing/invalid | Login again; ensure backend `FIREBASE_PROJECT_ID` matches frontend config. |
| Firebase sign-up fails with weak password | Firebase requires at least 6 characters | Use a longer password. |
| Firebase sign-up says email in use | Auth user already exists | Login or use a different email. |
| Firestore employee doc not created | Firestore rules block write | Allow authenticated users to create their own employee doc or create server-side provisioning. |
| UI still shows old error after fixing package | Emulator still connected to stale Metro bundle | Reload app, close/reopen app, or restart Metro with cache clear. |
| `expo install --check` reports mismatched packages | Dependency versions not aligned with SDK 54 | Run `npx expo install --fix` or install the expected versions. |

## 14. Run Instructions

### Install

```powershell
cd D:\FPTFOLD\AttendantApp\attendenceFrontEnd
npm install
```

### Start Expo

```powershell
npm start
```

Equivalent:

```powershell
npx expo start
```

### Start with clean Metro cache

```powershell
npm run clear
```

Equivalent:

```powershell
npx expo start -c
```

### Android

Make sure the backend is running on the host:

```powershell
cd D:\FPTFOLD\AttendantApp\attendanceBE
npm run dev
```

Then start Android:

```powershell
cd D:\FPTFOLD\AttendantApp\attendenceFrontEnd
npm run android
```

Backend URL for Android emulator:

```text
http://10.0.2.2:3031/api/v1
```

### iOS

```powershell
npm run ios
```

The current `.env.example` is Android-emulator oriented. For iOS simulator, use a reachable host URL such as `http://localhost:3031/api/v1` if testing on simulator, or a LAN IP for physical devices.

### Web

```powershell
npm run web
```

The app rewrites `10.0.2.2` to `localhost` on web.

### Dependency check

```powershell
npx expo install --check
```

### Bundle/export checks

Web:

```powershell
npx expo export --platform web --output-dir .expo\export-check
```

Android:

```powershell
npx expo export --platform android --output-dir .expo\bundle-check
```

These commands create temporary output directories under `.expo/`. Delete those check directories after verification if you do not want generated artifacts in the worktree.

### Production

This project currently has no EAS config and no standalone native build scripts. Production options:

- Use Expo/EAS build after adding project-specific EAS configuration.
- Export web with `npx expo export --platform web` and serve the static output.

### Testing

There is no automated test suite currently. Use:

```powershell
npx expo install --check
npx expo export --platform android --output-dir .expo\bundle-check
npx expo export --platform web --output-dir .expo\export-check
```

For runtime testing:

1. Start backend.
2. Start Expo.
3. Create an employee account.
4. Log in.
5. Verify `/health` status on dashboard.
6. Check in.
7. Load today's attendance.
8. Check out.

## 15. Future Improvements

- Move Firebase config values to `EXPO_PUBLIC_FIREBASE_*` env variables if multiple environments are needed.
- Add password reset flow through Firebase Auth.
- Add profile screen for employee details beyond email.
- Add attendance history screen with pagination.
- Add manager/admin screens for company-wide attendance reports.
- Add a shared design system for form inputs, buttons, panels, and status pills.
- Add automated component/service tests.
- Add EAS build configuration for Android/iOS production builds.
- Add web deployment documentation if the web target will be used.
- Add locale/timezone handling so "today" matches company policy rather than backend UTC boundaries.
- Add stronger Firestore security rules and document them in this repo.
- Add a backend endpoint to provision employee accounts if account creation should be manager-controlled rather than self-service.
