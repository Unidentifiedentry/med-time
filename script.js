/* =========================================================
   MediAlert — script.js
   Modular vanilla JS: storage, medicines, reminders, dashboard,
   history, wellbeing tools, emergency info, accessibility.
   ========================================================= */
"use strict";

/* ---------------------------------------------------------
   1. STORAGE HELPERS
   --------------------------------------------------------- */
const Store = {
  keys: {
    medicines: "medialert_medicines",
    history: "medialert_history",
    settings: "medialert_settings",
    emergency: "medialert_emergency",
    water: "medialert_water",
  },
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("MediAlert storage read error:", e);
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("MediAlert storage write error:", e);
    }
  },
};

/* ---------------------------------------------------------
   2. APP STATE
   --------------------------------------------------------- */
const state = {
  medicines: Store.get(Store.keys.medicines, []),
  history: Store.get(Store.keys.history, []),
  settings: Store.get(Store.keys.settings, {
    theme: "light",
    largeFont: false,
    highContrast: false,
    voice: true,
  }),
  emergency: Store.get(Store.keys.emergency, {
    name: "", phone: "", blood: "", allergies: "", conditions: "",
  }),
  water: Store.get(Store.keys.water, { count: 0, goal: 8, date: todayKey(), lastReminder: Date.now() }),
  medFilter: "all",
  medSearch: "",
  editingId: null,
  firedThisMinute: new Set(),
};

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Reset water tracker if a new day started */
if (state.water.date !== todayKey()) {
  state.water = { count: 0, goal: 8, date: todayKey(), lastReminder: Date.now() };
  Store.set(Store.keys.water, state.water);
}

/* ---------------------------------------------------------
   3. THEME / ACCESSIBILITY
   --------------------------------------------------------- */
function applySettings() {
  document.documentElement.setAttribute("data-theme", state.settings.theme);
  document.documentElement.setAttribute("data-contrast", state.settings.highContrast ? "high" : "normal");
  document.body.classList.toggle("large-font", state.settings.largeFont);
  document.getElementById("themeToggleBtn").setAttribute("aria-pressed", state.settings.theme === "dark");
  document.getElementById("largeFontToggle").checked = state.settings.largeFont;
  document.getElementById("highContrastToggle").checked = state.settings.highContrast;
  document.getElementById("voiceToggle").checked = state.settings.voice;
}

document.getElementById("themeToggleBtn").addEventListener("click", () => {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  Store.set(Store.keys.settings, state.settings);
  applySettings();
});

document.getElementById("a11yToggleBtn").addEventListener("click", () => {
  document.getElementById("a11yPanel").hidden = false;
});
document.getElementById("closeA11y").addEventListener("click", () => {
  document.getElementById("a11yPanel").hidden = true;
});
document.getElementById("largeFontToggle").addEventListener("change", (e) => {
  state.settings.largeFont = e.target.checked;
  Store.set(Store.keys.settings, state.settings);
  applySettings();
});
document.getElementById("highContrastToggle").addEventListener("change", (e) => {
  state.settings.highContrast = e.target.checked;
  Store.set(Store.keys.settings, state.settings);
  applySettings();
});
document.getElementById("voiceToggle").addEventListener("change", (e) => {
  state.settings.voice = e.target.checked;
  Store.set(Store.keys.settings, state.settings);
});

/* ---------------------------------------------------------
   4. LIVE CLOCK
   --------------------------------------------------------- */
function tickClock() {
  const now = new Date();
  document.getElementById("liveClock").textContent = now.toLocaleTimeString([], { hour12: true });
}
setInterval(tickClock, 1000);

/* ---------------------------------------------------------
   5. MEDICINE FORM (add / edit)
   --------------------------------------------------------- */
const medForm = document.getElementById("medForm");
const freqSelect = document.getElementById("medFrequency");

freqSelect.addEventListener("change", updateFrequencyFields);
function updateFrequencyFields() {
  document.getElementById("weeklyDayField").hidden = freqSelect.value !== "weekly";
  document.getElementById("monthlyDayField").hidden = freqSelect.value !== "monthly";
}

document.getElementById("heroAddBtn").addEventListener("click", () => {
  document.getElementById("medicines").scrollIntoView({ behavior: "smooth" });
  document.getElementById("medName").focus();
});

medForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const meal = medForm.querySelector('input[name="meal"]:checked').value;
  const med = {
    id: document.getElementById("medId").value || uid(),
    name: document.getElementById("medName").value.trim(),
    dosage: document.getElementById("medDosage").value.trim(),
    time: document.getElementById("medTime").value,
    frequency: freqSelect.value,
    weekday: document.getElementById("medWeekday").value,
    monthday: document.getElementById("medMonthday").value,
    meal,
    notes: document.getElementById("medNotes").value.trim(),
  };
  if (!med.name || !med.dosage || !med.time) return;

  if (state.editingId) {
    const idx = state.medicines.findIndex((m) => m.id === state.editingId);
    if (idx > -1) state.medicines[idx] = med;
    state.editingId = null;
  } else {
    state.medicines.push(med);
  }
  Store.set(Store.keys.medicines, state.medicines);
  resetForm();
  renderMedicines();
  renderDashboard();
  renderNextDose();
  toast("Medicine saved.");
});

document.getElementById("medCancelBtn").addEventListener("click", resetForm);

function resetForm() {
  medForm.reset();
  document.getElementById("medId").value = "";
  document.getElementById("formTitle").textContent = "Add a medicine";
  document.getElementById("medSubmitBtn").textContent = "Add medicine";
  document.getElementById("medCancelBtn").hidden = true;
  state.editingId = null;
  updateFrequencyFields();
}

function editMedicine(id) {
  const med = state.medicines.find((m) => m.id === id);
  if (!med) return;
  document.getElementById("medId").value = med.id;
  document.getElementById("medName").value = med.name;
  document.getElementById("medDosage").value = med.dosage;
  document.getElementById("medTime").value = med.time;
  freqSelect.value = med.frequency;
  document.getElementById("medWeekday").value = med.weekday;
  document.getElementById("medMonthday").value = med.monthday;
  document.getElementById("medNotes").value = med.notes;
  medForm.querySelector(`input[name="meal"][value="${med.meal}"]`).checked = true;
  updateFrequencyFields();
  state.editingId = id;
  document.getElementById("formTitle").textContent = "Edit medicine";
  document.getElementById("medSubmitBtn").textContent = "Save changes";
  document.getElementById("medCancelBtn").hidden = false;
  document.getElementById("medForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function deleteMedicine(id) {
  if (!confirm("Remove this medicine and its reminders?")) return;
  state.medicines = state.medicines.filter((m) => m.id !== id);
  Store.set(Store.keys.medicines, state.medicines);
  renderMedicines();
  renderDashboard();
  renderNextDose();
  toast("Medicine removed.");
}

/* ---------------------------------------------------------
   6. RENDER: MEDICINE LIST
   --------------------------------------------------------- */
const medIcons = ["💊", "💉", "🩹", "🧴", "🧪"];

function renderMedicines() {
  const list = document.getElementById("medList");
  const empty = document.getElementById("medEmpty");
  let items = state.medicines.filter((m) => {
    const matchesFilter = state.medFilter === "all" || m.frequency === state.medFilter;
    const matchesSearch = m.name.toLowerCase().includes(state.medSearch.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  list.innerHTML = "";
  empty.hidden = items.length !== 0;

  items.forEach((m, i) => {
    const li = document.createElement("li");
    li.className = "med-item";
    li.innerHTML = `
      <span class="med-icon">${medIcons[i % medIcons.length]}</span>
      <div class="med-main">
        <strong>${escapeHtml(m.name)}</strong>
        <div class="med-meta">
          <span>${escapeHtml(m.dosage)}</span>
          <span>⏰ ${formatTime(m.time)}</span>
          <span>${m.meal === "before" ? "Before meal" : m.meal === "after" ? "After meal" : "Anytime"}</span>
          <span class="badge badge-${m.frequency}">${capitalize(m.frequency)}</span>
        </div>
        ${m.notes ? `<div class="med-meta">📝 ${escapeHtml(m.notes)}</div>` : ""}
      </div>
      <div class="med-actions">
        <button data-action="edit" title="Edit">✏️</button>
        <button data-action="delete" title="Delete">🗑️</button>
      </div>`;
    li.querySelector('[data-action="edit"]').addEventListener("click", () => editMedicine(m.id));
    li.querySelector('[data-action="delete"]').addEventListener("click", () => deleteMedicine(m.id));
    list.appendChild(li);
  });
}

document.getElementById("medSearch").addEventListener("input", (e) => {
  state.medSearch = e.target.value;
  renderMedicines();
});
document.querySelectorAll("#medFilterTabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#medFilterTabs .tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    state.medFilter = tab.dataset.filter;
    renderMedicines();
  });
});

/* ---------------------------------------------------------
   7. DASHBOARD + PROGRESS
   --------------------------------------------------------- */
function medicinesDueToday() {
  const now = new Date();
  return state.medicines.filter((m) => {
    if (m.frequency === "daily") return true;
    if (m.frequency === "weekly") return String(now.getDay()) === m.weekday;
    if (m.frequency === "monthly") return String(now.getDate()) === String(m.monthday);
    return false;
  });
}

function renderDashboard() {
  const today = todayKey();
  const dueToday = medicinesDueToday();
  const todaysHistory = state.history.filter((h) => h.date === today);
  const taken = todaysHistory.filter((h) => h.status === "taken").length;
  const missed = todaysHistory.filter((h) => h.status === "missed").length;

  document.getElementById("statTotal").textContent = state.medicines.length;
  document.getElementById("statToday").textContent = dueToday.length;
  document.getElementById("statTaken").textContent = taken;
  document.getElementById("statMissed").textContent = missed;
  document.getElementById("statStreak").textContent = computeStreak();

  const pct = dueToday.length ? Math.round((taken / dueToday.length) * 100) : 0;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressPct").textContent = pct + "%";
}

function computeStreak() {
  // Count consecutive days (ending today) where every due dose was taken.
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const dayLogs = state.history.filter((h) => h.date === key);
    const takenCount = dayLogs.filter((h) => h.status === "taken").length;
    if (i === 0 && dayLogs.length === 0) continue; // today may have no logs yet, don't break streak
    if (dayLogs.length === 0) break;
    if (takenCount === 0 || dayLogs.some((h) => h.status === "missed")) break;
    streak++;
  }
  return streak;
}

const quotes = [
  "\u201cSmall doses of consistency build a lifetime of health.\u201d",
  "\u201cTaking care of yourself is a quiet act of discipline.\u201d",
  "\u201cEvery dose on time is a promise kept to your future self.\u201d",
  "\u201cHealth is built one reminder at a time.\u201d",
];
document.getElementById("dailyQuote").textContent = quotes[new Date().getDate() % quotes.length];

/* ---------------------------------------------------------
   8. NEXT DOSE CARD (hero)
   --------------------------------------------------------- */
function renderNextDose() {
  const card = document.getElementById("nextDoseCard");
  const due = medicinesDueToday().slice().sort((a, b) => a.time.localeCompare(b.time));
  const now = new Date();
  const nowStr = now.toTimeString().slice(0, 5);
  const next = due.find((m) => m.time >= nowStr) || due[0];

  if (!next) {
    card.innerHTML = `<p class="hero-card-empty">No reminders queued yet — add a medicine to get started.</p>`;
    return;
  }
  card.innerHTML = `
    <div class="dose-item">
      <span class="dose-pill">💊</span>
      <div class="dose-info">
        <strong>${escapeHtml(next.name)}</strong>
        <span>${formatTime(next.time)} · ${escapeHtml(next.dosage)}</span>
      </div>
    </div>`;
}

/* ---------------------------------------------------------
   9. HISTORY TABLE
   --------------------------------------------------------- */
function renderHistory() {
  const body = document.getElementById("historyBody");
  const empty = document.getElementById("historyEmpty");
  const sorted = state.history.slice().sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  body.innerHTML = "";
  empty.hidden = sorted.length !== 0;

  sorted.slice(0, 100).forEach((h) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${h.date}</td>
      <td>${formatTime(h.time)}</td>
      <td>${escapeHtml(h.medName)}</td>
      <td><span class="status-pill status-${h.status}">${capitalize(h.status)}</span></td>`;
    body.appendChild(tr);
  });
}

function logHistory(medName, status, time) {
  state.history.push({ date: todayKey(), time: time || new Date().toTimeString().slice(0, 5), medName, status });
  Store.set(Store.keys.history, state.history);
  renderHistory();
  renderDashboard();
}

/* ---------------------------------------------------------
   10. REMINDER ENGINE
   --------------------------------------------------------- */
let activeReminder = null;
let snoozeTimers = {};

function checkReminders() {
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const minuteKey = todayKey() + "T" + hhmm;

  medicinesDueToday().forEach((m) => {
    if (m.time === hhmm) {
      const fireKey = minuteKey + "-" + m.id;
      if (!state.firedThisMinute.has(fireKey)) {
        state.firedThisMinute.add(fireKey);
        triggerReminder(m);
      }
    }
  });
}
setInterval(checkReminders, 15000);

function triggerReminder(med) {
  activeReminder = med;
  showReminderModal(med);
  sendNotification(med);
  playAlarm();
  if (state.settings.voice) speakReminder(med);
}

function mealSentence(meal) {
  if (meal === "before") return "Please take it before your meal.";
  if (meal === "after") return "Please take it after your meal.";
  return "You can take it any time.";
}

function showReminderModal(med) {
  document.getElementById("reminderTitle").textContent = `Time for ${med.name}`;
  document.getElementById("reminderBody").textContent =
    `It's ${formatTime(med.time)}. Time to take your ${med.name} (${med.dosage}). ${mealSentence(med.meal)}`;
  document.getElementById("reminderModal").hidden = false;
}

function closeReminderModal() {
  document.getElementById("reminderModal").hidden = true;
  activeReminder = null;
}

function sendNotification(med) {
  if (!("Notification" in window)) return;
  const fire = () => {
    if (Notification.permission === "granted") {
      new Notification(`MediAlert — ${med.name}`, {
        body: `${formatTime(med.time)} · ${med.dosage} · ${mealSentence(med.meal)}`,
        icon: undefined,
      });
    }
  };
  if (Notification.permission === "granted") fire();
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => { if (perm === "granted") fire(); });
  }
}

/* Web Audio beep — no external audio file needed */
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.32);
    };
    beep(0); beep(0.4); beep(0.8);
  } catch (e) { /* audio unavailable, ignore */ }
}

function speakReminder(med) {
  if (!("speechSynthesis" in window)) return;
  const text = `It's ${formatSpokenTime(med.time)}. Time to take your ${med.name}. ${mealSentence(med.meal)}`;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

document.getElementById("markTakenBtn").addEventListener("click", () => {
  if (!activeReminder) return;
  logHistory(activeReminder.name, "taken", activeReminder.time);
  closeReminderModal();
  celebrateTaken();
  renderNextDose();
});
document.getElementById("skipBtn").addEventListener("click", () => {
  if (!activeReminder) return;
  logHistory(activeReminder.name, "skipped", activeReminder.time);
  closeReminderModal();
  toast("Dose marked as skipped.");
  renderNextDose();
});
document.getElementById("snooze5Btn").addEventListener("click", () => snoozeReminder(5));
document.getElementById("snooze10Btn").addEventListener("click", () => snoozeReminder(10));

function snoozeReminder(minutes) {
  if (!activeReminder) return;
  const med = activeReminder;
  toast(`Snoozed for ${minutes} minutes.`);
  closeReminderModal();
  setTimeout(() => triggerReminder(med), minutes * 60 * 1000);
}

/* Auto-mark as missed 20 min after a dose time if never actioned */
setInterval(() => {
  const now = new Date();
  medicinesDueToday().forEach((m) => {
    const [h, mnt] = m.time.split(":").map(Number);
    const doseTime = new Date();
    doseTime.setHours(h, mnt, 0, 0);
    const diffMin = (now - doseTime) / 60000;
    if (diffMin > 20 && diffMin < 21) {
      const already = state.history.some((x) => x.date === todayKey() && x.time === m.time && x.medName === m.name);
      if (!already) logHistory(m.name, "missed", m.time);
    }
  });
}, 60000);

function celebrateTaken() {
  toast("✅ Nicely done — logged as taken!");
}

/* ---------------------------------------------------------
   11. AI ASSISTANT TIPS
   --------------------------------------------------------- */
const tips = [
  "Drink a full glass of water after taking this medicine.",
  "Don't skip doses of antibiotics — finish the full course.",
  "Take this medicine after food to protect your stomach.",
  "Try to maintain at least 8 hours between doses.",
  "Store your medicines in a cool, dry place away from sunlight.",
  "Set your next refill reminder before you run out.",
  "Avoid alcohol close to your medicine schedule unless advised otherwise.",
  "A short walk after meals can help some medicines absorb better.",
];
function showRandomTip() {
  const el = document.getElementById("tipText");
  const next = tips[Math.floor(Math.random() * tips.length)];
  el.style.opacity = 0;
  setTimeout(() => { el.textContent = next; el.style.opacity = 1; }, 180);
}
document.getElementById("nextTipBtn").addEventListener("click", showRandomTip);
setInterval(showRandomTip, 45000);

/* ---------------------------------------------------------
   12. WATER TRACKER
   --------------------------------------------------------- */
const RING_CIRC = 2 * Math.PI * 42;
function renderWater() {
  document.getElementById("waterCountLabel").textContent = `${state.water.count} / ${state.water.goal} cups`;
  const pct = Math.min(1, state.water.count / state.water.goal);
  const ring = document.getElementById("waterRingFill");
  ring.style.strokeDasharray = RING_CIRC;
  ring.style.strokeDashoffset = RING_CIRC * (1 - pct);
}
document.getElementById("addWaterBtn").addEventListener("click", () => {
  state.water.count++;
  Store.set(Store.keys.water, state.water);
  renderWater();
  toast("💧 Cup logged. Great habit!");
});
setInterval(() => {
  const hourMs = 60 * 60 * 1000;
  if (Date.now() - state.water.lastReminder >= hourMs) {
    state.water.lastReminder = Date.now();
    Store.set(Store.keys.water, state.water);
    sendGenericNotification("Time for some water 💧", "Staying hydrated helps your medicine work well.");
  }
}, 60000);

function sendGenericNotification(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
}

/* ---------------------------------------------------------
   13. EMERGENCY / MEDICAL INFO
   --------------------------------------------------------- */
function loadEmergency() {
  document.getElementById("ecName").value = state.emergency.name;
  document.getElementById("ecPhone").value = state.emergency.phone;
  document.getElementById("miBlood").value = state.emergency.blood;
  document.getElementById("miAllergies").value = state.emergency.allergies;
  document.getElementById("miConditions").value = state.emergency.conditions;
  updateQuickCall();
}
["ecName", "ecPhone"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => {
    state.emergency.name = document.getElementById("ecName").value;
    state.emergency.phone = document.getElementById("ecPhone").value;
    Store.set(Store.keys.emergency, state.emergency);
    updateQuickCall();
  });
});
function updateQuickCall() {
  const phone = state.emergency.phone.replace(/[^\d+]/g, "");
  document.getElementById("quickCallBtn").href = phone ? `tel:${phone}` : "#";
}
document.getElementById("saveMedInfoBtn").addEventListener("click", () => {
  state.emergency.blood = document.getElementById("miBlood").value;
  state.emergency.allergies = document.getElementById("miAllergies").value;
  state.emergency.conditions = document.getElementById("miConditions").value;
  Store.set(Store.keys.emergency, state.emergency);
  toast("Medical information saved.");
});

/* ---------------------------------------------------------
   14. TOAST
   --------------------------------------------------------- */
let toastTimer;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => { el.hidden = true; }, 250);
  }, 3200);
}

/* ---------------------------------------------------------
   15. UTILITIES
   --------------------------------------------------------- */
function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
function formatSpokenTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------------------------------------------------
   16. INIT
   --------------------------------------------------------- */
function init() {
  applySettings();
  updateFrequencyFields();
  tickClock();
  renderMedicines();
  renderDashboard();
  renderNextDose();
  renderHistory();
  renderWater();
  loadEmergency();
  showRandomTip();
  checkReminders();

  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  setTimeout(() => {
    document.getElementById("loader").classList.add("hide");
  }, 700);
}

document.addEventListener("DOMContentLoaded", init);