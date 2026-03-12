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
  { id: "sage", hex: "#9caf88", strong: "#7d9369" },
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
  feedLog: [],
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
      merged.habits = (merged.habits || []).map((h) => ({
        ...h,
        description: h.description || h.name,
        color: h.color || (COLOR_PALETTE[0] && COLOR_PALETTE[0].hex) || "#9caf88",
      }));
      merged.debts = (merged.debts || []).map((d) => ({ ...d, dueDate: d.dueDate || "" }));
      merged.energyLog = merged.energyLog || {};
      merged.deepWorkTarget = typeof merged.deepWorkTarget === "number" ? merged.deepWorkTarget : 2;
      merged.deepWorkLog = merged.deepWorkLog || {};
      merged.insightLog = merged.insightLog || {};
      merged.debtHistory = Array.isArray(merged.debtHistory) ? merged.debtHistory.slice(-180) : [];
      merged.feedLog = Array.isArray(merged.feedLog) ? merged.feedLog.slice(-500) : [];
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

/** Call deployed /api/generate-insight (Vercel). Returns insight text or throws. */
async function fetchAIDailyInsight() {
  const url = typeof location !== "undefined" && location.origin ? `${location.origin}/api/generate-insight` : "/api/generate-insight";
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.details || "Failed to generate insight");
  if (!data.insight || typeof data.insight !== "string") throw new Error("Invalid response");
  return data.insight.trim();
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

var ENERGY_QUOTES = [
  "Rest is part of the journey. Be kind to yourself today.",
  "Small steps still move you forward. You've got this.",
  "Steady as you go. You're right where you need to be.",
  "You're in the flow. Keep that momentum going.",
  "You're doing great today. Your energy is a gift."
];
function getEnergyQuote(level) {
  var i = Math.max(1, Math.min(5, parseInt(level, 10) || 1)) - 1;
  return ENERGY_QUOTES[i] || ENERGY_QUOTES[2];
}

var FEED_PAGE_SIZE = 10;
var FEED_INITIAL_SIZE = 15;
var activityFeedLimit = FEED_INITIAL_SIZE;

function getFeedItems(limit) {
  var items = [];
  var log = state.feedLog || [];
  log.forEach(function (entry) {
    items.push({
      date: entry.date,
      time: entry.time || "",
      type: entry.type || "habit",
      label: entry.label || "",
      detail: entry.detail || "",
      sortKey: (entry.date || "") + " " + (entry.time || "23:59"),
    });
  });
  var completions = state.habitCompletions || {};
  var habitNames = {};
  (state.habits || []).forEach(function (h) { habitNames[h.id] = h.name; });
  Object.keys(completions).sort().reverse().forEach(function (date) {
    var map = completions[date] || {};
    Object.keys(map).forEach(function (habitId) {
      if (!map[habitId]) return;
      items.push({
        date: date,
        time: "",
        type: "habit",
        label: habitNames[habitId] || "Habit",
        detail: "Completed",
        sortKey: date + " 12:00",
      });
    });
  });
  (state.people || []).forEach(function (p) {
    var txs = (p.ledger && p.ledger.transactions) ? p.ledger.transactions : [];
    txs.forEach(function (tx) {
      var d = tx.date || "";
      var amt = Number(tx.amount);
      var detail = (tx.description || "").trim();
      if (detail && !isNaN(amt) && amt !== 0) detail += " · " + formatCurrency(amt);
      else if (!detail && !isNaN(amt)) detail = formatCurrency(amt);
      items.push({
        date: d,
        time: "",
        type: "person",
        label: p.name || "Person",
        detail: detail || "—",
        sortKey: d + " 12:00",
      });
    });
  });
  items.sort(function (a, b) { return (b.sortKey || "").localeCompare(a.sortKey || ""); });
  return items.slice(0, limit);
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

// Flow mapping: bottom nav (today, growth, circle, finance) <-> tab (dashboard, habits, people, finance)
const FLOW_TO_TAB = { today: "dashboard", growth: "habits", circle: "people", finance: "finance" };
const TAB_TO_FLOW = { dashboard: "today", habits: "growth", people: "circle", finance: "finance" };

function switchToFlowView(flow) {
  const tab = FLOW_TO_TAB[flow];
  if (tab) switchToTab(tab);
  document.querySelectorAll(".flow-nav-item").forEach((btn) => {
    btn.setAttribute("aria-current", btn.dataset.flow === flow ? "true" : "false");
  });
}

function syncFlowNavFromTab(tab) {
  const flow = TAB_TO_FLOW[tab];
  if (flow) {
    document.querySelectorAll(".flow-nav-item").forEach((btn) => {
      btn.setAttribute("aria-current", btn.dataset.flow === flow ? "true" : "false");
    });
  }
}

// Tabs
function switchToTab(tab) {
  document.querySelectorAll(".nav-link").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tab}`);
  });
  syncFlowNavFromTab(tab);
  closeMobileNav();
}

function closeMobileNav() {
  const nav = document.getElementById("top-nav");
  const menu = document.getElementById("nav-menu");
  const toggle = document.getElementById("nav-toggle");
  if (nav) nav.classList.remove("nav-open");
  if (menu) {
    menu.classList.remove("is-open");
    menu.style.display = "";
    menu.style.visibility = "";
    menu.style.opacity = "";
    menu.style.pointerEvents = "";
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }
}

function toggleUtilityMenu(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById("nav-menu");
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("top-nav");
  if (!menu || !toggle) return;
  const isOpen = !menu.classList.contains("is-open");
  menu.classList.toggle("is-open", isOpen);
  if (nav) nav.classList.toggle("nav-open", isOpen);
  menu.style.display = isOpen ? "flex" : "none";
  menu.style.visibility = isOpen ? "visible" : "hidden";
  menu.style.opacity = isOpen ? "1" : "0";
  menu.style.pointerEvents = isOpen ? "auto" : "none";
  toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  toggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
}
window.toggleUtilityMenu = toggleUtilityMenu;

function setupNavMobile() {
  const toggle = document.getElementById("nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (!toggle || !menu) return;
  document.addEventListener("click", function (e) {
    if (!menu.classList.contains("is-open")) return;
    if (!toggle.contains(e.target) && !menu.contains(e.target)) closeMobileNav();
  });
  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 769px)").matches) closeMobileNav();
  });
}

function setupTabs() {
  document.querySelectorAll(".nav-link, .nav-logo[data-tab], .gui-btn[data-tab], .gui-link[data-tab], .gui-card-add").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.dataset.tab) switchToTab(el.dataset.tab);
    });
  });
  document.querySelectorAll("[data-flow]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      if (el.dataset.flow) switchToFlowView(el.dataset.flow);
    });
  });
}

function setupFlowNav() {
  document.querySelectorAll(".flow-nav-item").forEach((btn) => {
    btn.addEventListener("click", function () {
      if (this.dataset.flow) switchToFlowView(this.dataset.flow);
    });
  });
}

function setupQuickLog() {
  const overlay = document.getElementById("quick-log-overlay");
  const openBtn = document.getElementById("flow-quick-log-btn");
  const closeBtn = document.getElementById("quick-log-close");
  const options = document.querySelectorAll(".quick-log-opt");
  const formHabit = document.getElementById("quick-log-form-habit");
  const formFinance = document.getElementById("quick-log-form-finance");
  const formPerson = document.getElementById("quick-log-form-person");
  const habitList = document.getElementById("quick-log-habit-list");
  const personSelect = document.getElementById("quick-log-person-select");

  function showOptions() {
    formHabit.classList.add("hidden");
    formFinance.classList.add("hidden");
    formPerson.classList.add("hidden");
  }
  function openModal() {
    showOptions();
    overlay.classList.remove("hidden");
  }
  function closeModal() {
    overlay.classList.add("hidden");
  }

  if (openBtn) openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });

  options.forEach((btn) => {
    btn.addEventListener("click", function () {
      showOptions();
      const q = this.dataset.quick;
      if (q === "habit") {
        if (habitList) {
          habitList.innerHTML = "";
          const todayMap = state.habitCompletions[todayStr()] || {};
          state.habits.slice(0, 8).forEach((h) => {
            const done = !!todayMap[h.id];
            const li = document.createElement("li");
            li.innerHTML = `<input type="checkbox" data-habit-id="${h.id}" ${done ? "checked" : ""} /><span>${h.name}</span>`;
            habitList.appendChild(li);
          });
          if (state.habits.length === 0) habitList.innerHTML = "<li class=\"quick-log-empty\">No habits yet. Add one in Growth.</li>";
        }
        formHabit.classList.remove("hidden");
      } else if (q === "finance") {
        document.getElementById("quick-log-amount").value = "";
        document.getElementById("quick-log-finance-note").value = "";
        formFinance.classList.remove("hidden");
      } else if (q === "person") {
        if (personSelect) {
          personSelect.innerHTML = state.people.length ? state.people.map((p) => `<option value="${p.id}">${p.name}</option>`).join("") : "<option value=\"\">No people yet</option>";
        }
        document.getElementById("quick-log-person-note").value = "";
        formPerson.classList.remove("hidden");
      }
    });
  });

  const saveHabitBtn = document.getElementById("quick-log-habit-save");
  if (saveHabitBtn && habitList) {
    saveHabitBtn.addEventListener("click", function () {
      habitList.querySelectorAll("input[type=checkbox]").forEach((cb) => {
        const id = cb.dataset.habitId;
        const checked = cb.checked;
        const key = todayStr();
        if (!state.habitCompletions[key]) state.habitCompletions[key] = {};
        if (state.habitCompletions[key][id] !== checked) {
          state.habitCompletions[key][id] = checked;
        }
      });
      saveState();
      state.feedLog = state.feedLog || [];
      state.feedLog.push({
        type: "habit",
        date: todayStr(),
        time: new Date().toTimeString().slice(0, 5),
        label: "Habits",
        detail: "Checked off",
      });
      if (state.feedLog.length > 500) state.feedLog = state.feedLog.slice(-500);
      saveState();
      renderDashboard();
      renderHabits();
      renderDailySnapshot();
      renderActivityFeed();
      closeModal();
      showSavedToast("SAVED");
    });
  }

  const saveFinanceBtn = document.getElementById("quick-log-finance-save");
  if (saveFinanceBtn) {
    saveFinanceBtn.addEventListener("click", function () {
      const amount = Number(document.getElementById("quick-log-amount").value) || 0;
      const note = (document.getElementById("quick-log-finance-note").value || "").trim();
      if (state.debts.length > 0 && amount > 0) {
        const d = state.debts[0];
        const paid = Number(d.paid) || 0;
        d.paid = paid + amount;
        state.feedLog = state.feedLog || [];
        state.feedLog.push({
          type: "finance",
          date: todayStr(),
          time: new Date().toTimeString().slice(0, 5),
          label: "Payment",
          detail: formatCurrency(amount) + (note ? " · " + note : ""),
        });
        if (state.feedLog.length > 500) state.feedLog = state.feedLog.slice(-500);
        saveState();
        renderFinances();
        renderDashboard();
        renderActivityFeed();
        closeModal();
        showSavedToast("PAYMENT LOGGED");
      } else if (state.debts.length === 0) {
        showSaveError("Add a debt in Finance first to log payments.");
      } else {
        showSaveError("Enter an amount.");
      }
    });
  }

  const savePersonBtn = document.getElementById("quick-log-person-save");
  if (savePersonBtn && personSelect) {
    savePersonBtn.addEventListener("click", function () {
      const personId = personSelect.value;
      const note = (document.getElementById("quick-log-person-note").value || "").trim();
      if (!personId || !note) {
        showSaveError("Select a person and enter a note.");
        return;
      }
      const p = state.people.find((x) => x.id === personId);
      if (p) {
        const line = new Date().toISOString().slice(0, 10) + ": " + note + "\n";
        p.notes = (p.notes || "") + line;
        state.feedLog = state.feedLog || [];
        state.feedLog.push({
          type: "person",
          date: todayStr(),
          time: new Date().toTimeString().slice(0, 5),
          label: p.name,
          detail: note,
        });
        if (state.feedLog.length > 500) state.feedLog = state.feedLog.slice(-500);
        saveState();
        renderPeople();
        renderDashboard();
        renderActivityFeed();
        closeModal();
        showSavedToast("NOTE SAVED");
      }
    });
  }
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

  var habitColorSelect = $("habit-color");
  if (habitColorSelect) {
    habitColorSelect.innerHTML = "";
    (COLOR_PALETTE || []).forEach(function (item) {
      var opt = document.createElement("option");
      opt.value = item.hex;
      opt.textContent = item.id.charAt(0).toUpperCase() + item.id.slice(1);
      opt.style.setProperty("--opt-color", item.hex);
      habitColorSelect.appendChild(opt);
    });
  }

  function openAddHabitForm() {
    $("habit-id").value = "";
    $("habit-form").reset();
    $("habit-goal").value = 5;
    if (habitColorSelect && COLOR_PALETTE[0]) habitColorSelect.value = COLOR_PALETTE[0].hex;
    $("habit-form-panel").classList.remove("hidden");
    var listEl = $("habits-cards-list");
    if (listEl) listEl.classList.add("hidden");
  }
  $("add-habit-from-consistency-btn")?.addEventListener("click", openAddHabitForm);

  $("cancel-habit-btn")?.addEventListener("click", () => {
    $("habit-form-panel").classList.add("hidden");
    var listEl = $("habits-cards-list");
    if (listEl) listEl.classList.remove("hidden");
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

      const colorEl = $("habit-color");
      const color = (colorEl && colorEl.value) || (COLOR_PALETTE[0] && COLOR_PALETTE[0].hex) || "#9caf88";
      const existingIndex = state.habits.findIndex((h) => h.id === id);
      const habit = {
        id,
        name,
        description: description || name,
        goalPerWeek: goal > 0 ? goal : 1,
        color: color,
      };

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
      var listEl = $("habits-cards-list");
      if (listEl) listEl.classList.remove("hidden");
      renderHabits();
      renderHabitHeatmap();
      renderDashboard();
    } catch (err) {
      console.error("Habit save error", err);
      showSaveError("Could not save habit. Try again.");
    }
  }
  form.addEventListener("submit", handleHabitSave);
  form.querySelector('button[type="submit"]')?.addEventListener("click", (e) => { e.preventDefault(); handleHabitSave(null); });

  var heatmapWrap = document.getElementById("habit-heatmap-grid-wrap");
  if (heatmapWrap && !heatmapWrap.dataset.delegationBound) {
    heatmapWrap.dataset.delegationBound = "1";
    heatmapWrap.addEventListener("click", function (e) {
      var edit = e.target.closest("[data-action=\"edit-habit\"]");
      if (edit && edit.dataset.habitId) {
        e.preventDefault();
        editHabit(edit.dataset.habitId);
        return;
      }
      var del = e.target.closest("[data-action=\"delete-habit\"]");
      if (del && del.dataset.habitId) {
        e.preventDefault();
        if (confirm("Delete this habit? Completions will be removed.")) {
          deleteHabit(del.dataset.habitId);
        }
      }
    });
  }
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
  renderHabitHeatmap();
  renderDashboard();
}

function editHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;
  $("habit-id").value = habit.id;
  $("habit-name").value = habit.name;
  $("habit-description").value = habit.description || "";
  $("habit-goal").value = habit.goalPerWeek;
  var colorEl = $("habit-color");
  if (colorEl && habit.color) colorEl.value = habit.color;
  $("habit-form-panel").classList.remove("hidden");
  var listEl = $("habits-cards-list");
  if (listEl) listEl.classList.add("hidden");
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

/** 0 = none, 1 = some habits done, 2 = perfect day (all habits done). */
function getDayLevel(dateKey) {
  var total = (state.habits || []).length;
  if (!total) return 0;
  var map = state.habitCompletions[dateKey] || {};
  var done = (state.habits || []).filter(function (h) { return !!map[h.id]; }).length;
  if (done === 0) return 0;
  return done >= total ? 2 : 1;
}

/** Last N days, oldest first (left to right = past to today). */
function getHeatmapDates(weeks) {
  weeks = weeks || 12;
  var today = new Date();
  var dates = [];
  for (var i = weeks * 7 - 1; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** 365 days for horizontal year view (oldest first). */
function getHeatmapDates365() {
  var today = new Date();
  var dates = [];
  for (var i = 364; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** GitHub-style grid: 7 rows (Sun–Sat) × 53 weeks. Returns { grid, monthLabels }.
 *  grid[row][col] = dateKey or null. row=0 is Sunday, col=0 is oldest week. */
function getHeatmapGrid365() {
  var today = new Date();
  var grid = [];
  var weekCols = 53;
  for (var r = 0; r < 7; r++) grid[r] = [];
  for (var c = 0; c < weekCols; c++) {
    for (var r = 0; r < 7; r++) grid[r][c] = null;
  }
  var monthLabels = [];
  var lastMonth = -1;
  for (var i = 0; i < 365; i++) {
    var d = new Date(today);
    d.setDate(today.getDate() - (364 - i));
    var dateKey = d.toISOString().slice(0, 10);
    var weekIndex = Math.floor(i / 7);
    var dayOfWeek = d.getDay();
    grid[dayOfWeek][weekIndex] = dateKey;
    var m = d.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ weekIndex: weekIndex, label: d.toLocaleString("en", { month: "short" }) });
      lastMonth = m;
    }
  }
  return { grid: grid, monthLabels: monthLabels };
}

/** Week view: 1 row × 7 cols (last 7 days, Mon–Sun). */
function getHeatmapGridWeek() {
  var today = new Date();
  var grid = [[]];
  for (var i = 6; i >= 0; i--) {
    var d = new Date(today);
    d.setDate(today.getDate() - i);
    grid[0].push(d.toISOString().slice(0, 10));
  }
  return { grid: grid, monthLabels: [], rows: 1, cols: 7 };
}

/** Month view: 7 rows (Sun–Sat) × 4 cols (4 weeks). */
function getHeatmapGridMonth() {
  var today = new Date();
  var grid = [];
  var cols = 4;
  for (var r = 0; r < 7; r++) grid[r] = [];
  for (var c = 0; c < cols; c++) {
    for (var r = 0; r < 7; r++) grid[r][c] = null;
  }
  for (var i = 0; i < 28; i++) {
    var d = new Date(today);
    d.setDate(today.getDate() - (27 - i));
    var dateKey = d.toISOString().slice(0, 10);
    var weekIndex = Math.floor(i / 7);
    var dayOfWeek = d.getDay();
    grid[dayOfWeek][weekIndex] = dateKey;
  }
  return { grid: grid, monthLabels: [], rows: 7, cols: cols };
}

var DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

var HEATMAP_RANGE_KEY = "habitHeatmapRange";

function getHeatmapRange() {
  try {
    var s = localStorage.getItem(HEATMAP_RANGE_KEY);
    if (s === "week" || s === "month" || s === "year") return s;
  } catch (e) {}
  return "month";
}

function setHeatmapRange(range) {
  try {
    localStorage.setItem(HEATMAP_RANGE_KEY, range);
  } catch (e) {}
}

/** Returns { grid, monthLabels, rows, cols, label } for the given range. */
function getHeatmapData(range) {
  if (range === "week") {
    var w = getHeatmapGridWeek();
    return { grid: w.grid, monthLabels: [], rows: 1, cols: 7, label: "Last 7 days" };
  }
  if (range === "month") {
    var m = getHeatmapGridMonth();
    return { grid: m.grid, monthLabels: [], rows: 7, cols: m.cols, label: "Last 4 weeks" };
  }
  var y = getHeatmapGrid365();
  return { grid: y.grid, monthLabels: y.monthLabels, rows: 7, cols: 53, label: "Last 365 days" };
}

function renderHabitHeatmap() {
  var wrap = document.getElementById("habit-heatmap-grid-wrap");
  if (!wrap) return;
  var habits = state.habits || [];
  var range = getHeatmapRange();
  var data = getHeatmapData(range);
  var grid = data.grid;
  var monthLabels = data.monthLabels || [];
  var rows = data.rows;
  var cols = data.cols;
  var rangeLabel = data.label;

  wrap.innerHTML = "";
  if (habits.length === 0) {
    wrap.innerHTML = "<p class=\"habit-heatmap-empty\">Add habits to see your consistency.</p>";
    return;
  }

  var cardParent = wrap.closest(".habit-heatmap-card");
  var body = cardParent && cardParent.querySelector(".habit-consistency-body");
  var existingRange = cardParent && cardParent.querySelector(".habit-heatmap-range-selector");
  if (body && !existingRange) {
    var rangeSelector = document.createElement("div");
    rangeSelector.className = "habit-heatmap-range-selector";
    rangeSelector.setAttribute("role", "tablist");
    rangeSelector.setAttribute("aria-label", "Heatmap view");
    ["week", "month", "year"].forEach(function (r) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "habit-heatmap-range-btn" + (r === range ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", r === range ? "true" : "false");
      btn.dataset.range = r;
      btn.textContent = r === "week" ? "Week" : r === "month" ? "Month" : "Year";
      rangeSelector.appendChild(btn);
    });
    body.insertBefore(rangeSelector, body.firstChild);
    rangeSelector.querySelectorAll(".habit-heatmap-range-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var r = btn.dataset.range;
        if (!r) return;
        setHeatmapRange(r);
        renderHabitHeatmap();
      });
    });
  } else if (existingRange) {
    existingRange.querySelectorAll(".habit-heatmap-range-btn").forEach(function (btn) {
      var r = btn.dataset.range;
      btn.classList.toggle("active", r === range);
      btn.setAttribute("aria-selected", r === range ? "true" : "false");
    });
  }

  habits.forEach(function (habit) {
    var card = document.createElement("div");
    card.className = "habit-consistency-card habit-consistency-card--" + range;
    var header = document.createElement("div");
    header.className = "habit-consistency-card-header";
    var swatch = document.createElement("span");
    swatch.className = "habit-consistency-swatch";
    swatch.style.backgroundColor = habit.color || "#9caf88";
    var titleWrap = document.createElement("div");
    titleWrap.className = "habit-consistency-title-wrap";
    var title = document.createElement("span");
    title.className = "habit-consistency-title";
    title.textContent = habit.name || "";
    var subtitle = document.createElement("span");
    subtitle.className = "habit-consistency-subtitle";
    subtitle.textContent = "Daily";
    titleWrap.appendChild(title);
    titleWrap.appendChild(subtitle);
    var streakNum = getHabitStreak(habit.id);
    var streakStr = streakNum === 1 ? "1 day" : streakNum + " days";
    var meta = document.createElement("div");
    meta.className = "habit-consistency-meta";
    meta.innerHTML = "<span class=\"habit-consistency-streak\" title=\"Streak\">\uD83D\uDD25 " + streakNum + "</span>";
    var actions = document.createElement("div");
    actions.className = "habit-consistency-actions";
    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "habit-consistency-icon";
    editBtn.setAttribute("data-action", "edit-habit");
    editBtn.setAttribute("data-habit-id", habit.id);
    editBtn.setAttribute("aria-label", "Edit " + (habit.name || "habit"));
    editBtn.textContent = "\u270F\uFE0F";
    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "habit-consistency-icon habit-consistency-icon-delete";
    deleteBtn.setAttribute("data-action", "delete-habit");
    deleteBtn.setAttribute("data-habit-id", habit.id);
    deleteBtn.setAttribute("aria-label", "Delete " + (habit.name || "habit"));
    deleteBtn.textContent = "\uD83D\uDDD1\uFE0F";
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    header.appendChild(swatch);
    header.appendChild(titleWrap);
    header.appendChild(meta);
    header.appendChild(actions);
    card.appendChild(header);

    var heatWrap = document.createElement("div");
    heatWrap.className = "habit-consistency-heat-wrap";
    heatWrap.style.setProperty("--cols", cols);
    heatWrap.style.setProperty("--rows", rows);
    var topRow = document.createElement("div");
    topRow.className = "habit-consistency-top-row";
    var labelSpan = document.createElement("span");
    labelSpan.className = "habit-consistency-label";
    labelSpan.textContent = rangeLabel;
    topRow.appendChild(labelSpan);
    if (monthLabels.length > 0) {
      var spacer = document.createElement("div");
      spacer.className = "habit-consistency-top-spacer";
      topRow.appendChild(spacer);
      var monthRow = document.createElement("div");
      monthRow.className = "habit-consistency-month-row";
      monthLabels.forEach(function (o) {
        var span = document.createElement("span");
        span.className = "habit-consistency-month";
        span.style.gridColumn = (o.weekIndex + 1);
        span.textContent = o.label;
        monthRow.appendChild(span);
      });
      topRow.appendChild(monthRow);
    }
    var legendWrap = document.createElement("div");
    legendWrap.className = "habit-consistency-legend";
    legendWrap.innerHTML = "<span class=\"habit-consistency-legend-item\"><span class=\"habit-consistency-legend-swatch\" style=\"background:var(--warm-gray-pale)\"></span>Skip</span><span class=\"habit-consistency-legend-item\"><span class=\"habit-consistency-legend-swatch\" style=\"background:" + (habit.color || "#9caf88") + "\"></span>Done</span>";
    topRow.appendChild(legendWrap);
    heatWrap.appendChild(topRow);

    var gridWrap = document.createElement("div");
    gridWrap.className = "habit-consistency-grid-wrap";
    if (rows > 1) {
      var dayLabels = document.createElement("div");
      dayLabels.className = "habit-consistency-day-labels";
      for (var r = 0; r < rows; r++) {
        var d = document.createElement("span");
        d.className = "habit-consistency-day-label";
        d.textContent = DAY_ABBREV[r] || "";
        dayLabels.appendChild(d);
      }
      gridWrap.appendChild(dayLabels);
    }
    var gridEl = document.createElement("div");
    gridEl.className = "habit-consistency-grid";
    gridEl.style.setProperty("--cols", cols);
    gridEl.style.setProperty("--rows", rows);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var dateKey = grid[r] && grid[r][c];
        var cell = document.createElement("div");
        cell.className = "habit-consistency-cell";
        if (dateKey) {
          var completed = !!(state.habitCompletions[dateKey] && state.habitCompletions[dateKey][habit.id]);
          cell.classList.add(completed ? "done" : "skip");
          cell.style.backgroundColor = completed ? (habit.color || "#9caf88") : "";
          cell.setAttribute("data-date", dateKey);
          cell.setAttribute("title", dateKey + (completed ? " — done" : " — skipped"));
        } else {
          cell.classList.add("empty");
        }
        gridEl.appendChild(cell);
      }
    }
    gridWrap.appendChild(gridEl);
    heatWrap.appendChild(gridWrap);
    card.appendChild(heatWrap);
    wrap.appendChild(card);
  });
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
  const energyQuoteEl = $("snapshot-energy-quote");
  if (energySlider) energySlider.value = energyVal;
  if (energyValueEl) energyValueEl.textContent = energyVal;
  if (energyQuoteEl) energyQuoteEl.textContent = getEnergyQuote(energyVal);

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
  const targetDisplayEl = $("snapshot-deepwork-target-display");
  if (currentEl) currentEl.textContent = deepWorkHours;
  if (targetDisplayEl) targetDisplayEl.textContent = target;
  const deepworkInput = $("snapshot-deepwork-input");
  if (deepworkInput) deepworkInput.value = deepWorkHours || "";
  const deepworkTargetInput = $("snapshot-deepwork-target-input");
  if (deepworkTargetInput) deepworkTargetInput.value = target;

  renderHabitHeatmap();
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
      var qEl = $("snapshot-energy-quote");
      if (qEl) qEl.textContent = getEnergyQuote(v);
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
  const deepworkTargetInput = $("snapshot-deepwork-target-input");
  if (deepworkTargetInput) {
    deepworkTargetInput.addEventListener("change", function () {
      const v = parseFloat(deepworkTargetInput.value, 10);
      state.deepWorkTarget = isNaN(v) ? 2 : Math.max(0.5, v);
      saveState();
      renderDailySnapshot();
    });
  }

  renderDailySnapshot();
}

function runAIGenerateInsight(buttonEl, onSuccess) {
  const todayKey = todayStr();
  const label = buttonEl ? buttonEl.textContent : "";
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = "Generating…";
  }
  fetchAIDailyInsight()
    .then(function (insight) {
      state.insightLog[todayKey] = insight;
      saveState();
      if (typeof onSuccess === "function") onSuccess();
      showSavedToast("INSIGHT SAVED");
      renderDashboard();
    })
    .catch(function (err) {
      showSaveError(err.message || "Could not generate insight. Use Vercel deploy and set OPENAI_API_KEY.");
    })
    .finally(function () {
      if (buttonEl) {
        buttonEl.disabled = false;
        buttonEl.textContent = label || "GENERATE WITH AI";
      }
    });
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

// ——— Focus Sphere (Deep Work Timer) ———
var focusSession = null;
var focusTickInterval = null;
var focusLastCompleted = null;
var FOCUS_SWEEP_CIRCUM = 2 * Math.PI * 56;

function focusShowView(viewId) {
  ["focus-view-idle", "focus-view-running", "focus-view-paused", "focus-view-celebrating", "focus-view-report"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.toggle("hidden", id !== viewId);
  });
}

function focusUpdateSweep(elId, elapsed, total) {
  if (!total) return;
  var el = document.getElementById(elId);
  if (!el) return;
  var filled = (elapsed / total) * FOCUS_SWEEP_CIRCUM;
  el.setAttribute("stroke-dasharray", filled.toFixed(2) + " " + FOCUS_SWEEP_CIRCUM.toFixed(2));
}

function focusFormatTime(seconds) {
  var m = Math.floor(seconds / 60);
  var s = seconds % 60;
  return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
}

function focusTick() {
  if (!focusSession || !focusSession.isRunning) return;
  focusSession.remainingSeconds--;
  if (focusSession.remainingSeconds <= 0) {
    focusSession.remainingSeconds = 0;
    focusCompleteSession();
    return;
  }
  var elapsed = focusSession.totalSeconds - focusSession.remainingSeconds;
  var runningEl = document.getElementById("focus-time-running");
  if (runningEl) runningEl.textContent = focusFormatTime(focusSession.remainingSeconds);
  focusUpdateSweep("focus-sphere-sweep", elapsed, focusSession.totalSeconds);
  try { sessionStorage.setItem("focusSession", JSON.stringify(focusSession)); } catch (e) {}
}

function focusCompleteSession() {
  if (focusTickInterval) {
    clearInterval(focusTickInterval);
    focusTickInterval = null;
  }
  var minutes = Math.round((focusSession.totalSeconds - focusSession.remainingSeconds) / 60);
  var todayKey = todayStr();
  state.deepWorkLog[todayKey] = (Number(state.deepWorkLog[todayKey]) || 0) + minutes / 60;
  saveState();
  focusLastCompleted = { minutes: minutes, objective: focusSession.objective || "your focus" };
  focusSession = null;
  try { sessionStorage.removeItem("focusSession"); } catch (e) {}
  focusShowView("focus-view-celebrating");
  var celebrateEl = document.getElementById("focus-sphere-celebrate");
  if (celebrateEl) celebrateEl.classList.add("focus-sphere-circle--bloom");
  var timeCelebrate = document.getElementById("focus-time-celebrate");
  if (timeCelebrate) timeCelebrate.textContent = "00:00";
  setTimeout(function () {
    if (celebrateEl) celebrateEl.classList.remove("focus-sphere-circle--bloom");
    var msgEl = document.getElementById("focus-report-message");
    if (msgEl && focusLastCompleted) {
      var obj = focusLastCompleted.objective && focusLastCompleted.objective !== "your focus" ? focusLastCompleted.objective : "your focus";
      msgEl.textContent = "You just invested " + focusLastCompleted.minutes + " minutes into " + obj + ".";
    }
    focusShowView("focus-view-report");
    if (typeof renderDailySnapshot === "function") renderDailySnapshot();
  }, 2000);
}

function focusStartSession() {
  var durationSelect = document.getElementById("focus-duration-select");
  var objectiveInput = document.getElementById("focus-objective-input");
  var duration = durationSelect ? parseInt(durationSelect.value, 10) || 45 : 45;
  var totalSeconds = duration * 60;
  var objective = (objectiveInput && objectiveInput.value && objectiveInput.value.trim()) || "Deep work";
  focusSession = {
    durationMinutes: duration,
    totalSeconds: totalSeconds,
    remainingSeconds: totalSeconds,
    objective: objective,
    isRunning: true,
    isPaused: false,
  };
  var runningObj = document.getElementById("focus-objective-running");
  if (runningObj) runningObj.textContent = objective;
  var pausedObj = document.getElementById("focus-objective-paused");
  if (pausedObj) pausedObj.textContent = objective;
  document.getElementById("focus-time-running").textContent = focusFormatTime(totalSeconds);
  document.getElementById("focus-time-paused").textContent = focusFormatTime(totalSeconds);
  focusUpdateSweep("focus-sphere-sweep", 0, totalSeconds);
  focusUpdateSweep("focus-sphere-sweep-paused", 0, totalSeconds);
  focusShowView("focus-view-running");
  focusTickInterval = setInterval(focusTick, 1000);
  try { sessionStorage.setItem("focusSession", JSON.stringify(focusSession)); } catch (e) {}
}

function focusPauseSession() {
  if (!focusSession) return;
  focusSession.isRunning = false;
  focusSession.isPaused = true;
  if (focusTickInterval) {
    clearInterval(focusTickInterval);
    focusTickInterval = null;
  }
  var elapsed = focusSession.totalSeconds - focusSession.remainingSeconds;
  focusUpdateSweep("focus-sphere-sweep-paused", elapsed, focusSession.totalSeconds);
  var pausedTime = document.getElementById("focus-time-paused");
  if (pausedTime) pausedTime.textContent = focusFormatTime(focusSession.remainingSeconds);
  focusShowView("focus-view-paused");
  try { sessionStorage.setItem("focusSession", JSON.stringify(focusSession)); } catch (e) {}
}

function focusResumeSession() {
  if (!focusSession || !focusSession.isPaused) return;
  focusSession.isRunning = true;
  focusSession.isPaused = false;
  focusShowView("focus-view-running");
  var runningTime = document.getElementById("focus-time-running");
  if (runningTime) runningTime.textContent = focusFormatTime(focusSession.remainingSeconds);
  var elapsed = focusSession.totalSeconds - focusSession.remainingSeconds;
  focusUpdateSweep("focus-sphere-sweep", elapsed, focusSession.totalSeconds);
  focusTickInterval = setInterval(focusTick, 1000);
  try { sessionStorage.setItem("focusSession", JSON.stringify(focusSession)); } catch (e) {}
}

function focusResetSession() {
  if (focusTickInterval) {
    clearInterval(focusTickInterval);
    focusTickInterval = null;
  }
  focusSession = null;
  try { sessionStorage.removeItem("focusSession"); } catch (e) {}
  var idleTime = document.getElementById("focus-time-idle");
  if (idleTime) idleTime.textContent = document.getElementById("focus-duration-select").value ? document.getElementById("focus-duration-select").value + ":00" : "45:00";
  focusShowView("focus-view-idle");
}

function initFocusSphere() {
  var btnStart = document.getElementById("focus-btn-start");
  var btnPause = document.getElementById("focus-btn-pause");
  var btnReset = document.getElementById("focus-btn-reset");
  var btnNext = document.getElementById("focus-btn-next-block");
  var btnBreak = document.getElementById("focus-btn-break");
  if (btnStart) btnStart.addEventListener("click", function () { focusStartSession(); });
  if (btnPause) btnPause.addEventListener("click", function () { focusPauseSession(); });
  if (btnReset) btnReset.addEventListener("click", function () { focusResetSession(); });
  if (btnNext) {
    btnNext.addEventListener("click", function () {
      var objInput = document.getElementById("focus-objective-input");
      if (objInput && focusLastCompleted && focusLastCompleted.objective && focusLastCompleted.objective !== "your focus") objInput.value = focusLastCompleted.objective;
      focusLastCompleted = null;
      focusStartSession();
    });
  }
  if (btnBreak) {
    btnBreak.addEventListener("click", function () {
      focusLastCompleted = null;
      focusShowView("focus-view-idle");
      var durationSelect = document.getElementById("focus-duration-select");
      if (durationSelect) durationSelect.value = "15";
      var idleTime = document.getElementById("focus-time-idle");
      if (idleTime) idleTime.textContent = "15:00";
    });
  }
  try {
    var saved = sessionStorage.getItem("focusSession");
    if (saved) {
      focusSession = JSON.parse(saved);
      if (focusSession && focusSession.remainingSeconds > 0) {
        if (focusSession.isRunning) {
          focusResumeSession();
        } else {
          var elapsed = focusSession.totalSeconds - focusSession.remainingSeconds;
          focusUpdateSweep("focus-sphere-sweep-paused", elapsed, focusSession.totalSeconds);
          document.getElementById("focus-time-paused").textContent = focusFormatTime(focusSession.remainingSeconds);
          var po = document.getElementById("focus-objective-paused");
          if (po) po.textContent = focusSession.objective || "";
          focusShowView("focus-view-paused");
        }
        return;
      }
    }
  } catch (e) {}
  var durationSelect = document.getElementById("focus-duration-select");
  if (durationSelect) {
    durationSelect.addEventListener("change", function () {
      var v = durationSelect.value;
      var idleTime = document.getElementById("focus-time-idle");
      if (idleTime && !focusSession) idleTime.textContent = (v || "45") + ":00";
    });
  }
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
      li.className = "goals-preview-empty-item";
      li.textContent = "No goals yet";
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
      li.className = "debt-list-empty-item";
      li.textContent = "No debts";
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
      li.className = "appointments-preview-empty-item";
      li.textContent = "No upcoming appointments";
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
  if (typeof renderActivityFeed === "function") renderActivityFeed();
}

function formatFeedDate(dateStr) {
  if (!dateStr) return "";
  var d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return dateStr;
  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return (days[d.getDay()] || "") + ", " + (months[d.getMonth()] || "") + " " + d.getDate();
}

function renderActivityFeed() {
  var listEl = document.getElementById("activity-feed-list");
  if (!listEl) return;
  var items = getFeedItems(activityFeedLimit);
  listEl.innerHTML = "";
  if (items.length === 0) {
    listEl.innerHTML = '<p class="activity-feed-empty">No recent activity. Use the + button to log habits, payments, or person notes.</p>';
    return;
  }
  var lastDate = "";
  items.forEach(function (item) {
    if (item.date !== lastDate) {
      lastDate = item.date;
      var header = document.createElement("div");
      header.className = "activity-feed-date-header";
      header.setAttribute("data-feed-date", item.date);
      header.textContent = formatFeedDate(item.date);
      listEl.appendChild(header);
    }
    var card = document.createElement("div");
    card.className = "activity-feed-card activity-feed-card--" + (item.type || "habit");
    var timeLabel = item.time ? item.time + " • " : "";
    var typeLabel = item.type === "finance" ? "Finance" : item.type === "person" ? "Circle" : "Habit";
    card.innerHTML =
      "<div class=\"activity-feed-card-meta\">" + timeLabel + typeLabel + "</div>" +
      "<div class=\"activity-feed-card-main\">" +
      "<span class=\"activity-feed-card-label\">" + (escapeHtml(item.label) || "—") + "</span>" +
      (item.detail ? "<span class=\"activity-feed-card-detail\">" + escapeHtml(item.detail) + "</span>" : "") +
      "</div>";
    listEl.appendChild(card);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  var div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function setupActivityFeed() {
  var sentinel = document.getElementById("feed-load-sentinel");
  var skeleton = document.getElementById("activity-feed-skeleton");
  if (!sentinel) return;
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var total = getFeedItems(99999).length;
        if (activityFeedLimit >= total) return;
        if (skeleton) {
          skeleton.classList.remove("hidden");
          skeleton.setAttribute("aria-hidden", "false");
        }
        activityFeedLimit = Math.min(activityFeedLimit + FEED_PAGE_SIZE, total);
        renderActivityFeed();
        setTimeout(function () {
          if (skeleton) {
            skeleton.classList.add("hidden");
            skeleton.setAttribute("aria-hidden", "true");
          }
        }, 300);
      });
    },
    { root: null, rootMargin: "100px", threshold: 0 }
  );
  io.observe(sentinel);
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

function applyPrivacyBlur() {
  if (typeof document === "undefined" || !document.body) return;
  var on = !!(profile && (profile.privacyBlur || profile.hideFinancialNumbers));
  document.body.classList.toggle("privacy-blur-on", on);
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
    privacyBlur.addEventListener("change", () => {
      profile.privacyBlur = privacyBlur.checked;
      profile.hideFinancialNumbers = privacyBlur.checked;
      saveProfile(profile);
      applyPrivacyBlur();
    });
  }
  applyPrivacyBlur();
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
  if (window.__lifeflowInitDone) return;
  window.__lifeflowInitDone = true;
  try {
    if (!storage) {
      showSaveError("Data cannot be saved. Use npx serve or turn off private browsing.");
    }
    try { setupColorPalette(); } catch (e) { console.error("setupColorPalette", e); }
    try { setupAvatar(); } catch (e) { console.error("setupAvatar", e); }
    try { setupTabs(); } catch (e) { console.error("setupTabs", e); }
    try { setupFlowNav(); } catch (e) { console.error("setupFlowNav", e); }
    try { setupQuickLog(); } catch (e) { console.error("setupQuickLog", e); }
    try { setupNavMobile(); } catch (e) { console.error("setupNavMobile", e); }
    try { setupHabits(); } catch (e) { console.error("setupHabits", e); }
    try { setupDailySnapshot(); } catch (e) { console.error("setupDailySnapshot", e); }
    try { initFocusSphere(); } catch (e) { console.error("initFocusSphere", e); }
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
    try { renderActivityFeed(); } catch (e) { console.error("renderActivityFeed", e); }
    try { setupActivityFeed(); } catch (e) { console.error("setupActivityFeed", e); }
    try { applyPrivacyBlur(); } catch (e) { console.error("applyPrivacyBlur", e); }

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

