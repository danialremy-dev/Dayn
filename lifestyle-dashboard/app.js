// Simple in-browser state with localStorage persistence
function safeId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) {}
  return "id-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

const STORAGE_KEY = "lifestyle-dashboard-state-v1";
const AVATAR_KEY = "lifestyle-dashboard-avatar-v1";
const PROFILE_KEY = "lifestyle-dashboard-profile-v1";
const THEME_KEY = "lifestyle-dashboard-theme-v1";

const defaultProfile = {
  profileName: "Alex Johnson",
  missionStatement: "Living debt-free and healthy by 30.",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  weeklyResetDay: 1,
  hideFinancialNumbers: false,
  memberSince: "2023-01",
  targetDebtFreeDate: "",
  monthlyDebtPayoffTarget: 0,
  monthlyDebtPaidThisMonth: 0,
  emergencyFundGoal: 0,
  emergencyFundCurrent: 0,
  debtPriority: "snowball",
  savingsBuckets: [{ name: "House", priority: 1 }, { name: "Car", priority: 2 }],
  gracePeriod: "23:00",
  dailyResetTime: "06:00",
  streakProtection: false,
  checkInCountsAs: "boolean",
  morningNudge: false,
  morningNudgeTime: "08:00",
  eveningNudge: false,
  eveningNudgeTime: "21:00",
  debtWarning: false,
  appointmentBuffer: 15,
  privacyBlur: false,
  twoFactorEnabled: false,
  peopleFinancialBoundary: 0,
};

// Must be before loadProfile/loadState (they use storage)
function getStorage() {
  try {
    localStorage.setItem("_test", "1");
    localStorage.removeItem("_test");
    return localStorage;
  } catch (e) {
    return null;
  }
}
const storage = getStorage();
let inMemoryFallback = null;

function loadProfile() {
  if (!storage) return { ...defaultProfile };
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) return { ...defaultProfile };
    return { ...defaultProfile, ...JSON.parse(raw) };
  } catch (e) {
    return { ...defaultProfile };
  }
}

function saveProfile(profile) {
  if (!storage) return;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
    showSavedToast();
  } catch (e) {}
}

let profile = loadProfile();

const COLOR_PALETTE = [
  { id: "purple", hex: "#7c3aed", strong: "#6d28d9" },
  { id: "teal", hex: "#14b8a6", strong: "#0d9488" },
  { id: "blue", hex: "#3b82f6", strong: "#2563eb" },
  { id: "pink", hex: "#ec4899", strong: "#db2777" },
  { id: "orange", hex: "#f97316", strong: "#ea580c" },
  { id: "green", hex: "#22c55e", strong: "#16a34a" },
  { id: "red", hex: "#ef4444", strong: "#dc2626" },
  { id: "amber", hex: "#f59e0b", strong: "#d97706" },
  { id: "indigo", hex: "#6366f1", strong: "#4f46e5" },
  { id: "cyan", hex: "#06b6d4", strong: "#0891b2" },
];

const defaultState = {
  habits: [],
  habitCompletions: {},
  savingsGoals: [],
  debts: [],
  appointments: [],
  people: [],
  energyLog: {},
  deepWorkTarget: 2,
  deepWorkLog: {},
  insightLog: {},
  debtHistory: [],
};

const CONNECTION_TYPES = ["Friend", "Family", "Business Partner", "Work", "Mentor", "Other"];
const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", MYR: "RM " };

function loadState() {
  try {
    if (storage) {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const parsed = JSON.parse(raw);
      const merged = { ...JSON.parse(JSON.stringify(defaultState)), ...parsed };
      merged.habits = (merged.habits || []).map((h) => ({ ...h, description: h.description || h.name }));
      merged.debts = (merged.debts || []).map((d) => ({ ...d, dueDate: d.dueDate || "" }));
      merged.energyLog = merged.energyLog || {};
      merged.deepWorkTarget = typeof merged.deepWorkTarget === "number" ? merged.deepWorkTarget : 2;
      merged.deepWorkLog = merged.deepWorkLog || {};
      merged.insightLog = merged.insightLog || {};
      merged.debtHistory = Array.isArray(merged.debtHistory) ? merged.debtHistory.slice(-180) : [];
      merged.people = (merged.people || []).map((p) => ({
        ...p,
        connectionType: p.connectionType || "Friend",
        lastSpoken: p.lastSpoken || "",
        birthday: p.birthday || "",
        notes: p.notes || "",
        giftIdeas: p.giftIdeas || "",
        touchpoints: p.touchpoints || [],
        ledger: p.ledger && typeof p.ledger === "object"
          ? { balance: Number(p.ledger.balance) || 0, transactions: p.ledger.transactions || [] }
          : { balance: 0, transactions: [] },
        linkedHabitId: p.linkedHabitId || "",
        linkedDebtId: p.linkedDebtId || "",
        linkedGoalId: p.linkedGoalId || "",
      }));
      return merged;
    }
  } catch (e) {
    console.error("Failed to load state", e);
  }
  inMemoryFallback = inMemoryFallback || JSON.parse(JSON.stringify(defaultState));
  return inMemoryFallback;
}

function recordDebtSnapshot() {
  const today = todayStr();
  const total = totalDebtRemaining();
  state.debtHistory = state.debtHistory || [];
  const last = state.debtHistory[state.debtHistory.length - 1];
  if (!last || last.date !== today) {
    state.debtHistory.push({ date: today, total });
    if (state.debtHistory.length > 180) state.debtHistory = state.debtHistory.slice(-180);
  } else {
    last.total = total;
  }
}

function saveState() {
  recordDebtSnapshot();
  const data = JSON.stringify(state);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, data);
      showSavedToast();
      return;
    } catch (e) {
      console.error("Save failed", e);
      if (e.name === "QuotaExceededError") {
        showSaveError("Storage full. Try removing some data or the profile image.");
        return;
      }
    }
  }
  inMemoryFallback = state;
  showSaveError("Saving disabled. Use the site via a web server (e.g. npx serve) or turn off private browsing.");
  showSavedToast("SAVED (TEMPORARY)");
}

function showSavedToast(msg) {
  const t = document.getElementById("saved-toast");
  if (t) {
    t.textContent = msg != null ? msg : "SAVED!";
    t.classList.add("show");
    clearTimeout(window._saveToastTimer);
    window._saveToastTimer = setTimeout(() => t.classList.remove("show"), 2000);
  }
}

function showSaveError(msg) {
  const el = document.getElementById("save-error-banner");
  if (el) {
    el.textContent = msg;
    el.classList.add("show");
  }
}

let state = loadState();
if (!state || typeof state !== "object") state = JSON.parse(JSON.stringify(defaultState));

// Color palette / theme
function applyTheme(hex, strong) {
  const root = document.documentElement;
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-soft", hex + "33");
  root.style.setProperty("--accent-strong", strong || hex);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", hex);
}

function setupColorPalette() {
  const container = document.getElementById("color-palette");
  if (!container) return;

  const saved = storage?.getItem(THEME_KEY);
  const current = saved ? COLOR_PALETTE.find((c) => c.id === saved) : COLOR_PALETTE[0];
  if (current) applyTheme(current.hex, current.strong);

  COLOR_PALETTE.forEach((c) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch" + (c.id === (current?.id || "purple") ? " active" : "");
    swatch.style.backgroundColor = c.hex;
    swatch.setAttribute("aria-label", `Use ${c.id} theme`);
    swatch.addEventListener("click", () => {
      container.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");
      applyTheme(c.hex, c.strong);
      if (storage) storage.setItem(THEME_KEY, c.id);
    });
    container.appendChild(swatch);
  });
}

// Utilities
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(n, currency) {
  if (isNaN(n)) n = 0;
  const sym = CURRENCY_SYMBOLS[currency || profile.currency] || (currency || profile.currency) + " ";
  return sym + Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function sortByDateAsc(items, field) {
  return [...items].sort((a, b) => (a[field] || "").localeCompare(b[field] || ""));
}

function nextAppointment() {
  const today = todayStr();
  const upcoming = state.appointments.filter((a) => a.date >= today);
  if (!upcoming.length) return null;
  return sortByDateAsc(upcoming, "date")[0];
}

// DOM helpers
const $ = (id) => document.getElementById(id);

// Avatar: choose image from gallery
function setupAvatar() {
  const input = $("avatar-input");
  const avatarEl = $("dashboard-avatar");
  if (!input || !avatarEl) return;

  if (storage) {
    try {
      const saved = storage.getItem(AVATAR_KEY);
      if (saved) {
        avatarEl.style.backgroundImage = `url(${saved})`;
        avatarEl.classList.add("has-image");
      }
    } catch (e) {}
  }

  input.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      avatarEl.style.backgroundImage = `url(${dataUrl})`;
      avatarEl.classList.add("has-image");
      if (storage) {
        try {
          storage.setItem(AVATAR_KEY, dataUrl);
        } catch (err) {
          if (err.name === "QuotaExceededError") showSaveError("Profile image too large. Try a smaller image.");
        }
      }
    };
    reader.readAsDataURL(file);
    input.value = "";
  });
}

// Tabs
function switchToTab(tab) {
  document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
}

function setupTabs() {
  document.querySelectorAll(".nav-link, .nav-logo[data-tab], .gui-btn[data-tab], .gui-link[data-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.dataset.tab) switchToTab(el.dataset.tab);
    });
  });
}

// Predefined habit types with icon and description
const HABIT_PRESETS = [
  { name: "Meditation", desc: "Meditate daily for 15 minutes", icon: "☯", color: "#8b5cf6" },
  { name: "Side Hustle", desc: "Work on my app business", icon: "⌨", color: "#f59e0b" },
  { name: "Play Drums", desc: "Exercise drumming for at least 30 minutes", icon: "♪", color: "#0ea5e9" },
  { name: "Running", desc: "Go for a jog every other day", icon: "🏃", color: "#22c55e" },
  { name: "Exercise", desc: "Work out or do physical activity", icon: "💪", color: "#14b8a6" },
  { name: "Morning walk", desc: "Take a walk in the morning", icon: "🚶", color: "#06b6d4" },
  { name: "Reading", desc: "Read for at least 20 minutes", icon: "📖", color: "#6366f1" },
  { name: "Sleep by 10pm", desc: "Get to bed by 10pm", icon: "😴", color: "#7c3aed" },
  { name: "Drink water", desc: "Drink 8 glasses of water", icon: "💧", color: "#3b82f6" },
  { name: "Journaling", desc: "Write in journal", icon: "📝", color: "#ec4899" },
  { name: "Stretch / Yoga", desc: "Stretch or do yoga", icon: "🧘", color: "#84cc16" },
  { name: "Learn something new", desc: "Learn something new today", icon: "💡", color: "#eab308" },
];
const HABIT_TYPES = HABIT_PRESETS.map((p) => p.name);

function getHabitIcon(name) {
  const preset = HABIT_PRESETS.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return preset ? { icon: preset.icon, color: preset.color } : { icon: "✓", color: "#64748b" };
}

// Habits
function setupHabits() {
  // Habit type chips: click to fill name and description
  const grid = $("habit-types-grid");
  if (grid) {
    HABIT_PRESETS.forEach((preset) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "habit-type-chip";
      chip.textContent = preset.name;
      chip.addEventListener("click", () => {
        $("habit-name").value = preset.name;
        $("habit-description").value = preset.desc || "";
        $("habit-name").focus();
      });
      grid.appendChild(chip);
    });
  }

  $("add-habit-btn")?.addEventListener("click", () => {
    $("habit-id").value = "";
    $("habit-form").reset();
    $("habit-goal").value = 5;
    $("habit-form-panel").classList.remove("hidden");
    $("habits-cards-list").classList.add("hidden");
  });

  $("cancel-habit-btn")?.addEventListener("click", () => {
    $("habit-form-panel").classList.add("hidden");
    $("habits-cards-list").classList.remove("hidden");
  });

  const form = $("habit-form");
  if (!form) return;
  function handleHabitSave(e) {
    if (e) e.preventDefault();
    try {
      const id = $("habit-id").value || safeId();
      const name = $("habit-name").value.trim();
      const description = $("habit-description").value.trim();
      const goal = Number($("habit-goal").value || 0);
      if (!name) return;

      const existingIndex = state.habits.findIndex((h) => h.id === id);
      const habit = { id, name, description: description || name, goalPerWeek: goal > 0 ? goal : 1 };

      if (existingIndex >= 0) {
        state.habits[existingIndex] = habit;
      } else {
        state.habits.push(habit);
      }

      saveState();
      form.reset();
      $("habit-id").value = "";
      $("habit-goal").value = 5;
      $("habit-form-panel").classList.add("hidden");
      $("habits-cards-list").classList.remove("hidden");
      renderHabits();
      renderDashboard();
    } catch (err) {
      console.error("Habit save error", err);
      showSaveError("Could not save habit. Try again.");
    }
  }
  form.addEventListener("submit", handleHabitSave);
  form.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handleHabitSave(null); });
}

function toggleHabitToday(habitId) {
  const key = todayStr();
  if (!state.habitCompletions[key]) state.habitCompletions[key] = {};
  const current = !!state.habitCompletions[key][habitId];
  state.habitCompletions[key][habitId] = !current;
  saveState();
  renderHabits();
  renderDashboard();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  Object.keys(state.habitCompletions).forEach((date) => {
    if (state.habitCompletions[date][id]) {
      delete state.habitCompletions[date][id];
    }
  });
  saveState();
  renderHabits();
  renderDashboard();
}

function editHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  $("habit-id").value = habit.id;
  $("habit-name").value = habit.name;
  $("habit-description").value = habit.description || "";
  $("habit-goal").value = habit.goalPerWeek;
  $("habit-form-panel").classList.remove("hidden");
  $("habits-cards-list").classList.add("hidden");
}

function getProgressGridDates(weeks = 5) {
  const dates = [];
  const today = new Date();
  for (let i = weeks * 7 - 1; i >= 0; i--) {
    const x = new Date(today);
    x.setDate(today.getDate() - i);
    dates.push(x.toISOString().slice(0, 10));
  }
  return dates;
}

/** Consecutive days (including today) that the habit was completed, going backward. */
function getHabitStreak(habitId) {
  let count = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (!state.habitCompletions[key]?.[habitId]) break;
    count++;
  }
  return count;
}

/** This week's completion count and goal; returns 0–100 for progress ring. */
function getHabitWeekProgress(habit) {
  const weekDates = getThisWeekDates();
  const goal = Math.min(7, Math.max(1, Number(habit.goalPerWeek) || 5));
  const completed = weekDates.filter((d) => state.habitCompletions[d]?.[habit.id]).length;
  return goal > 0 ? Math.min(100, Math.round((completed / goal) * 100)) : 0;
}

function renderHabits() {
  if (typeof renderDailySnapshot === "function") renderDailySnapshot();
  const todayKey = todayStr();
  const todayMap = state.habitCompletions[todayKey] || {};

  const listEl = $("habits-cards-list");
  if (!listEl) return;
  listEl.innerHTML = "";
  listEl.classList.remove("hidden");

  if (state.habits.length === 0) {
    listEl.innerHTML = '<p class="habits-empty">NO HABITS YET. TAP "+ ADD HABIT" TO GET STARTED.</p>';
    return;
  }

  state.habits.forEach((habit) => {
    const done = !!todayMap[habit.id];
    const streak = getHabitStreak(habit.id);
    const ringPct = getHabitWeekProgress(habit);
    const circumference = 2 * Math.PI * 15.5;
    const dashFilled = (ringPct / 100) * circumference;

    const card = document.createElement("div");
    card.className = "habit-card-active";
    card.innerHTML = `
      <h3 class="habit-card-active-title">${habit.name}</h3>
      <div class="habit-progress-ring-wrap">
        <div class="habit-progress-ring">
          <svg viewBox="0 0 36 36" aria-hidden="true">
            <defs>
              <linearGradient id="habit-ring-gradient-${habit.id}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#e8efe3" />
                <stop offset="100%" stop-color="#9caf88" />
              </linearGradient>
            </defs>
            <path class="habit-ring-bg" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" />
            <path class="habit-ring-fill" stroke-dasharray="${dashFilled.toFixed(2)} ${circumference.toFixed(2)}" d="M18 2.5 a 15.5 15.5 0 0 1 0 31 a 15.5 15.5 0 0 1 0 -31" style="stroke: url(#habit-ring-gradient-${habit.id})" />
          </svg>
        </div>
        <p class="habit-streak">${streak} Day Streak</p>
      </div>
      <button type="button" class="habit-complete-btn ${done ? "done" : ""}" data-habit-id="${habit.id}" aria-label="Mark ${habit.name} ${done ? "incomplete" : "complete"}">
        ${done ? "Completed" : "Complete"}
      </button>
      <div class="habit-card-active-actions">
        <button type="button" class="habit-card-meta-btn" data-action="edit">EDIT</button>
        <span class="habit-card-meta-sep">·</span>
        <button type="button" class="habit-card-meta-btn danger" data-action="delete">DELETE</button>
      </div>
    `;

    card.querySelector(".habit-complete-btn").addEventListener("click", () => toggleHabitToday(habit.id));
    card.querySelector('[data-action="edit"]').addEventListener("click", () => editHabit(habit.id));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteHabit(habit.id));

    listEl.appendChild(card);
  });
}

function getThisWeekDates() {
  const now = new Date();
  const day = now.getDay(); // 0-6
  const mondayDiff = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayDiff);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getLast7Days() {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function getDailyGoalsPct() {
  const todayKey = todayStr();
  const todayMap = state.habitCompletions[todayKey] || {};
  const total = state.habits.length;
  if (!total) return 0;
  const completed = state.habits.filter((h) => !!todayMap[h.id]).length;
  return Math.round((completed / total) * 100);
}

function renderDailySnapshot() {
  renderSubtleStatsBar("subtle-stats-daily", "subtle-stats-daily-text", "subtle-stats-daily-chart");
  const todayKey = todayStr();
  const northStarEl = $("snapshot-north-star");
  if (northStarEl) {
    const pct = getDailyGoalsPct();
    const totalHabits = state.habits.length;
    northStarEl.textContent = totalHabits
      ? "You are " + pct + "% through your daily goals."
      : "Add habits to see your daily progress.";
  }

  const energyVal = state.energyLog[todayKey] != null ? state.energyLog[todayKey] : 3;
  const energySlider = $("snapshot-energy-slider");
  const energyValueEl = $("snapshot-energy-value");
  if (energySlider) energySlider.value = energyVal;
  if (energyValueEl) energyValueEl.textContent = energyVal;

  const trendEl = $("snapshot-energy-trend");
  if (trendEl) {
    const last7 = getLast7Days();
    const values = last7.map((d) => state.energyLog[d] != null ? state.energyLog[d] : null);
    const max = 5;
    trendEl.innerHTML = "";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 24");
    svg.setAttribute("class", "energy-trend-svg");
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1 || 1)) * 100;
      const y = 22 - (v != null ? (v / max) * 20 : 0);
      return x + "," + y;
    }).filter((_, i) => values[i] != null);
    if (pts.length >= 2) {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M" + pts.join(" L"));
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.5");
      path.setAttribute("class", "energy-trend-line");
      svg.appendChild(path);
    }
    trendEl.appendChild(svg);
  }

  const deepWorkHours = Number(state.deepWorkLog[todayKey]) || 0;
  const target = Number(state.deepWorkTarget) || 2;
  const deepworkPct = target > 0 ? Math.min(100, Math.round((deepWorkHours / target) * 100)) : 0;
  const circum = 2 * Math.PI * 15.5;
  const dashFilled = (deepworkPct / 100) * circum;
  const ringFill = $("snapshot-deepwork-ring-fill");
  if (ringFill) ringFill.setAttribute("stroke-dasharray", dashFilled.toFixed(2) + " " + circum.toFixed(2));
  const currentEl = $("snapshot-deepwork-current");
  const targetEl = $("snapshot-deepwork-target");
  if (currentEl) currentEl.textContent = deepWorkHours;
  if (targetEl) targetEl.textContent = target;
  const deepworkInput = $("snapshot-deepwork-input");
  if (deepworkInput) deepworkInput.value = deepWorkHours || "";
  const deepworkTargetInput = $("snapshot-deepwork-target");
  if (deepworkTargetInput) deepworkTargetInput.value = target;

  const insightInput = $("snapshot-insight-input");
  if (insightInput) insightInput.value = state.insightLog[todayKey] || "";

  const momentumBar = $("snapshot-momentum-bar");
  const momentumLegend = $("snapshot-momentum-legend");
  if (momentumBar) {
    momentumBar.innerHTML = "";
    const todayMap = state.habitCompletions[todayKey] || {};
    state.habits.forEach((h) => {
      const done = !!todayMap[h.id];
      const sq = document.createElement("span");
      sq.className = "momentum-square" + (done ? " done" : "");
      sq.setAttribute("title", h.name + (done ? " — done" : " — not done"));
      sq.setAttribute("aria-label", h.name + (done ? ", completed" : ", not completed"));
      momentumBar.appendChild(sq);
    });
  }
  if (momentumLegend) {
    const todayMap = state.habitCompletions[todayKey] || {};
    const done = state.habits.filter((h) => !!todayMap[h.id]).length;
    momentumLegend.textContent = state.habits.length
      ? done + " / " + state.habits.length + " habits completed today"
      : "No habits yet — add habits below.";
  }
}

function setupDailySnapshot() {
  const todayKey = todayStr();
  const energySlider = $("snapshot-energy-slider");
  if (energySlider) {
    energySlider.value = state.energyLog[todayKey] != null ? state.energyLog[todayKey] : 3;
    energySlider.addEventListener("input", function () {
      const v = parseInt(energySlider.value, 10);
      state.energyLog[todayStr()] = v;
      saveState();
      if ($("snapshot-energy-value")) $("snapshot-energy-value").textContent = v;
      const trendEl = $("snapshot-energy-trend");
      if (trendEl) {
        const last7 = getLast7Days();
        const values = last7.map((d) => state.energyLog[d] != null ? state.energyLog[d] : null);
        const max = 5;
        trendEl.innerHTML = "";
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 100 24");
        svg.setAttribute("class", "energy-trend-svg");
        const pts = values.map((v, i) => {
          const x = (i / (values.length - 1 || 1)) * 100;
          const y = 22 - (v != null ? (v / max) * 20 : 0);
          return x + "," + y;
        }).filter((_, i) => values[i] != null);
        if (pts.length >= 2) {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute("d", "M" + pts.join(" L"));
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "currentColor");
          path.setAttribute("stroke-width", "1.5");
          path.setAttribute("class", "energy-trend-line");
          svg.appendChild(path);
        }
        trendEl.appendChild(svg);
      }
    });
  }

  const deepworkInput = $("snapshot-deepwork-input");
  if (deepworkInput) {
    deepworkInput.addEventListener("change", function () {
      const v = parseFloat(deepworkInput.value, 10);
      state.deepWorkLog[todayStr()] = isNaN(v) ? 0 : Math.max(0, v);
      saveState();
      renderDailySnapshot();
    });
  }
  const deepworkTargetInput = $("snapshot-deepwork-target");
  if (deepworkTargetInput) {
    deepworkTargetInput.addEventListener("change", function () {
      const v = parseFloat(deepworkTargetInput.value, 10);
      state.deepWorkTarget = isNaN(v) ? 2 : Math.max(0.5, v);
      saveState();
      renderDailySnapshot();
    });
  }

  const insightInput = $("snapshot-insight-input");
  if (insightInput) {
    insightInput.addEventListener("blur", function () {
      state.insightLog[todayStr()] = insightInput.value.trim();
      saveState();
    });
  }

  renderDailySnapshot();
}

// Finances
function setupFinances() {
  const goalForm = $("goal-form");
  if (goalForm) {
    function handleGoalSave(e) {
      if (e) e.preventDefault();
      try {
        const id = $("goal-id").value || safeId();
        const name = $("goal-name").value.trim();
        const target = Number($("goal-target").value || 0);
        const current = Number($("goal-current").value || 0);
        if (!name) return;

        const existingIndex = state.savingsGoals.findIndex((g) => g.id === id);
        const goal = { id, name, target, current };
        if (existingIndex >= 0) {
          state.savingsGoals[existingIndex] = goal;
        } else {
          state.savingsGoals.push(goal);
        }
        saveState();
        goalForm.reset();
        $("goal-id").value = "";
        renderFinances();
        renderDashboard();
      } catch (err) {
        console.error("Goal save error", err);
        showSaveError("Could not save goal. Try again.");
      }
    }
    goalForm.addEventListener("submit", handleGoalSave);
    goalForm.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handleGoalSave(null); });
  }

  const debtForm = $("debt-form");
  if (debtForm) {
    function handleDebtSave(e) {
      if (e) e.preventDefault();
      try {
        const id = $("debt-id").value || safeId();
        const name = $("debt-name").value.trim();
        const total = Number($("debt-total").value || 0);
        const remaining = Number($("debt-remaining").value || 0);
        const dueDate = ($("debt-due-date") && $("debt-due-date").value) || "";
        if (!name) return;

        const existingIndex = state.debts.findIndex((d) => d.id === id);
        const debt = { id, name, total, remaining, dueDate };
        if (existingIndex >= 0) {
          state.debts[existingIndex] = debt;
        } else {
          state.debts.push(debt);
        }
        saveState();
        debtForm.reset();
        $("debt-id").value = "";
        if ($("debt-due-date")) $("debt-due-date").value = "";
        renderFinances();
        renderDashboard();
      } catch (err) {
        console.error("Debt save error", err);
        showSaveError("Could not save debt. Try again.");
      }
    }
    debtForm.addEventListener("submit", handleDebtSave);
    debtForm.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handleDebtSave(null); });
  }
}

function deleteGoal(id) {
  state.savingsGoals = state.savingsGoals.filter((g) => g.id !== id);
  saveState();
  renderFinances();
  renderDashboard();
}

function editGoal(id) {
  const goal = state.savingsGoals.find((g) => g.id === id);
  if (!goal) return;
  $("goal-id").value = goal.id;
  $("goal-name").value = goal.name;
  $("goal-target").value = goal.target;
  $("goal-current").value = goal.current;
}

function deleteDebt(id) {
  state.debts = state.debts.filter((d) => d.id !== id);
  saveState();
  renderFinances();
  renderDashboard();
}

function editDebt(id) {
  const debt = state.debts.find((d) => d.id === id);
  if (!debt) return;
  $("debt-id").value = debt.id;
  $("debt-name").value = debt.name;
  $("debt-total").value = debt.total;
  $("debt-remaining").value = debt.remaining;
  if ($("debt-due-date")) $("debt-due-date").value = debt.dueDate || "";
}

function renderFinances() {
  const boundaryBanner = $("finance-people-boundary-banner");
  if (boundaryBanner) {
    const limit = Number(profile.peopleFinancialBoundary) || 0;
    const exceeded = (state.people || []).filter((p) => p.ledger && Math.abs(Number(p.ledger.balance) || 0) >= limit);
    if (limit > 0 && exceeded.length > 0) {
      boundaryBanner.classList.remove("hidden");
      boundaryBanner.innerHTML = `<a href="#" data-tab="people">Person balance(s) exceed ${formatCurrency(limit)}</a> — ${exceeded.map((p) => p.name).join(", ")}`;
      boundaryBanner.querySelector("a")?.addEventListener("click", (e) => { e.preventDefault(); switchToTab("people"); });
    } else {
      boundaryBanner.classList.add("hidden");
      boundaryBanner.innerHTML = "";
    }
  }
  const debtDueBanner = $("finance-debt-due-banner");
  if (debtDueBanner && profile.debtWarning) {
    const today = todayStr();
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    const maxDate = inTwoDays.toISOString().slice(0, 10);
    const dueSoon = (state.debts || []).filter((d) => {
      const due = d.dueDate;
      if (!due) return false;
      return due >= today && due <= maxDate;
    });
    if (dueSoon.length > 0) {
      debtDueBanner.classList.remove("hidden");
      debtDueBanner.textContent = "PAYMENT DUE WITHIN 2 DAYS: " + dueSoon.map((d) => d.name + (d.dueDate ? " (" + d.dueDate + ")" : "")).join(", ");
    } else {
      debtDueBanner.classList.add("hidden");
      debtDueBanner.textContent = "";
    }
  } else if (debtDueBanner) {
    debtDueBanner.classList.add("hidden");
    debtDueBanner.innerHTML = "";
  }
  const goalsEl = $("goals-circles");
  if (!goalsEl) return;
  goalsEl.innerHTML = "";
  state.savingsGoals.forEach((goal) => {
    const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
    const circle = document.createElement("div");
    circle.className = "progress-circle-wrap";
    circle.innerHTML = `
      <div class="progress-circle" style="--pct: ${pct}">
        <span class="progress-circle-value">${pct}%</span>
      </div>
      <div class="progress-circle-label">
        <strong>${goal.name}</strong>
        <span>${formatCurrency(goal.current)} / ${formatCurrency(goal.target)}</span>
      </div>
      <div class="row-actions">
        <button type="button" class="tiny-btn" data-action="edit">EDIT</button>
        <button type="button" class="tiny-btn danger" data-action="delete">DELETE</button>
      </div>
    `;
    circle.querySelector('[data-action="edit"]').addEventListener("click", () => editGoal(goal.id));
    circle.querySelector('[data-action="delete"]').addEventListener("click", () => deleteGoal(goal.id));
    goalsEl.appendChild(circle);
  });

  const debtsList = $("debts-list");
  if (debtsList) {
    debtsList.innerHTML = "";
    state.debts.forEach((debt) => {
      const li = document.createElement("li");
      const dueTag = debt.dueDate ? "<span class=\"tag tag-soft\">Due " + debt.dueDate + "</span>" : "";
      li.innerHTML = `
        <span>
          <strong>${debt.name}</strong>
          <span class="tag tag-danger">${formatCurrency(debt.remaining)} left</span>${dueTag}
        </span>
        <span class="row-actions">
          <button type="button" class="tiny-btn" data-action="edit">EDIT</button>
          <button type="button" class="tiny-btn danger" data-action="delete">DELETE</button>
        </span>
      `;
      li.querySelector('[data-action="edit"]').addEventListener("click", () => editDebt(debt.id));
      li.querySelector('[data-action="delete"]').addEventListener("click", () => deleteDebt(debt.id));
      debtsList.appendChild(li);
    });
  }
}

function totalDebtRemaining() {
  return state.debts.reduce((sum, d) => sum + (Number(d.remaining) || 0), 0);
}

function formatDebtGoalDate(isoDate) {
  if (!isoDate || !isoDate.trim()) return "—";
  const d = new Date(isoDate.trim());
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function getDebtHistoryForChart() {
  const history = state.debtHistory || [];
  if (history.length === 0) return [];
  const byMonth = {};
  history.forEach((entry) => {
    const month = entry.date.slice(0, 7);
    byMonth[month] = entry.total;
  });
  const months = Object.keys(byMonth).sort();
  const last6 = months.slice(-6);
  return last6.map((m) => {
    const d = new Date(m + "-01");
    return {
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      total: byMonth[m],
    };
  });
}

function renderSubtleStatsBar(barId, textId, chartId) {
  const total = totalDebtRemaining();
  const goalDate = formatDebtGoalDate(profile.targetDebtFreeDate || "");
  const textEl = document.getElementById(textId);
  if (textEl) {
    textEl.innerHTML = "<a href=\"#\" class=\"subtle-stats-link\" data-tab=\"finance\">Total Debt: " + formatCurrency(total) + "</a> | Goal: Clear by " + goalDate;
    textEl.querySelector("a")?.addEventListener("click", function (e) {
      e.preventDefault();
      switchToTab("finance");
    });
  }
  const chartEl = document.getElementById(chartId);
  if (!chartEl) return;
  chartEl.innerHTML = "";
  const data = getDebtHistoryForChart();
  if (data.length < 2) {
    const msg = document.createElement("p");
    msg.className = "subtle-stats-chart-empty";
    msg.textContent = "Debt trend builds as you use the app.";
    chartEl.appendChild(msg);
    return;
  }
  const values = data.map((d) => d.total);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;
  const w = 200;
  const h = 44;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("class", "subtle-stats-chart-svg");
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 20) + 10;
    const y = h - 12 - ((v - minVal) / range) * (h - 20);
    return x + "," + y;
  });
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M" + pts.join(" L"));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.5");
  path.setAttribute("class", "subtle-stats-trend-line");
  svg.appendChild(path);
  chartEl.appendChild(svg);
}

// Appointments
function setupAppointments() {
  const form = $("appointment-form");
  if (!form) return;
  function handleAppointmentSave(e) {
    if (e) e.preventDefault();
    try {
      const id = $("appointment-id").value || safeId();
      const title = $("appointment-title").value.trim();
      const date = $("appointment-date").value;
      const time = $("appointment-time").value;
      const notes = $("appointment-notes").value.trim();
      if (!title || !date || !time) return;

      const existingIndex = state.appointments.findIndex((a) => a.id === id);
      const appt = { id, title, date, time, notes };
      if (existingIndex >= 0) {
        state.appointments[existingIndex] = appt;
      } else {
        state.appointments.push(appt);
      }
      saveState();
      form.reset();
      $("appointment-id").value = "";
      renderAppointments();
      renderDashboard();
    } catch (err) {
      console.error("Appointment save error", err);
      showSaveError("Could not save appointment. Try again.");
    }
  }
  form.addEventListener("submit", handleAppointmentSave);
  form.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handleAppointmentSave(null); });
}

function deleteAppointment(id) {
  state.appointments = state.appointments.filter((a) => a.id !== id);
  saveState();
  renderAppointments();
  renderDashboard();
}

function editAppointment(id) {
  const appt = state.appointments.find((a) => a.id === id);
  if (!appt) return;
  $("appointment-id").value = appt.id;
  $("appointment-title").value = appt.title;
  $("appointment-date").value = appt.date;
  $("appointment-time").value = appt.time;
  $("appointment-notes").value = appt.notes;
}

function renderAppointments() {
  const list = $("appointments-list");
  list.innerHTML = "";

  const sorted = sortByDateAsc(state.appointments, "date");
  const today = todayStr();

  sorted.forEach((appt) => {
    const li = document.createElement("li");
    const tagClass = appt.date < today ? "tag-soft" : "tag-success";
    const label = appt.date < today ? "Past" : appt.date === today ? "Today" : "Upcoming";
    li.innerHTML = `
      <span>
        <strong>${appt.title}</strong>
        <span class="tag ${tagClass}">${label}</span>
        <span class="tag tag-soft">${appt.date} · ${appt.time}</span>
      </span>
      <span class="row-actions">
        <button class="tiny-btn" data-action="edit">EDIT</button>
        <button class="tiny-btn danger" data-action="delete">DELETE</button>
      </span>
    `;
    li.querySelector('[data-action="edit"]').addEventListener("click", () => editAppointment(appt.id));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => deleteAppointment(appt.id));
    list.appendChild(li);
  });
}

// People / Personal CRM
function getDaysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const diff = now - d;
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function initials(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name.trim()[0] || "?").toUpperCase();
}

let selectedPersonId = null;

function setupPeople() {
  const form = $("person-form");
  const formWrap = $("people-form-wrap");
  const addBtn = $("people-add-btn");
  const cancelBtn = $("person-cancel-btn");
  if (!form || !formWrap) return;

  function handlePersonSave(e) {
    if (e) e.preventDefault();
    try {
      const id = $("person-id").value || safeId();
      const name = $("person-name").value.trim();
      const connectionType = $("person-connection-type").value || "Friend";
      const birthday = $("person-birthday").value || "";
      const lastSpoken = $("person-last-spoken").value || "";
      const notes = $("person-notes").value.trim();
      const giftIdeas = $("person-gift-ideas").value.trim();
      if (!name) return;
      const existing = state.people.find((p) => p.id === id);
      const person = {
        id,
        name,
        connectionType,
        birthday,
        lastSpoken,
        notes,
        giftIdeas,
        touchpoints: existing ? (existing.touchpoints || []) : [],
        ledger: existing && existing.ledger ? existing.ledger : { balance: 0, transactions: [] },
        linkedHabitId: existing && existing.linkedHabitId ? existing.linkedHabitId : "",
        linkedDebtId: existing && existing.linkedDebtId ? existing.linkedDebtId : "",
        linkedGoalId: existing && existing.linkedGoalId ? existing.linkedGoalId : "",
      };
      const idx = state.people.findIndex((p) => p.id === id);
      if (idx >= 0) state.people[idx] = person;
      else state.people.push(person);
      saveState();
      form.reset();
      $("person-id").value = "";
      formWrap.classList.add("hidden");
      renderPeople();
      renderDashboard();
      selectedPersonId = id;
      renderPeopleDetail(id);
    } catch (err) {
      console.error("Person save error", err);
      showSaveError("Could not save person. Try again.");
    }
  }
  form.addEventListener("submit", handlePersonSave);
  form.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handlePersonSave(null); });

  var addToCircleModal = $("add-to-circle-modal");
  var addToCircleFormWrap = $("add-to-circle-form-wrap");
  var addToCircleSuccessWrap = $("add-to-circle-success-wrap");
  var addToCircleForm = $("add-to-circle-form");
  var addToCircleLinkToggle = $("add-to-circle-link-toggle");
  var addToCircleLinkOptions = $("add-to-circle-link-options");
  var addToCircleHabitSelect = $("add-to-circle-habit");
  var addToCircleDebtSelect = $("add-to-circle-debt");
  var addToCircleGoalSelect = $("add-to-circle-goal");

  addBtn?.addEventListener("click", function () {
    $("add-to-circle-person-id").value = "";
    if (addToCircleForm) addToCircleForm.reset();
    if (addToCircleLinkToggle) addToCircleLinkToggle.checked = false;
    if (addToCircleLinkOptions) addToCircleLinkOptions.classList.add("hidden");
    if (addToCircleDebtSelect) {
      addToCircleDebtSelect.innerHTML = '<option value="">— NONE —</option>';
      (state.debts || []).forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.name + " (" + formatCurrency(d.remaining) + ")";
        addToCircleDebtSelect.appendChild(opt);
      });
    }
    if (addToCircleGoalSelect) {
      addToCircleGoalSelect.innerHTML = '<option value="">— NONE —</option>';
      (state.savingsGoals || []).forEach(function (g) {
        var opt = document.createElement("option");
        opt.value = g.id;
        opt.textContent = g.name;
        addToCircleGoalSelect.appendChild(opt);
      });
    }
    if (addToCircleHabitSelect) {
      addToCircleHabitSelect.innerHTML = '<option value="">— SELECT HABIT —</option>';
      (state.habits || []).forEach(function (h) {
        var opt = document.createElement("option");
        opt.value = h.id;
        opt.textContent = h.name;
        addToCircleHabitSelect.appendChild(opt);
      });
    }
    if (addToCircleFormWrap) addToCircleFormWrap.classList.remove("hidden");
    if (addToCircleSuccessWrap) addToCircleSuccessWrap.classList.add("hidden");
    if (addToCircleModal) addToCircleModal.classList.remove("hidden");
    selectedPersonId = null;
    $("people-detail-content").classList.add("hidden");
    $("people-detail-empty").classList.remove("hidden");
  });

  addToCircleLinkToggle?.addEventListener("change", function () {
    if (addToCircleLinkOptions) addToCircleLinkOptions.classList.toggle("hidden", !addToCircleLinkToggle.checked);
  });

  addToCircleModal?.addEventListener("click", function (e) {
    if (e.target === addToCircleModal) addToCircleModal.classList.add("hidden");
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && addToCircleModal && !addToCircleModal.classList.contains("hidden")) {
      addToCircleModal.classList.add("hidden");
    }
  });

  addToCircleForm?.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("add-to-circle-name") && $("add-to-circle-name").value.trim();
    if (!name) {
      showSaveError("Please enter a name.");
      return;
    }
    var id = $("add-to-circle-person-id") && $("add-to-circle-person-id").value;
    if (!id) id = safeId();
    var connectionType = $("add-to-circle-connection") && $("add-to-circle-connection").value;
    if (!connectionType) connectionType = "Friend";
    var birthday = $("add-to-circle-birthday") && $("add-to-circle-birthday").value;
    var linkedHabitId = addToCircleHabitSelect && addToCircleLinkToggle && addToCircleLinkToggle.checked ? (addToCircleHabitSelect.value || "") : "";
    var linkedDebtId = addToCircleDebtSelect && addToCircleLinkToggle && addToCircleLinkToggle.checked ? (addToCircleDebtSelect.value || "") : "";
    var linkedGoalId = addToCircleGoalSelect && addToCircleLinkToggle && addToCircleLinkToggle.checked ? (addToCircleGoalSelect.value || "") : "";
    var person = {
      id: id,
      name: name,
      connectionType: connectionType,
      birthday: birthday || "",
      lastSpoken: "",
      notes: "",
      giftIdeas: "",
      touchpoints: [],
      ledger: { balance: 0, transactions: [] },
      linkedHabitId: linkedHabitId,
      linkedDebtId: linkedDebtId,
      linkedGoalId: linkedGoalId,
    };
    state.people.push(person);
    saveState();
    if (addToCircleFormWrap) addToCircleFormWrap.classList.add("hidden");
    if (addToCircleSuccessWrap) addToCircleSuccessWrap.classList.remove("hidden");
    var successAvatar = $("add-to-circle-success-avatar");
    var successText = $("add-to-circle-success-text");
    if (successAvatar) successAvatar.textContent = initials(name);
    if (successText) successText.textContent = name + " IS NOW IN YOUR CIRCLE.";
    setTimeout(function () {
      if (addToCircleModal) addToCircleModal.classList.add("hidden");
      renderPeople();
      renderFinances();
      renderDashboard();
      selectedPersonId = id;
      renderPeopleDetail(id);
    }, 1000);
  });

  cancelBtn?.addEventListener("click", () => {
    formWrap.classList.add("hidden");
  });

  $("people-detail-edit-btn")?.addEventListener("click", () => {
    if (!selectedPersonId) return;
    const p = state.people.find((x) => x.id === selectedPersonId);
    if (!p) return;
    $("person-id").value = p.id;
    $("person-name").value = p.name || "";
    $("person-connection-type").value = p.connectionType || "Friend";
    $("person-birthday").value = p.birthday || "";
    $("person-last-spoken").value = p.lastSpoken || "";
    $("person-notes").value = p.notes || "";
    $("person-gift-ideas").value = p.giftIdeas || "";
    formWrap.classList.remove("hidden");
  });

  $("people-detail-delete-btn")?.addEventListener("click", () => {
    if (!selectedPersonId) return;
    if (typeof confirm !== "undefined" && !confirm("Delete this contact and their ledger? This cannot be undone.")) return;
    state.people = state.people.filter((p) => p.id !== selectedPersonId);
    saveState();
    selectedPersonId = null;
    $("people-detail-content").classList.add("hidden");
    $("people-detail-empty").classList.remove("hidden");
    formWrap.classList.add("hidden");
    renderPeople();
    renderFinances();
    renderDashboard();
  });

  const directory = $("people-directory");
  if (directory) directory.addEventListener("click", (e) => {
    const card = e.target.closest(".people-card[data-person-id]");
    if (!card) return;
    e.preventDefault();
    const id = card.getAttribute("data-person-id");
    selectedPersonId = id;
    renderPeopleDetail(id);
  });

  const detailNotes = $("people-detail-notes");
  const detailGiftIdeas = $("people-detail-gift-ideas");
  function saveDetailNotes() {
    if (!selectedPersonId) return;
    const p = state.people.find((x) => x.id === selectedPersonId);
    if (!p) return;
    p.notes = detailNotes ? detailNotes.value.trim() : p.notes;
    p.giftIdeas = detailGiftIdeas ? detailGiftIdeas.value.trim() : p.giftIdeas;
    saveState();
  }
  if (detailNotes) detailNotes.addEventListener("blur", saveDetailNotes);
  if (detailGiftIdeas) detailGiftIdeas.addEventListener("blur", saveDetailNotes);

  const logPaymentBtn = $("people-ledger-log-payment");
  const addExpenseBtn = $("people-ledger-add-expense");
  const txModal = $("people-transaction-modal");
  const txForm = $("people-transaction-form");
  const txCancel = $("people-tx-cancel");
  const txTitle = $("people-transaction-modal-title");

  function openTransactionModal(mode) {
    if (!selectedPersonId) return;
    txTitle.textContent = mode === "payment" ? "LOG PAYMENT" : "ADD EXPENSE";
    var pidEl = $("people-tx-person-id");
    var dateEl = $("people-tx-date");
    var descEl = $("people-tx-description");
    var amtEl = $("people-tx-amount");
    if (pidEl) pidEl.value = selectedPersonId;
    if (dateEl) dateEl.value = todayStr();
    if (descEl) descEl.value = "";
    if (amtEl) amtEl.value = "";
    txModal.classList.remove("hidden");
  }
  logPaymentBtn?.addEventListener("click", function () { openTransactionModal("payment"); });
  addExpenseBtn?.addEventListener("click", function () { openTransactionModal("expense"); });

  txCancel?.addEventListener("click", () => txModal.classList.add("hidden"));

  function handleTransactionSubmit(e) {
    if (e) e.preventDefault();
    var personId = $("people-tx-person-id") && $("people-tx-person-id").value;
    var date = $("people-tx-date") && $("people-tx-date").value;
    var desc = $("people-tx-description") && $("people-tx-description").value.trim();
    var amount = $("people-tx-amount") && $("people-tx-amount").value;
    amount = amount === "" || amount === null ? NaN : Number(amount);
    if (!personId || !date || !desc || isNaN(amount)) {
      showSaveError("Please fill in date, description, and amount.");
      return;
    }
    var p = state.people.find(function (x) { return x.id === personId; });
    if (!p || !p.ledger) return;
    p.ledger.transactions = p.ledger.transactions || [];
    p.ledger.transactions.push({ id: safeId(), date: date, description: desc, amount: amount });
    p.ledger.balance = (Number(p.ledger.balance) || 0) + amount;
    saveState();
    txModal.classList.add("hidden");
    txForm.reset();
    if (selectedPersonId === personId) renderPeopleDetail(personId);
    renderPeople();
    renderFinances();
    renderDashboard();
  }
  if (txForm) {
    txForm.addEventListener("submit", handleTransactionSubmit);
  }
}

function renderPeopleDetail(personId) {
  const emptyEl = $("people-detail-empty");
  const contentEl = $("people-detail-content");
  const person = state.people.find((p) => p.id === personId);
  if (!person) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    if (contentEl) contentEl.classList.add("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");
  if (contentEl) contentEl.classList.remove("hidden");

  const avatarEl = $("people-detail-avatar");
  if (avatarEl) avatarEl.textContent = initials(person.name);
  const nameEl = $("people-detail-name");
  if (nameEl) nameEl.textContent = person.name;
  const connectionEl = $("people-detail-connection");
  if (connectionEl) connectionEl.textContent = person.connectionType || "Friend";
  const birthdayEl = $("people-detail-birthday");
  if (birthdayEl) birthdayEl.textContent = person.birthday ? "BIRTHDAY: " + person.birthday : "";
  const lastContactEl = $("people-detail-last-contact");
  const days = getDaysSince(person.lastSpoken);
  if (lastContactEl) lastContactEl.textContent = days != null ? "LAST CONTACTED: " + days + " DAYS AGO" : "LAST CONTACTED: —";

  const notesEl = $("people-detail-notes");
  const giftEl = $("people-detail-gift-ideas");
  if (notesEl) notesEl.value = person.notes || "";
  if (giftEl) giftEl.value = person.giftIdeas || "";

  const balance = Number(person.ledger && person.ledger.balance) || 0;
  const balanceEl = $("people-ledger-balance");
  if (balanceEl) balanceEl.textContent = formatCurrency(Math.abs(balance));
  const owedEl = $("people-ledger-status-owed");
  const youOweEl = $("people-ledger-status-you-owe");
  if (owedEl) { owedEl.classList.toggle("hidden", balance <= 0); }
  if (youOweEl) { youOweEl.classList.toggle("hidden", balance >= 0); }

  const linkedEl = $("people-ledger-linked");
  if (linkedEl) {
    const parts = [];
    if (person.linkedDebtId) {
      const debt = state.debts.find((d) => d.id === person.linkedDebtId);
      if (debt) parts.push("LINKED DEBT: " + debt.name + " (" + formatCurrency(debt.remaining) + ")");
    }
    if (person.linkedGoalId) {
      const goal = state.savingsGoals.find((g) => g.id === person.linkedGoalId);
      if (goal) parts.push("LINKED GOAL: " + goal.name);
    }
    linkedEl.textContent = parts.length ? parts.join(" · ") : "";
    linkedEl.style.display = parts.length ? "" : "none";
  }

  const txList = $("people-ledger-transactions");
  if (txList) {
    txList.innerHTML = "";
    const txs = (person.ledger && person.ledger.transactions) ? [...person.ledger.transactions].sort((a, b) => (b.date || "").localeCompare(a.date || "")) : [];
    txs.slice(0, 3).forEach((tx) => {
      const li = document.createElement("li");
      const amt = Number(tx.amount) || 0;
      const sign = amt >= 0 ? "+" : "";
      li.textContent = (tx.date || "") + ": " + (tx.description || "") + " (" + sign + formatCurrency(amt) + ")";
      txList.appendChild(li);
    });
  }
}

function renderPeople() {
  const directory = $("people-directory");
  if (!directory) return;
  directory.innerHTML = "";
  (state.people || []).forEach((person) => {
    const li = document.createElement("li");
    const days = getDaysSince(person.lastSpoken);
    const notePreview = (person.notes || "").trim().split("\n")[0] || "";
    li.className = "people-card";
    li.setAttribute("data-person-id", person.id);
    li.innerHTML = `
      <div class="people-card-avatar">${initials(person.name)}</div>
      <div class="people-card-body">
        <span class="people-card-name">${person.name}</span>
        <span class="people-card-connection">${person.connectionType || "Friend"}</span>
        <span class="people-card-meta">${days != null ? "LAST SYNC: " + days + " DAYS AGO" : "—"}</span>
        ${notePreview ? '<span class="people-card-note">' + notePreview + "</span>" : ""}
      </div>
    `;
    directory.appendChild(li);
  });
}

// Dashboard: GUI preset – habits checklist, financial snapshot, appointments preview
function renderDashboard() {
  renderSubtleStatsBar("subtle-stats-dashboard", "subtle-stats-dashboard-text", "subtle-stats-dashboard-chart");
  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const dashDateEl = $("dashboard-date");
  if (dashDateEl) dashDateEl.textContent = dateStr;

  const todayKey = todayStr();
  const todayMap = state.habitCompletions[todayKey] || {};

  // Card 1: Habit checklist (dashboard-habits-list)
  const habitsList = $("dashboard-habits-list");
  if (habitsList) {
    habitsList.innerHTML = "";
    habitsList.classList.remove("habit-checklist-empty");
    if (state.habits.length === 0) {
      habitsList.classList.add("habit-checklist-empty");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" class="habit-add-prompt" data-tab="habits" aria-label="Add habit">
          <span class="habit-add-icon">+</span>
          <span>ADD HABIT</span>
        </a>
      `;
      li.querySelector(".habit-add-prompt").addEventListener("click", (e) => {
        e.preventDefault();
        switchToTab("habits");
      });
      habitsList.appendChild(li);
    } else {
      state.habits.slice(0, 6).forEach((h) => {
        const done = !!todayMap[h.id];
        const li = document.createElement("li");
        li.innerHTML = `
          <input type="checkbox" ${done ? "checked" : ""} data-habit-id="${h.id}" aria-label="${h.name}" />
          <span>${h.name}</span>
        `;
        li.querySelector('input[type="checkbox"]').addEventListener("change", () => toggleHabitToday(h.id));
        habitsList.appendChild(li);
      });
    }
  }

  // Card 2: Financial snapshot
  const totalDebt = totalDebtRemaining();
  const monthlyTarget = Number(profile.monthlyDebtPayoffTarget) || 0;
  const monthlyPaid = Number(profile.monthlyDebtPaidThisMonth) || 0;
  const debtPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthlyPaid / monthlyTarget) * 100)) : 0;

  const totalDebtEl = $("dashboard-total-debt");
  if (totalDebtEl) totalDebtEl.innerHTML = `Total Debt: <strong>${formatCurrency(totalDebt)}</strong>`;

  const debtPayoffEl = $("dashboard-debt-payoff");
  if (debtPayoffEl) {
    if (state.debts.length === 0) {
      debtPayoffEl.textContent = "No debts";
    } else if (monthlyTarget <= 0) {
      debtPayoffEl.textContent = "Set monthly target in Profile → Financial Goals";
    } else {
      debtPayoffEl.textContent = `${formatCurrency(monthlyPaid)} / ${formatCurrency(monthlyTarget)} monthly target`;
    }
  }

  const debtProgressEl = $("dashboard-debt-progress");
  if (debtProgressEl) debtProgressEl.style.width = (monthlyTarget > 0 ? debtPct : 0) + "%";

  // Savings goals on dashboard
  const goalsListEl = $("dashboard-goals-list");
  if (goalsListEl) {
    goalsListEl.innerHTML = "";
    goalsListEl.classList.remove("goals-preview-empty");
    if (state.savingsGoals.length === 0) {
      goalsListEl.classList.add("goals-preview-empty");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" class="dashboard-add-prompt" data-tab="finance" aria-label="Add goal">
          <span class="dashboard-add-icon">+</span>
          <span>ADD GOAL</span>
        </a>
      `;
      li.querySelector(".dashboard-add-prompt").addEventListener("click", (e) => {
        e.preventDefault();
        switchToTab("finance");
      });
      goalsListEl.appendChild(li);
    } else {
      state.savingsGoals.forEach((g) => {
        const target = Number(g.target) || 0;
        const current = Number(g.current) || 0;
        const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
        const li = document.createElement("li");
        li.className = "goal-preview-item";
        li.innerHTML = `
          <span class="goal-preview-name">${g.name}</span>
          <span class="goal-preview-amounts">${formatCurrency(current)} / ${formatCurrency(target)}</span>
          <div class="progress-bar progress-bar-sm"><span class="progress-fill" style="width: ${pct}%"></span></div>
        `;
        goalsListEl.appendChild(li);
      });
    }
  }

  const debtsListEl = $("dashboard-debts-list");
  if (debtsListEl) {
    debtsListEl.innerHTML = "";
    debtsListEl.classList.remove("debt-list-empty");
    if (state.debts.length === 0) {
      debtsListEl.classList.add("debt-list-empty");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" class="dashboard-add-prompt" data-tab="finance" aria-label="Add debt">
          <span class="dashboard-add-icon">+</span>
          <span>ADD DEBT</span>
        </a>
      `;
      li.querySelector(".dashboard-add-prompt").addEventListener("click", (e) => {
        e.preventDefault();
        switchToTab("finance");
      });
      debtsListEl.appendChild(li);
    } else {
      state.debts.forEach((d) => {
        const li = document.createElement("li");
        li.textContent = `${d.name}: ${formatCurrency(d.remaining)}`;
        debtsListEl.appendChild(li);
      });
    }
  }

  // Card 3: Appointments preview with icons
  const apptPreview = $("dashboard-appointments-preview");
  if (apptPreview) {
    apptPreview.innerHTML = "";
    apptPreview.classList.remove("appointments-preview-empty");
    const sorted = sortByDateAsc(state.appointments, "date");
    const today = todayStr();
    const upcoming = sorted.filter((a) => a.date >= today).slice(0, 3);
    const icons = [
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
    ];
    if (upcoming.length) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);
      upcoming.forEach((a, i) => {
        const label = a.date === today ? "TODAY" : a.date === tomorrowStr ? "TOMORROW" : "NEXT WEEK";
        const timeStr = a.date === today ? ` (${a.time})` : ` (${a.time})`;
        const li = document.createElement("li");
        li.innerHTML = `<span class="appt-icon">${icons[i % 3]}</span><span class="appt-label">${label}</span><span>${a.title}${timeStr}</span>`;
        apptPreview.appendChild(li);
      });
    } else {
      apptPreview.classList.add("appointments-preview-empty");
      const li = document.createElement("li");
      li.innerHTML = `
        <a href="#" class="dashboard-add-prompt" data-tab="appointments" aria-label="Add Appointment">
          <span class="dashboard-add-icon">+</span>
          <span>ADD APPOINTMENT</span>
        </a>
      `;
      li.querySelector(".dashboard-add-prompt").addEventListener("click", (e) => {
        e.preventDefault();
        switchToTab("appointments");
      });
      apptPreview.appendChild(li);
    }
  }

  const peopleListEl = $("dashboard-people-list");
  if (peopleListEl) {
    peopleListEl.innerHTML = "";
    const people = state.people || [];
    if (people.length === 0) {
      const li = document.createElement("li");
      li.className = "people-preview-empty";
      li.textContent = "NO PEOPLE YET";
      peopleListEl.appendChild(li);
    } else {
      people.slice(0, 5).forEach((p) => {
        const days = getDaysSince(p.lastSpoken);
        const li = document.createElement("li");
        li.innerHTML = `<span class="people-preview-name">${p.name}</span><span class="people-preview-meta">${days != null ? days + " DAYS AGO" : "—"}</span>`;
        peopleListEl.appendChild(li);
      });
    }
  }

  if (typeof renderLifeTotals === "function") renderLifeTotals();
}

function getMonogram(name) {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] || "?").toUpperCase();
}

function renderLifeTotals() {
  const totalHabits = Object.keys(state.habitCompletions || {}).reduce(
    (sum, date) => sum + Object.keys(state.habitCompletions[date] || {}).length,
    0
  );
  const today = todayStr();
  const appointmentsMet = (state.appointments || []).filter((a) => a.date < today).length;
  const totalDebt = totalDebtRemaining();
  const debtMilestone = state.debts && state.debts.length ? "Target: " + formatCurrency(totalDebt) : "—";
  const habitsEl = $("life-total-habits");
  const apptsEl = $("life-total-appointments");
  const debtEl = $("life-total-debt");
  if (habitsEl) habitsEl.textContent = "Habits completed: " + totalHabits;
  if (apptsEl) apptsEl.textContent = "Appointments met: " + appointmentsMet;
  if (debtEl) debtEl.textContent = "Debt milestone: " + debtMilestone;
}

function formatMemberSince(ym) {
  if (!ym) return "—";
  const [y, m] = String(ym).split("-");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = months[parseInt(m, 10) - 1] || m;
  return monthName + " " + (y || "");
}

function renderSavingsBuckets() {
  const list = $("profile-savings-buckets-list");
  if (!list) return;
  list.innerHTML = "";
  (profile.savingsBuckets || []).forEach((b, i) => {
    const div = document.createElement("div");
    div.className = "profile-savings-bucket-item";
    div.innerHTML = `
      <input type="text" data-bucket-field="name" placeholder="Goal name" />
      <input type="number" data-bucket-field="priority" placeholder="Priority" min="1" style="width:80px" />
      <button type="button" class="profile-btn profile-btn-outline tiny" data-bucket-remove="${i}">Remove</button>
    `;
    div.querySelector('input[data-bucket-field="name"]').value = b.name || "";
    div.querySelector('input[data-bucket-field="priority"]').value = b.priority != null ? b.priority : i + 1;
    div.querySelector('input[data-bucket-field="name"]').addEventListener("change", (e) => {
      profile.savingsBuckets[i].name = e.target.value.trim() || "Bucket";
      saveProfile(profile);
    });
    div.querySelector('input[data-bucket-field="priority"]').addEventListener("change", (e) => {
      profile.savingsBuckets[i].priority = parseInt(e.target.value, 10) || 1;
      saveProfile(profile);
    });
    div.querySelector("[data-bucket-remove]").addEventListener("click", () => {
      profile.savingsBuckets.splice(i, 1);
      saveProfile(profile);
      renderSavingsBuckets();
    });
    list.appendChild(div);
  });
}

function setupProfile() {
  const nameEl = $("profile-name");
  const nameInput = $("profile-name-input");
  const nameEditBtn = $("profile-name-edit");
  const nameWrap = document.querySelector(".profile-name-wrap");
  const missionEl = $("profile-mission");
  const missionInput = $("profile-mission-input");
  const missionEditBtn = $("profile-mission-edit");
  const missionWrap = document.querySelector(".profile-mission-wrap");
  const missionCountEl = $("profile-mission-count");
  const monogramEl = $("profile-monogram");

  function updateMissionCount() {
    if (missionCountEl && missionInput) missionCountEl.textContent = (missionInput.value || "").length + "/150";
  }

  if (nameEl) nameEl.textContent = profile.profileName;
  if (nameInput) nameInput.value = profile.profileName;
  if (missionEl) missionEl.textContent = profile.missionStatement;
  if (missionInput) {
    missionInput.value = profile.missionStatement;
    updateMissionCount();
  }
  if (monogramEl) monogramEl.textContent = getMonogram(profile.profileName);

  if ($("profile-member-since")) $("profile-member-since").textContent = "Member since: " + formatMemberSince(profile.memberSince);
  renderLifeTotals();

  const currencyEl = $("profile-currency");
  const dateFormatEl = $("profile-date-format");
  const weeklyResetEl = $("profile-weekly-reset");
  if (currencyEl) { currencyEl.value = profile.currency || "USD"; currencyEl.addEventListener("change", () => { profile.currency = currencyEl.value; saveProfile(profile); }); }
  if (dateFormatEl) { dateFormatEl.value = profile.dateFormat || "MM/DD/YYYY"; dateFormatEl.addEventListener("change", () => { profile.dateFormat = dateFormatEl.value; saveProfile(profile); }); }
  if (weeklyResetEl) { weeklyResetEl.value = String(profile.weeklyResetDay ?? 1); weeklyResetEl.addEventListener("change", () => { profile.weeklyResetDay = Number(weeklyResetEl.value); saveProfile(profile); }); }

  function exitNameEdit() {
    if (!nameWrap) return;
    nameWrap.classList.remove("edit");
    profile.profileName = (nameInput && nameInput.value.trim()) || defaultProfile.profileName;
    if (nameEl) nameEl.textContent = profile.profileName;
    if (monogramEl) monogramEl.textContent = getMonogram(profile.profileName);
    saveProfile(profile);
  }
  if (nameEditBtn && nameWrap && nameInput) {
    nameEditBtn.addEventListener("click", () => { nameWrap.classList.add("edit"); nameInput.value = profile.profileName; nameInput.focus(); });
    nameInput.addEventListener("blur", exitNameEdit);
    nameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") exitNameEdit(); });
  }

  function exitMissionEdit() {
    if (!missionWrap) return;
    missionWrap.classList.remove("edit");
    profile.missionStatement = (missionInput && missionInput.value.trim().slice(0, 150)) || defaultProfile.missionStatement;
    if (missionEl) missionEl.textContent = profile.missionStatement;
    if (missionInput) missionInput.value = profile.missionStatement;
    updateMissionCount();
    saveProfile(profile);
  }
  if (missionEditBtn && missionWrap && missionEl && missionInput) {
    missionEditBtn.addEventListener("click", () => { missionWrap.classList.add("edit"); missionInput.value = profile.missionStatement; missionInput.focus(); updateMissionCount(); });
    missionInput.addEventListener("input", updateMissionCount);
    missionInput.addEventListener("blur", exitMissionEdit);
    missionInput.addEventListener("keydown", (e) => { if (e.key === "Enter") e.preventDefault(); exitMissionEdit(); });
  }

  document.querySelectorAll(".profile-nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const section = item.getAttribute("data-profile-section");
      document.querySelectorAll(".profile-nav-item").forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
      document.querySelectorAll(".profile-section").forEach((s) => s.classList.remove("active"));
      const panel = document.getElementById("profile-section-" + section);
      if (panel) panel.classList.add("active");
    });
  });

  var monthlyTargetInput = $("profile-monthly-payoff-target");
  var monthlyPaidInput = $("profile-monthly-paid");
  if (monthlyTargetInput) {
    monthlyTargetInput.value = profile.monthlyDebtPayoffTarget || "";
    monthlyTargetInput.addEventListener("change", () => {
      profile.monthlyDebtPayoffTarget = Number(monthlyTargetInput.value) || 0;
      saveProfile(profile);
    });
  }
  if (monthlyPaidInput) {
    monthlyPaidInput.value = profile.monthlyDebtPaidThisMonth || "";
    monthlyPaidInput.addEventListener("change", () => {
      profile.monthlyDebtPaidThisMonth = Number(monthlyPaidInput.value) || 0;
      saveProfile(profile);
    });
  }

  var debtFreeEl = $("profile-debt-free-date");
  var monthlyHint = $("profile-monthly-payment-hint");
  if (debtFreeEl) {
    debtFreeEl.value = profile.targetDebtFreeDate || "";
    debtFreeEl.addEventListener("change", () => {
      profile.targetDebtFreeDate = debtFreeEl.value;
      saveProfile(profile);
      if (monthlyHint && debtFreeEl.value) {
        var remaining = totalDebtRemaining();
        var target = new Date(debtFreeEl.value);
        var now = new Date();
        var months = Math.max(1, Math.ceil((target - now) / (30 * 24 * 60 * 60 * 1000)));
        var required = remaining / months;
        monthlyHint.textContent = "Required monthly payment: " + formatCurrency(required);
        if (monthlyTargetInput && !profile.monthlyDebtPayoffTarget) {
          profile.monthlyDebtPayoffTarget = Math.ceil(required);
          if (monthlyTargetInput) monthlyTargetInput.value = profile.monthlyDebtPayoffTarget;
          saveProfile(profile);
        }
      } else if (monthlyHint) monthlyHint.textContent = "";
    });
  }
  var emergGoal = $("profile-emergency-goal");
  var emergCurrent = $("profile-emergency-current");
  var emergProgress = $("profile-emergency-progress");
  if (emergGoal) { emergGoal.value = profile.emergencyFundGoal || ""; emergGoal.addEventListener("change", () => { profile.emergencyFundGoal = Number(emergGoal.value) || 0; saveProfile(profile); updateEmergencyProgress(); }); }
  if (emergCurrent) { emergCurrent.value = profile.emergencyFundCurrent || ""; emergCurrent.addEventListener("change", () => { profile.emergencyFundCurrent = Number(emergCurrent.value) || 0; saveProfile(profile); updateEmergencyProgress(); }); }
  function updateEmergencyProgress() {
    if (!emergProgress || !emergGoal) return;
    var g = Number(emergGoal.value) || 0;
    var c = Number(emergCurrent && emergCurrent.value) || 0;
    var pct = g > 0 ? Math.min(100, Math.round((c / g) * 100)) : 0;
    emergProgress.style.width = pct + "%";
  }
  updateEmergencyProgress();

  var peopleBoundaryEl = $("profile-people-financial-boundary");
  if (peopleBoundaryEl) {
    peopleBoundaryEl.value = profile.peopleFinancialBoundary || "";
    peopleBoundaryEl.addEventListener("change", () => {
      profile.peopleFinancialBoundary = Number(peopleBoundaryEl.value) || 0;
      saveProfile(profile);
    });
  }

  document.querySelectorAll('input[name="debt-priority"]').forEach((r) => {
    r.checked = (profile.debtPriority || "snowball") === r.value;
    r.addEventListener("change", () => { profile.debtPriority = r.value; saveProfile(profile); });
  });
  if (!profile.savingsBuckets || !profile.savingsBuckets.length) profile.savingsBuckets = [{ name: "House", priority: 1 }, { name: "Car", priority: 2 }];
  renderSavingsBuckets();
  $("profile-add-bucket")?.addEventListener("click", () => {
    profile.savingsBuckets = profile.savingsBuckets || [];
    profile.savingsBuckets.push({ name: "New bucket", priority: profile.savingsBuckets.length + 1 });
    saveProfile(profile);
    renderSavingsBuckets();
  });

  var graceEl = $("profile-grace-period");
  if (graceEl) { graceEl.value = profile.gracePeriod || "23:00"; graceEl.addEventListener("change", () => { profile.gracePeriod = graceEl.value; saveProfile(profile); }); }
  var dailyResetEl = $("profile-daily-reset");
  if (dailyResetEl) { dailyResetEl.value = profile.dailyResetTime || "06:00"; dailyResetEl.addEventListener("change", () => { profile.dailyResetTime = dailyResetEl.value; saveProfile(profile); }); }
  var streakEl = $("profile-streak-protection");
  if (streakEl) { streakEl.checked = !!profile.streakProtection; streakEl.addEventListener("change", () => { profile.streakProtection = streakEl.checked; saveProfile(profile); }); }
  document.querySelectorAll('input[name="checkin-counts"]').forEach((r) => {
    r.checked = (profile.checkInCountsAs || "boolean") === r.value;
    r.addEventListener("change", () => { profile.checkInCountsAs = r.value; saveProfile(profile); });
  });

  var morningNudge = $("profile-morning-nudge");
  var morningTime = $("profile-morning-nudge-time");
  if (morningNudge) { morningNudge.checked = !!profile.morningNudge; morningNudge.addEventListener("change", () => { profile.morningNudge = morningNudge.checked; saveProfile(profile); }); }
  if (morningTime) { morningTime.value = profile.morningNudgeTime || "08:00"; morningTime.addEventListener("change", () => { profile.morningNudgeTime = morningTime.value; saveProfile(profile); }); }
  var eveningNudge = $("profile-evening-nudge");
  var eveningTime = $("profile-evening-nudge-time");
  if (eveningNudge) { eveningNudge.checked = !!profile.eveningNudge; eveningNudge.addEventListener("change", () => { profile.eveningNudge = eveningNudge.checked; saveProfile(profile); }); }
  if (eveningTime) { eveningTime.value = profile.eveningNudgeTime || "21:00"; eveningTime.addEventListener("change", () => { profile.eveningNudgeTime = eveningTime.value; saveProfile(profile); }); }
  var debtWarn = $("profile-debt-warning");
  if (debtWarn) { debtWarn.checked = !!profile.debtWarning; debtWarn.addEventListener("change", () => { profile.debtWarning = debtWarn.checked; saveProfile(profile); }); }
  var apptBuffer = $("profile-appointment-buffer");
  if (apptBuffer) { apptBuffer.value = String(profile.appointmentBuffer ?? 15); apptBuffer.addEventListener("change", () => { profile.appointmentBuffer = Number(apptBuffer.value); saveProfile(profile); }); }

  var privacyBlur = $("profile-privacy-blur");
  if (privacyBlur) {
    privacyBlur.checked = !!(profile.privacyBlur || profile.hideFinancialNumbers);
    privacyBlur.addEventListener("change", () => { profile.privacyBlur = privacyBlur.checked; profile.hideFinancialNumbers = privacyBlur.checked; saveProfile(profile); });
  }
  var twoFaStatus = $("profile-2fa-status");
  if (twoFaStatus) twoFaStatus.textContent = profile.twoFactorEnabled ? "Enabled" : "Disabled";
  $("profile-2fa-configure")?.addEventListener("click", () => { if (typeof alert !== "undefined") alert("2FA configuration will be available in a future update."); });
  $("profile-logout-others")?.addEventListener("click", () => { if (typeof alert !== "undefined") alert("Logged out of all other devices (placeholder)."); });
  $("profile-download-data")?.addEventListener("click", () => {
    var data = { state, profile, exportedAt: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lifeflow-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof alert !== "undefined") alert("Data downloaded as JSON.");
  });
  $("profile-delete-account")?.addEventListener("click", () => {
    if (typeof confirm !== "undefined" && confirm("Permanently delete account and all data? This cannot be undone.")) {
      if (typeof alert !== "undefined") alert("Delete account flow will be available in a future update.");
    }
  });
}

function init() {
  try {
    if (!storage) {
      showSaveError("Data cannot be saved. Use npx serve or turn off private browsing.");
    }
    try { setupColorPalette(); } catch (e) { console.error("setupColorPalette", e); }
    try { setupAvatar(); } catch (e) { console.error("setupAvatar", e); }
    try { setupTabs(); } catch (e) { console.error("setupTabs", e); }
    try { setupHabits(); } catch (e) { console.error("setupHabits", e); }
    try { setupDailySnapshot(); } catch (e) { console.error("setupDailySnapshot", e); }
    try { setupFinances(); } catch (e) { console.error("setupFinances", e); }
    try { setupAppointments(); } catch (e) { console.error("setupAppointments", e); }
    try { setupPeople(); } catch (e) { console.error("setupPeople", e); }
    try { setupProfile(); } catch (e) { console.error("setupProfile", e); }

    try { renderDailySnapshot(); } catch (e) { console.error("renderDailySnapshot", e); }
    try { renderHabits(); } catch (e) { console.error("renderHabits", e); }
    try { renderFinances(); } catch (e) { console.error("renderFinances", e); }
    try { renderAppointments(); } catch (e) { console.error("renderAppointments", e); }
    try { renderPeople(); } catch (e) { console.error("renderPeople", e); }
    try { renderDashboard(); } catch (e) { console.error("renderDashboard", e); }
  } catch (e) {
    console.error("init error", e);
  }
}

window.init = init;
// Run when DOM is ready; also allow HTML to call init() after script load
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

