# Lifestyle Dashboard

Habits, finances, debt, and appointments in one place. Data is saved in your browser.

**Back up your data:** Everything is stored only on this device. Use **Profile → Security → Download my data (CSV/JSON)** to save a copy. See [DEPLOYMENT.md](DEPLOYMENT.md) for a deployment checklist.

## Add to Home Screen (Phone)

**Important:** Add to Home Screen works when the site is served over **HTTPS** or **localhost**. Opening `index.html` directly (`file://`) may not show the option.

### Option 1: Use a local server (quick test)

From this folder, run:

```
npx serve .
```

Then on your phone, open the URL shown (e.g. `http://192.168.x.x:3000` on the same Wi‑Fi) and use your browser’s **Add to Home Screen** / **Install app** option.

### Option 2: Deploy online (best for home screen)

Upload this folder to:
- **GitHub Pages**
- **Netlify** (drag & drop)
- **Vercel**
- Any static hosting

Then open the site on your phone and add it to the home screen.

### How to add on your phone

- **iPhone:** Safari → Share → Add to Home Screen
- **Android:** Chrome → Menu (⋮) → Add to Home screen / Install app

## Run locally (no server)

Double‑click `index.html` to open in a browser. Data is stored in localStorage.
