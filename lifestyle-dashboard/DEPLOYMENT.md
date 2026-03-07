# LIFEFLOW — Deployment Checklist

Use this list before and after deploying the app to a static host (Netlify, Vercel, GitHub Pages, etc.).

---

## Pre-deploy checklist

- [ ] **Backup reminder** — The app shows a notice in **Profile → Security** and in the footer: *"Data stored on this device only — back up in Profile → Security."* No code change needed; confirm it appears after deploy.
- [ ] **Cache bust** — If you changed JS/CSS, bump the version in `index.html` (e.g. `app.js?v=13`) and in `sw.js` (`CACHE_NAME = 'lifestyle-dashboard-v6'`) so returning users get the latest files.
- [ ] **Test locally** — Run `npx serve .` and check: tabs, add habit/goal/debt/appointment, profile sections, **Download my data** in Profile → Security.
- [ ] **No secrets** — Confirm there are no API keys or passwords in the repo; the app uses only `localStorage`.

---

## Deploy steps

1. **Build output** — The app is static. Deploy the **entire project folder** (no build step).
2. **Root document** — Ensure the host serves `index.html` at the site root (e.g. `https://yoursite.com/`).
3. **HTTPS** — Use HTTPS in production (required for the service worker and “Add to Home Screen”).
4. **Optional: redirects** — If the host supports it, redirect `http` → `https` and `/` → `/index.html` if needed.

### Host-specific

| Host          | Notes |
|---------------|--------|
| **Netlify**   | Drag & drop the folder or connect a repo; root = project folder. |
| **Vercel**    | Import repo or drag folder; no build command; output = current directory. |
| **GitHub Pages** | Push repo, enable Pages (branch `main` / `master`), root or `/docs` as set. |
| **Cloudflare Pages** | Connect repo or upload; build output = project root. |

---

## Post-deploy checklist

- [ ] **Open over HTTPS** — Visit `https://your-deployed-url`.
- [ ] **Service worker** — In DevTools → Application → Service Workers, confirm it registers (no errors).
- [ ] **Install / Add to Home Screen** — On phone or desktop, use “Install” or “Add to Home Screen” and confirm the app opens.
- [ ] **Backup flow** — Go to **Profile → Security**, read the backup reminder, click **Download my data (CSV/JSON)** and confirm a JSON file downloads.
- [ ] **Data** — Add a test habit and refresh; it should persist (localStorage). Remind users: data is per device/browser only.

---

## User-facing reminder (in the app)

The app already includes:

- **Profile → Security** — A highlighted notice: *“Back up your data. Everything is stored only on this device…”* with a pointer to **Download my data**.
- **Footer** — *“Data stored on this device only — back up in Profile → Security.”*

No extra steps are required for the backup reminder; it is built in.
