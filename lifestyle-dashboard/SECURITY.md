# LIFEFLOW – Security Checklist

Full-stack security layers and how they are implemented or planned.

---

## 1. Transport – SSL/TLS

| Action | Purpose |
|--------|---------|
| **HTTPS only** | Encrypts data between the device and the server. |

**Implementation:** When the app is deployed on Vercel (or any host with HTTPS), traffic is over TLS. The **Strict-Transport-Security** header in `vercel.json` tells browsers to use HTTPS only for this origin (HSTS).

---

## 2. Security headers (browser / server)

| Header | Purpose |
|--------|---------|
| **Content-Security-Policy (CSP)** | Restricts where scripts, styles, and connections can load; reduces XSS and injection. |
| **X-Content-Type-Options: nosniff** | Stops the browser from guessing MIME types. |
| **X-Frame-Options: DENY** | Prevents the app from being embedded in iframes (clickjacking). |
| **Strict-Transport-Security** | Forces HTTPS and preload eligibility. |
| **Referrer-Policy** | Limits what is sent in the `Referer` header. |
| **X-XSS-Protection** | Legacy XSS filter (CSP is primary). |

**Implementation:** Configured in **`vercel.json`** under `headers`. Adjust CSP `connect-src` if you add more backends (e.g. Supabase, custom API).

---

## 3. Backend – database / API rules

| Action | Purpose |
|--------|---------|
| **Auth and per-user rules** | Only the signed-in user can read/write their own data. |

**Implementation:** The app currently uses **localStorage** (no cloud DB). When you add **Firebase Firestore** (or similar):

- Use **`firestore.rules`** in this repo as a template.
- Copy it to your Firebase project root and run:  
  `firebase deploy --only firestore:rules`
- Ensures `users/{userId}`, `finances`, `people`, `habits`, `appointments` are only accessible when `request.auth.uid == userId`.

For **Supabase**, apply the same idea with Row Level Security (RLS) policies.

---

## 4. Client – privacy in public (Privacy Blur)

| Action | Purpose |
|--------|---------|
| **Blur sensitive numbers** | Hides debt, balances, and financial details until the user hovers/taps. |

**Implementation:**

- **Settings → Privacy blur (Public mode)** enables it.
- Elements with **`data-privacy-blur`** are blurred when the setting is on; hover/active/focus reveals them.
- Used on: dashboard debt summary, Growth debt bar, Finance tab content, People ledger.

---

## 5. Access – biometric lock (future)

| Action | Purpose |
|--------|---------|
| **Biometric / device credential** | Requires Fingerprint or Face ID to open the app. |

**Implementation:** Not built yet. Planned approach:

- Use the **Web Authentication API (WebAuthn)** in the PWA.
- Optional: require a credential (e.g. platform authenticator) when the app is opened or when entering a “locked” section.
- Requires a backend or local credential store to tie the credential to “this device / this user.”

---

## 6. API – rate limiting (when you add a backend)

| Action | Purpose |
|--------|---------|
| **Rate limiting** | Limits login attempts and API calls to reduce brute force and abuse. |

**Implementation:** Not applicable while the app is front‑only. When you add a backend (e.g. Firebase Auth, Supabase, or a custom API):

- Enable rate limiting on auth and sensitive endpoints.
- Use your host’s features (e.g. Vercel serverless limits) or middleware (e.g. Redis-based limiter).

---

## Summary

| Layer | Tool / action | Status |
|-------|----------------|--------|
| **Transport** | SSL/TLS (HTTPS + HSTS) | ✅ Via host + `vercel.json` |
| **Headers** | CSP, X-Frame-Options, HSTS, etc. | ✅ `vercel.json` |
| **Database** | Firestore (or RLS) rules | ✅ Template in `firestore.rules` |
| **Privacy** | Privacy Blur (public mode) | ✅ Settings + `data-privacy-blur` |
| **Access** | Biometric lock (WebAuthn) | 📋 Planned |
| **Audit** | Security headers | ✅ Enforced by headers above |
