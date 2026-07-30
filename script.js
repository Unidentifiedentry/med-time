// In-memory state for now — persistence (localStorage) comes in the next step.
const state = {
  doses: [
    { id: 1, name: 'Amoxicillin', dose: '500 mg', time: '08:00', status: 'pending' },
    { id: 2, name: 'Vitamin D', dose: '1000 IU', time: '08:00', status: 'pending' },
    { id: 3, name: 'Metformin', dose: '850 mg', time: '19:00', status: 'pending' }
  ]
};

const doseListEl = document.getElementById('doseList');
const emptyStateEl = document.getElementById('emptyState');
const dateHeadingEl = document.getElementById('dateHeading');

const modalBackdrop = document.getElementById('modalBackdrop');
const openAddBtn = document.getElementById('openAddBtn');
const cancelAddBtn = document.getElementById('cancelAddBtn');
const addForm = document.getElementById('addForm');

function setDateHeading() {
  const today = new Date();
  dateHeadingEl.textContent = today.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric'
  });
}

function statusLabel(status) {
  if (status === 'taken') return 'Taken';
  if (status === 'skipped') return 'Skipped';
  return '';
}

function renderDoses() {
  const sorted = [...state.doses].sort((a, b) => a.time.localeCompare(b.time));

  doseListEl.innerHTML = '';
  emptyStateEl.hidden = sorted.length > 0;

  sorted.forEach((med) => {
    const card = document.createElement('article');
    card.className = 'dose-card' + (med.status !== 'pending' ? ` dose-card--${med.status}` : '');
    card.dataset.id = med.id;

    card.innerHTML = `
      <div class="dose-card__tab"></div>
      <div class="dose-card__main">
        <div class="dose-card__row">
          <p class="dose-card__time">${med.time}</p>
          <h3 class="dose-card__name">${med.name}</h3>
          <p class="dose-card__dose">${med.dose}${med.status !== 'pending' ? ' · ' + statusLabel(med.status) : ''}</p>
        </div>
        <hr class="dose-card__divider">
        <div class="dose-card__actions">
          <button class="chip chip--taken ${med.status === 'taken' ? 'is-active' : ''}" data-action="taken">Taken</button>
          <button class="chip chip--skip ${med.status === 'skipped' ? 'is-active' : ''}" data-action="skip">Skip</button>
        </div>
      </div>
    `;

    doseListEl.appendChild(card);
  });
}

// Event delegation for Taken / Skip chips
doseListEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;

  const card = e.target.closest('.dose-card');
  const id = Number(card.dataset.id);
  const med = state.doses.find((d) => d.id === id);
  const action = btn.dataset.action === 'taken' ? 'taken' : 'skipped';

  // Clicking an already-active state resets it back to pending
  med.status = med.status === action ? 'pending' : action;
  renderDoses();
});

function openModal() {
  modalBackdrop.hidden = false;
  document.getElementById('medName').focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
  addForm.reset();
}

openAddBtn.addEventListener('click', openModal);
cancelAddBtn.addEventListener('click', closeModal);

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalBackdrop.hidden) closeModal();
});

addForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('medName').value.trim();
  const dose = document.getElementById('medDose').value.trim();
  const time = document.getElementById('medTime').value;

  if (!name || !dose || !time) return;

  state.doses.push({ id: Date.now(), name, dose, time, status: 'pending' });
  closeModal();
  renderDoses();
});

setDateHeading();
renderDoses();