// Aventura de Problemas (LOCAL) – Sin Firebase / Sin IA
// Misma estructura visual/IDs que tu HTML original, con modal blindado

// -------- Datos base --------
const defaultProblems = [
  { grade: 1, question: "Si tengo 6 manzanas y me regalan 2 más, ¿cuántas manzanas tengo ahora?", type: "CAMBIO",
    data: { ci: "6", c: "2", cf: "?" }, labels: { ci: "Manzanas Iniciales", c: "Cambio (+)", cf: "Manzanas Finales" },
    operation: "+", answer: "8", fullAnswer: "Ahora tengo 8 manzanas.", hint: "¿Al final tendré más o menos manzanas que al principio?", logicCheck: "¿El total es mayor que las partes?" },
  { grade: 1, question: "Hay 8 pájaros en una rama. Si 3 se van volando, ¿cuántos quedan?", type: "CAMBIO",
    data: { ci: "8", c: "3", cf: "?" }, labels: { ci: "Pájaros Iniciales", c: "Cambio (-)", cf: "Pájaros Finales" },
    operation: "-", answer: "5", fullAnswer: "Quedan 5 pájaros.", hint: "Si los pájaros se van, ¿habrá más o menos que antes?", logicCheck: "¿El total es mayor que las partes?" },
  { grade: 2, question: "Ana tiene 15 cromos y Luis tiene 9. ¿Cuántos cromos tiene Ana más que Luis?", type: "COMPARACION",
    data: { cm: "15", cmen: "9", d: "?" }, labels: { cm: "Cantidad Mayor (Ana)", cmen: "Cantidad Menor (Luis)", d: "Diferencia" },
    operation: "-", answer: "6", fullAnswer: "Ana tiene 6 cromos más que Luis.", hint: "Estamos buscando la diferencia entre lo que tiene Ana y lo que tiene Luis.", logicCheck: "¿La cantidad mayor es la suma de la menor y la diferencia?" },
  { grade: 4, question: "Compro una camiseta de 15€ y un pantalón de 22€. Si pago con un billete de 50€, ¿cuánto me devuelven?", type: "DOS_OPERACIONES",
    steps: [
      { type: "PPT",
        data: { p1: "15", p2: "22", t: "?" },
        labels: { p1: "Camiseta", p2: "Pantalón", t: "Gasto total" },
        operation: "+", answer: "37" },
      { type: "CAMBIO",
        data: { ci: "50", c: "37", cf: "?" },
        labels: { ci: "Pago", c: "Gasto", cf: "Cambio" },
        operation: "-", answer: "13" }
    ],
    fullAnswer: "Primero sumo 15 + 22 = 37. Luego 50 - 37 = 13. Me devuelven 13€.",
    hint: "Calcula el total del gasto y luego el cambio.",
    logicCheck: "¿El cambio es menor que el pago?"
  }
];

// --- Globals & helpers reintroduced after merge cleanup ---
const LS_KEY = 'banco_problemas_v1';
const AV_PREF_KEY = `${LS_KEY}_avatar_prefs`;
const API_PREF_KEY = `${LS_KEY}_api_base`;

const state = {
  problems: [],
  currentProblems: [],
  currentProblem: null,
  currentStep: 0
};

function $(sel) { return document.querySelector(sel); }
function rid() { return Math.random().toString(36).slice(2, 10); }

function loadProblems() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) && arr.length ? arr : defaultProblems.map(p => ({ id: rid(), createdAt: Date.now(), ...p }));
  } catch(e) {
    return defaultProblems.map(p => ({ id: rid(), createdAt: Date.now(), ...p }));
  }
}
function saveProblems(arr) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr || [])); } catch(e) {}
}

// API base configuration (for calling serverless backend from static hosting like GitHub Pages)
function getApiBase() {
  try {
    let v = localStorage.getItem(API_PREF_KEY)
      || (document.querySelector('meta[name="api-base"]')?.content)
      || (window.APP_CONFIG && window.APP_CONFIG.apiBase)
      || '';
    if (v && v.endsWith('/')) v = v.slice(0, -1);
    return v;
  } catch(_) { return ''; }
}
function setApiBase(url) { try { localStorage.setItem(API_PREF_KEY, (url || '').replace(/\/$/, '')); } catch(_){} }

// Close any modal leftovers on startup to avoid blocking UI
function forceCloseModals() {
  try {
    document.querySelectorAll('.modal-visible').forEach(m => {
      m.classList.remove('modal-visible');
      m.classList.add('hidden');
      m.classList.add('hidden-view');
    });
  } catch(e) {}
}

// --- Lightweight UI helpers: toast notifications ---
function showToast(message, type = 'info', timeout = 3000) {
  try {
    const mount = document.getElementById('toast-container');
    if (!mount) { alert(message); return; }
    const wrap = document.createElement('div');
    wrap.className = 'px-4 py-2 rounded shadow text-white';
    const colors = { info: '#2563eb', success: '#16a34a', error: '#dc2626', warn: '#d97706' };
    wrap.style.background = colors[type] || colors.info;
    wrap.textContent = message;
    mount.appendChild(wrap);
    setTimeout(() => { try { wrap.classList.add('opacity-0'); setTimeout(()=>wrap.remove(), 300); } catch(_){} }, timeout);
  } catch(_) { /* no-op */ }
}

function showToastAction(message, actionLabel, onClick, type = 'info', timeout = 5000) {
  try {
    const mount = document.getElementById('toast-container');
    if (!mount) { if (confirm(message + '\n\nEjecutar: ' + actionLabel + '?')) onClick && onClick(); return; }
    const wrap = document.createElement('div');
    wrap.className = 'px-4 py-2 rounded shadow text-white flex items-center gap-3';
    const colors = { info: '#2563eb', success: '#16a34a', error: '#dc2626', warn: '#d97706' };
    wrap.style.background = colors[type] || colors.info;
    const span = document.createElement('span'); span.textContent = message; wrap.appendChild(span);
    const btn = document.createElement('button'); btn.className = 'bg-white/20 hover:bg-white/30 px-2 py-1 rounded'; btn.textContent = actionLabel || 'Acción';
    btn.onclick = () => { try { onClick && onClick(); } finally { wrap.remove(); } };
    wrap.appendChild(btn);
    mount.appendChild(wrap);
    setTimeout(() => { try { wrap.classList.add('opacity-0'); setTimeout(()=>wrap.remove(), 300); } catch(_){} }, timeout);
  } catch(_) { /* no-op */ }
}

// --- Simple undo stack ---
let _undoStack = [];
function pushUndo(entry) { try { _undoStack.push(entry); } catch(_){} }
function undoLastAction() {
  try {
    if (!_undoStack.length) { showToast('Nada que deshacer.', 'info'); return; }
    const last = _undoStack.pop();
    if (!last) return;
    if (last.type === 'delete' && last.payload) {
      const { item, index } = last.payload;
      if (item) {
        const pos = Number.isInteger(index) ? index : state.problems.length;
        state.problems.splice(Math.max(0, Math.min(pos, state.problems.length)), 0, item);
        saveProblems(state.problems);
        try { fetchProblemsForEditor(String(item.grade || document.getElementById('grade-selector')?.value || '1')); } catch(_){}
        showToast('Deshecho borrado', 'success');
      }
    } else if (last.type === 'import' && last.payload && last.payload.backupKey) {
      restoreBackup(last.payload.backupKey);
      showToast('Deshecha importación (restaurado backup)', 'success');
    } else {
      showToast('Acción no deshacible.', 'info');
    }
  } catch(e) { showToast('Error al deshacer', 'error'); }
}

// --- Data helpers ---
function norm(v) {
  if (v == null) return '';
  const s = String(v).trim();
  if (s === '?' || s.toUpperCase() === 'RESULTADO_ANTERIOR') return s;
  // keep only digits, optional minus and dot; normalize comma to dot
  const t = s.replace(',', '.').match(/-?[0-9]*\.?[0-9]+/);
  return t ? t[0] : s;
}

// Fallback CPA synthesizer if no cpa is provided on a step
function synthesizeCPA(step) {
  const type = (step && step.type) || 'PPT';
  const data = (step && step.data) || {};
  const icon = '🔷';
  const items = {};
  Object.entries(data).forEach(([k, v]) => {
    if (v && v !== '?' && v !== 'RESULTADO_ANTERIOR') {
      const n = Number(String(v).replace(',', '.'));
      if (Number.isFinite(n) && n >= 0) items[k] = { count: Math.round(Math.min(n, 100)), icon };
    }
  });
  const abstractTpl = {
    PPT: '{p1} + {p2} = {t}',
    UVT: '{u} x {v} = {t}',
    COMPARACION: '{cm} - {cmen} = {d}',
    CAMBIO: '{ci} ± {c} = {cf}'
  }[type] || '';
  return {
    concrete: { items, layout: 'row' },
    pictorial: { theme: 'bars' },
    abstract: abstractTpl ? { template: abstractTpl, hideUnknown: true } : undefined
  };
}

function renderConcrete(cpa, step, mount) {
  if (!mount) return;
  mount.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.display = 'flex'; wrap.style.flexWrap = 'wrap'; wrap.style.gap = '.25rem';
  const items = cpa?.concrete?.items || {};
  const keys = Object.keys(items);
  if (!keys.length) { mount.textContent = 'No hay representación concreta disponible.'; return; }
  keys.forEach(k => {
    const group = document.createElement('div'); group.style.marginRight = '1rem';
    const label = document.createElement('div'); label.className = 'text-sm font-bold mb-1'; label.textContent = (step.labels && step.labels[k]) || k.toUpperCase();
    const row = document.createElement('div');
    const { count, icon } = items[k] || {};
    const max = Math.min(count || 0, 50);
    for (let i=0;i<max;i++) { const span = document.createElement('span'); span.className = 'cpa-item'; span.textContent = icon || '🔷'; row.appendChild(span); }
    if ((count||0) > 50) { const more = document.createElement('span'); more.className = 'text-sm font-bold ml-2'; more.textContent = `+${(count||0)-50} más`; row.appendChild(more); }
    group.appendChild(label); group.appendChild(row); wrap.appendChild(group);
  });
  mount.appendChild(wrap);
}

function renderPictorial(cpa, step, mount) {
  if (!mount) return; mount.innerHTML = '';
  const theme = cpa?.pictorial?.theme || 'bars';
  const { data, type } = step || {};
  const toN = v => (v === '?' || v === 'RESULTADO_ANTERIOR') ? null : Number(String(v).replace(',', '.'));
  if (theme === 'numberline') {
    const max = Math.max(...Object.values(data||{}).map(toN).filter(n => Number.isFinite(n)), 10);
    const line = document.createElement('div'); line.style.position = 'relative'; line.style.height = '4px'; line.style.background = '#cbd5e1'; line.style.margin = '12px 0'; line.style.borderRadius = '2px'; line.style.width = '100%'; mount.appendChild(line);
    const tickWrap = document.createElement('div'); tickWrap.style.display = 'flex'; tickWrap.style.justifyContent = 'space-between'; tickWrap.style.marginTop = '6px';
    for (let i=0;i<=max;i++) { const t = document.createElement('span'); t.className = 'text-xs'; t.textContent = i; tickWrap.appendChild(t); }
    mount.appendChild(tickWrap);
    return;
  }
  const map = {
    'PPT': ['p1','p2','t'], 'UVT': ['u','v','t'], 'COMPARACION': ['cm','cmen','d'], 'CAMBIO': ['ci','c','cf']
  }[type] || Object.keys(data||{});
  const values = Object.values(data||{}).map(toN).filter(n => Number.isFinite(n));
  const maxVal = Math.max(...values, 1);
  map.forEach(k => {
    const n = toN((data||{})[k]);
    const label = document.createElement('div'); label.className = 'text-sm font-bold'; label.textContent = (step.labels && step.labels[k] ? step.labels[k] : k.toUpperCase()) + (Number.isFinite(n) ? `: ${n}` : ': ?');
    const bar = document.createElement('div'); bar.className = 'cpa-bar'; const fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = Number.isFinite(n) ? `${(n/maxVal)*100}%` : '0%'; bar.appendChild(fill);
    const row = document.createElement('div'); row.style.marginBottom = '.4rem'; row.appendChild(label); row.appendChild(bar); mount.appendChild(row);
  });
}

function renderAbstract(cpa, step, mount) {
  if (!mount) return; mount.innerHTML = '';
  const tpl = cpa?.abstract?.template;
  if (!tpl) { mount.textContent = 'No hay representación abstracta disponible.'; return; }
  let expr = tpl;
  Object.entries(step.data || {}).forEach(([k,v]) => { expr = expr.replaceAll(`{${k}}`, v); });
  if (cpa.abstract.hideUnknown) { Object.entries(step.data || {}).forEach(([k,v]) => { if (v === '?') expr = expr.replaceAll(`{${k}}`, '?'); }); }
  const p = document.createElement('p'); p.className = 'mono-op'; p.textContent = expr; mount.appendChild(p);
}

// -------- Inicio --------
document.addEventListener('DOMContentLoaded', () => {
  forceCloseModals();                // <- asegura que no hay overlay bloqueando
  // Load or seed problems before rendering UI
  state.problems = loadProblems();
  renderLevelSelection();
  renderEditor();
  wireModeToggle();
  wireAccessibility();
  wireSkipLink();
  wireAiGenerator();
});

// Skip to content handler
function wireSkipLink() {
  const skip = document.getElementById('skip-to-content');
  if (!skip) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    // If a modal is open, focus the first focusable element in the modal instead
    const modalOpen = document.querySelector('.modal-visible');
    if (modalOpen) {
      const first = modalOpen.querySelector('input, button, select, textarea, a');
      if (first) { first.focus(); return; }
    }
    // otherwise focus the main visible content area
    const main = document.querySelector('#game-container:not(.hidden-view)') || document.querySelector('#editor-view:not(.hidden-view)');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      // remove tabindex after focus to avoid focus trap
      setTimeout(() => { main.removeAttribute('tabindex'); }, 1000);
  announce('Has saltado al contenido principal. Usa Tab para navegar.');
    }
  });

  // hide skip link if focus is inside a modal (avoid confusing tab order)
  document.addEventListener('focusin', (ev) => {
    const modalOpen = document.querySelector('.modal-visible');
    if (modalOpen) skip.classList.add('hidden'); else skip.classList.remove('hidden');
  });
}

function announce(message) {
  try {
    const el = document.getElementById('a11y-announcer');
    if (!el) return;
    el.textContent = '';
    // small timeout to ensure assistive tech notices change
    setTimeout(() => { el.textContent = message; }, 50);
  } catch(e){}
}

// Accessibility toggles, persistence and wiring
const ACC_KEY = `${LS_KEY}_accessibility`;
function wireAccessibility() {
  const btn = $('#accessibility-btn');
  const panel = $('#accessibility-panel');
  const close = $('#acc-close');
  if (btn && panel) {
    btn.onclick = (e) => { e.stopPropagation(); panel.classList.toggle('hidden'); };
    close && (close.onclick = () => panel.classList.add('hidden'));
    // clicks outside panel close it
    document.addEventListener('click', (e) => { if (!panel.contains(e.target) && e.target !== btn) panel.classList.add('hidden'); });

    // load saved
    try {
      const raw = localStorage.getItem(ACC_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      ['contrast','large','font','reduce-motion'].forEach(k => {
        const el = document.getElementById('acc-' + k);
        if (el) el.checked = !!settings[k];
      });
      applyAccessibilitySettings(settings);
    } catch(e){}

    // wire toggles
    ['contrast','large','font','reduce-motion'].forEach(k => {
      const el = document.getElementById('acc-' + k);
      if (!el) return;
      el.addEventListener('change', () => {
        const settings = {
          contrast: !!document.getElementById('acc-contrast').checked,
          large: !!document.getElementById('acc-large').checked,
          font: !!document.getElementById('acc-font').checked,
          'reduce-motion': !!document.getElementById('acc-reduce-motion').checked,
        };
        try { localStorage.setItem(ACC_KEY, JSON.stringify(settings)); } catch(e){}
        applyAccessibilitySettings(settings);
      });
    });

    // reading mode, dyslexic font and leading controls
    try {
      const reading = document.getElementById('acc-reading');
      const dys = document.getElementById('acc-dyslexic');
      const leading = document.getElementById('acc-leading');
      const leadingVal = document.getElementById('acc-leading-val');
      // restore
      try { const raw2 = localStorage.getItem(ACC_KEY); const settings2 = raw2 ? JSON.parse(raw2) : {}; if (settings2.reading) reading.checked = !!settings2.reading; if (settings2.dyslexic) dys.checked = !!settings2.dyslexic; if (settings2.leading) { leading.value = settings2.leading; if (leadingVal) leadingVal.textContent = Number(settings2.leading).toFixed(2); } } catch(e){}

      function applyReadingSettings() {
        const settings = JSON.parse(localStorage.getItem(ACC_KEY) || '{}');
        settings.reading = !!(reading && reading.checked);
        settings.dyslexic = !!(dys && dys.checked);
        settings.leading = leading ? leading.value : (settings.leading || 1.5);
        try { localStorage.setItem(ACC_KEY, JSON.stringify(settings)); } catch(e){}
        // apply classes
        document.body.classList.toggle('acc-reading', !!settings.reading);
        document.body.classList.toggle('acc-dyslexic', !!settings.dyslexic);
        // apply CSS variable for line-height
        document.documentElement.style.setProperty('--reading-line-height', settings.leading || 1.5);
      }

      if (reading) reading.addEventListener('change', applyReadingSettings);
      if (dys) dys.addEventListener('change', applyReadingSettings);
      if (leading) leading.addEventListener('input', () => { if (leadingVal) leadingVal.textContent = Number(leading.value).toFixed(2); applyReadingSettings(); });
      // initial apply
      applyReadingSettings();
    } catch(e) {}

    // If dyslexic font is enabled but not available locally, offer CDN load
    try {
      function isOpenDyslexicAvailable() {
        return Array.from(document.fonts).some(f => /OpenDyslexic/i.test(f.family));
      }
      const dysCheckbox = document.getElementById('acc-dyslexic');
      if (dysCheckbox) {
        dysCheckbox.addEventListener('change', () => {
          if (dysCheckbox.checked) {
            // quick check: if font not available, ask to load from CDN
            setTimeout(() => {
              const available = isOpenDyslexicAvailable();
              if (!available) {
                if (confirm('No se ha detectado OpenDyslexic instalada localmente. \'Cargar desde CDN\' permitirá usar la fuente sin instalarla. \u00bfCargar desde CDN ahora?')) {
                  // inject link to CDN (jsDelivr for OpenDyslexic WOFF2 via GitHub)
                  const link = document.createElement('link');
                  link.rel = 'stylesheet';
                  link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@latest/open-dyslexic-regular.css';
                  document.head.appendChild(link);
                  showToast('Cargando fuente desde CDN...', 'info');
                }
              }
            }, 300);
          }
        });
      }
    } catch(e) {}
    // Read aloud button
    const readBtn = document.getElementById('acc-read');
    if (readBtn) {
      readBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = speakCurrentProblem();
        if (!ok) showToast('No hay problema cargado para leer.', 'info');
      });
    }

    // TTS controls: populate voices, rate and control buttons
    try {
      const voiceSel = document.getElementById('acc-voice');
      const rateEl = document.getElementById('acc-rate');
      const playBtn = document.getElementById('acc-tts-play');
      const pauseBtn = document.getElementById('acc-tts-pause');
      const resumeBtn = document.getElementById('acc-tts-resume');
      const stopBtn = document.getElementById('acc-tts-stop');
    const pitchEl = document.getElementById('acc-pitch');
    const rateVal = document.getElementById('acc-rate-val');
    const pitchVal = document.getElementById('acc-pitch-val');

      function saveTtsPref(pref) {
        try { const raw = localStorage.getItem(ACC_KEY); const obj = raw ? JSON.parse(raw) : {}; Object.assign(obj, pref); localStorage.setItem(ACC_KEY, JSON.stringify(obj)); } catch(e){}
      }

      function populateVoices() {
        if (!window.speechSynthesis) return;
        const voices = window.speechSynthesis.getVoices();
        if (!voiceSel) return;
        voiceSel.innerHTML = '';
        voices.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v.name + '||' + v.lang;
          opt.textContent = `${v.name} (${v.lang})`;
          voiceSel.appendChild(opt);
        });
        // restore saved voice if present
        try { const raw = localStorage.getItem(ACC_KEY); const settings = raw ? JSON.parse(raw) : {}; if (settings.voice) { const found = Array.from(voiceSel.options).find(o => o.value.indexOf(settings.voice) !== -1); if (found) voiceSel.value = found.value; } } catch(e){}
      }

      if (window.speechSynthesis) {
        populateVoices();
        // Some browsers load voices asynchronously
        window.speechSynthesis.onvoiceschanged = populateVoices;
      }

      // restore rate
      try { const raw = localStorage.getItem(ACC_KEY); const settings = raw ? JSON.parse(raw) : {}; if (settings.rate) rateEl.value = settings.rate; } catch(e){}

      if (voiceSel) voiceSel.addEventListener('change', () => { saveTtsPref({ voice: voiceSel.value }); });
  if (rateEl) rateEl.addEventListener('input', () => { saveTtsPref({ rate: rateEl.value }); if (rateVal) rateVal.textContent = Number(rateEl.value).toFixed(2); });
  if (pitchEl) pitchEl.addEventListener('input', () => { saveTtsPref({ pitch: pitchEl.value }); if (pitchVal) pitchVal.textContent = Number(pitchEl.value).toFixed(2); });

      // control buttons
  if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); const ok = speakCurrentProblem({ useSelected: true }); if (!ok) showToast('No hay texto para leer o el navegador no soporta TTS.', 'error'); });
      if (pauseBtn) pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); try { if (window.speechSynthesis && window.speechSynthesis.speaking) window.speechSynthesis.pause(); } catch(e){} });
      if (resumeBtn) resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); try { if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch(e){} });
      if (stopBtn) stopBtn.addEventListener('click', (e) => { e.stopPropagation(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){} });
    } catch(e) { /* ignore */ }

    // Keyboard shortcuts (global): Ctrl+Shift+P play/pause toggle, Ctrl+Shift+R resume, Ctrl+Shift+S stop
    document.addEventListener('keydown', (ev) => {
      if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyP') {
        ev.preventDefault();
        // toggle play/pause
        try {
          if (!window.speechSynthesis) return;
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) window.speechSynthesis.pause();
          else if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          else speakCurrentProblem({ useSelected: true });
        } catch(e){}
      }
      if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyR') { ev.preventDefault(); try { if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume(); } catch(e){} }
      if (ev.ctrlKey && ev.shiftKey && ev.code === 'KeyS') { ev.preventDefault(); try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch(e){} }
    });

    // keyboard shortcut: Ctrl+Shift+A toggles accessibility panel
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        panel.classList.toggle('hidden');
        const first = panel.querySelector('input, button');
        if (first) first.focus();
      }
    });
  }
}

// Simple text-to-speech using Web Speech API; returns true if started
function speakCurrentProblem(options = {}) {
  try {
    if (!window.speechSynthesis) return false;
    const p = state.currentProblem;
    if (!p || !p.question) return false;
    // stop ongoing speech
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance('');
    utter.lang = 'es-ES';
    // build natural text for the problem (if options.useSelectedStep may be used later)
    let text = p.question || '';
    // prefer to include a short description of steps when DOS_OPERACIONES
    if (p.type === 'DOS_OPERACIONES' && Array.isArray(p.steps)) {
      const pieces = [p.question];
      p.steps.forEach((s, i) => {
        const stepNum = i + 1;
        const labels = s.labels || {};
        const data = s.data || {};
        const parts = [];
        for (const k in labels) { parts.push(`${labels[k]}: ${data[k] ?? ''}`); }
        pieces.push(`Paso ${stepNum}: ${parts.join(', ')}.`);
      });
      text = pieces.join(' ');
    }
    utter.text = text;
    // apply selected voice, rate and pitch if available
    try {
      const raw = localStorage.getItem(ACC_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      if (settings && settings.voice && window.speechSynthesis.getVoices) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => (settings.voice && (v.name + '||' + v.lang) === settings.voice) || v.name === settings.voice || v.lang === settings.voice);
        if (match) utter.voice = match;
      }
      if (settings && settings.rate) utter.rate = Number(settings.rate) || 1.0;
      if (settings && settings.pitch) utter.pitch = Number(settings.pitch) || 1.0;
    } catch(e) {}
    window.speechSynthesis.speak(utter);
    return true;
  } catch (e) { return false; }
}

function speakText(text) {
  try {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'es-ES';
    try {
      const raw = localStorage.getItem(ACC_KEY);
      const settings = raw ? JSON.parse(raw) : {};
      if (settings && settings.voice && window.speechSynthesis.getVoices) {
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(v => (settings.voice && (v.name + '||' + v.lang) === settings.voice) || v.name === settings.voice || v.lang === settings.voice);
        if (match) utter.voice = match;
      }
      if (settings && settings.rate) utter.rate = Number(settings.rate) || 1.0;
      if (settings && settings.pitch) utter.pitch = Number(settings.pitch) || 1.0;
    } catch(e) {}
    window.speechSynthesis.speak(utter);
    return true;
  } catch(e) { return false; }
}

// Speak a single step with formatted natural text (used by speakStep)
function formatStepForSpeech(problem, stepIndex) {
  if (!problem) return '';
  if (problem.type === 'DOS_OPERACIONES') {
    const s = (problem.steps || [])[stepIndex - 1];
    if (!s) return problem.question || '';
    const parts = [];
    for (const k in s.labels) { parts.push(`${s.labels[k]}: ${s.data ? (s.data[k] ?? '') : ''}`); }
    return `Paso ${stepIndex}. ${parts.join(', ')}.`;
  } else {
    // single-step problems: read labels + data
    const parts = [];
    for (const k in problem.labels || {}) { parts.push(`${problem.labels[k]}: ${problem.data ? (problem.data[k] ?? '') : ''}`); }
    return `${problem.question || ''} ${parts.join(', ')}.`;
  }
}

// Speak the text for a specific step number (1..4)
function speakStep(stepNumber) {
  if (!state.currentProblem) return false;
  // Prefer to read the visible instruction for the step rendered in the DOM.
  try {
    const stepEl = document.querySelector(`#step-${stepNumber}`);
    if (stepEl) {
      const instr = stepEl.querySelector('.step-content p');
      if (instr && instr.textContent.trim()) return speakText(instr.textContent.trim());
    }
  } catch (e) {}
  // Fallback: use formatted step text
  const formatted = formatStepForSpeech(state.currentProblem, stepNumber);
  return speakText(formatted || state.currentProblem.question || '');
}

function applyAccessibilitySettings(settings) {
  const body = document.body;
  body.classList.toggle('acc-contrast', !!settings.contrast);
  body.classList.toggle('acc-large', !!settings.large);
  body.classList.toggle('acc-font', !!settings.font);
  body.classList.toggle('acc-reduce-motion', !!settings['reduce-motion']);
}

// -------- Toggle modo --------
function wireModeToggle() {
  const toggle = $('#mode-toggle');
  toggle.addEventListener('change', () => {
    forceCloseModals();              // <- cierra modales al alternar
    $('#play-view').classList.toggle('hidden-view');
    const editor = $('#editor-view');
    editor.classList.toggle('hidden-view');
    if (!editor.classList.contains('hidden-view')) {
      fetchProblemsForEditor($('#grade-selector').value);
    }
  });
}

// -------- Vista Cursos --------
function renderLevelButtons() {
  const colors = ['yellow', 'green', 'blue', 'red', 'purple', 'pink'];
  document.querySelectorAll('.level-btn').forEach((btn, index) => {
    const color = colors[index % colors.length];
    btn.className = `level-btn text-lg font-bold py-6 bg-${color}-400 text-${color}-900 rounded-xl shadow-lg transition hover:transform hover:-translate-y-1`;
    btn.onclick = () => showCourseSelection(index + 1);
  });
}

function renderLevelSelection() {
  const levelSelectionDiv = $('#level-selection');
  levelSelectionDiv.classList.remove('hidden-view');

  const courses = ['1º Primaria', '2º Primaria', '3º Primaria', '4º Primaria', '5º Primaria', '6º Primaria'];
  let buttonsHTML = '';
  courses.forEach(course => { buttonsHTML += `<button class="level-btn">${course}</button>`; });

  levelSelectionDiv.innerHTML = `
    <h1 class="text-4xl md:text-5xl font-black text-white mb-2">Aventura de Problemas</h1>
    <p id="level-selection-subtitle" class="text-white text-lg mb-8">Selecciona tu curso para empezar a jugar</p>
    <div id="level-buttons-container" class="grid grid-cols-2 md:grid-cols-3 gap-4">${buttonsHTML}</div>
  `;
  renderLevelButtons();

  $('#problem-selection-view').classList.add('hidden-view');
  $('#game-container').classList.add('hidden-view');
}

// -------- Selección curso → problema --------
function showCourseSelection(level) {
  state.currentLevel = level;
  state.currentProblems = state.problems.filter(p => p.grade === level);
  if (!state.currentProblems.length) {
    showToast(`No hay problemas para ${level}º. Añade algunos en el Modo Editor.`, 'info');
    return;
  }
  showProblemSelection();
}

function showProblemSelection() {
  const view = $('#problem-selection-view');
  view.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-2xl font-bold text-gray-800">Problemas de ${state.currentLevel}º Primaria</h2>
      <button id="btn-back-courses" class="text-sm text-gray-600 hover:text-gray-800 font-bold py-2 px-4 rounded transition">← Volver a Cursos</button>
    </div>
    <div id="problem-selection-list" class="space-y-3 max-h-[60vh] overflow-y-auto"></div>
  `;
  $('#btn-back-courses').onclick = () => renderLevelSelection();

  const list = $('#problem-selection-list');
  list.innerHTML = '';
    state.currentProblems.forEach((problem, index) => {
      const li = document.createElement('li');
      li.className = 'problem-item p-4 border rounded-lg cursor-pointer bg-white shadow-sm';
      const qdiv = document.createElement('div');
      qdiv.className = 'problem-question';
      qdiv.textContent = problem.question;
      // small wrapper so we can place the expand control alongside
      const rowInner = document.createElement('div');
      rowInner.className = 'flex items-start justify-between';
      const left = document.createElement('div');
      left.style.flex = '1 1 auto';
      left.appendChild(qdiv);
      const btnWrap = document.createElement('div');
      btnWrap.style.flex = '0 0 auto';
      const expandBtn = document.createElement('button');
      expandBtn.className = 'text-sm text-blue-600 ml-3 view-full-btn';
      expandBtn.setAttribute('aria-expanded', 'false');
      expandBtn.setAttribute('aria-controls', 'problem-question-' + index);
      expandBtn.textContent = 'Ver completo';
      expandBtn.onclick = (e) => {
        e.stopPropagation();
        const expanded = qdiv.classList.toggle('expanded');
        expandBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        expandBtn.textContent = expanded ? 'Ocultar' : 'Ver completo';
        if (expanded) { qdiv.classList.add('expanded'); qdiv.style.maxHeight = 'none'; } else { qdiv.classList.remove('expanded'); qdiv.style.maxHeight = ''; }
      };
      // set id for aria-controls
      qdiv.id = 'problem-question-' + index;
      btnWrap.appendChild(expandBtn);
      rowInner.appendChild(left);
      rowInner.appendChild(btnWrap);
      li.appendChild(rowInner);
      li.onclick = () => selectProblem(index);
      list.appendChild(li);
  });

  $('#level-selection').classList.add('hidden-view');
  $('#game-container').classList.add('hidden-view');
  view.classList.remove('hidden-view');
}

function selectProblem(index) {
  state.currentProblemIndex = index;
  state.currentProblem = state.currentProblems[index];
  renderGameContainer();
  $('#problem-selection-view').classList.add('hidden-view');
  $('#game-container').classList.remove('hidden-view');
  loadProblem();
}

// -------- Juego --------
function renderGameContainer() {
  const gameContainerDiv = $('#game-container');
  gameContainerDiv.innerHTML = `
    <div class="flex justify-between items-center mb-6">
      <h2 id="level-title" class="text-2xl font-bold text-gray-800"></h2>
      <button id="btn-back-problems" class="text-sm text-gray-600 hover:text-gray-800 font-bold py-2 px-4 rounded transition">← Volver a Problemas</button>
    </div>
  <p id="problem-text" class="text-xl text-gray-700 leading-relaxed bg-gray-100 p-4 rounded-lg mb-2"></p>
  <div id="game-progress" class="w-full"><div class="bar"></div></div>
    <div id="steps-container"></div>
    <div id="final-buttons-container" class="mt-6 flex justify-end gap-4"></div>
  `;
  $('#btn-back-problems').onclick = () => showProblemSelection();
}

function loadProblem() {
  state.currentStep = 0;
  const stepProblem = state.currentProblem.type === 'DOS_OPERACIONES'
  ? state.currentProblem.steps[0] // Load the first step for DOS_OPERACIONES
    : state.currentProblem;

  $('#level-title').textContent = `${state.currentLevel}º Primaria`;
  $('#problem-text').textContent = state.currentProblem.question;

  setupStep1(stepProblem);
  // initialize progress bar
  updateGameProgress();
}

function renderStepUI(stepProblem) {
  const container = $('#steps-container');
  const stepNum = state.currentStep + 1;
  const totalSteps = state.currentProblem.type === 'DOS_OPERACIONES' ? state.currentProblem.steps.length : 1;
  const stepIndicator = totalSteps > 1 ? `<span class="text-sm ml-2 bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded-full">Paso ${stepNum}/${totalSteps}</span>` : '';

  container.innerHTML = `
    <div id="step-1" class="mb-6">
  <h3 class="step-title"><span class="mr-3 text-2xl">1</span> LEO E IDENTIFICO ${stepIndicator}</h3>
      <div class="step-content mt-4">
        <p class="mb-4 text-gray-600">Arrastra cada número a su caja.</p>
        <div class="flex items-center justify-center gap-4 mb-4" id="numbers-source"></div>
        <div id="data-slots-container" class="grid grid-cols-1 md:grid-cols-3 gap-4"></div>
        <button id="check-step1-btn" class="mt-4 font-bold text-white bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg transition shadow-md">Comprobar</button>
        <p id="feedback-step1" class="feedback opacity-0 mt-2 font-bold h-6"></p>
      </div>
    </div>

  <div id="step-2" class="mb-6 hidden-view">
  <h3 class="step-title"><span class="mr-3 text-2xl">2</span> RAZONO ${stepIndicator}</h3>
      <div class="step-content mt-4">
        <p class="mb-4 text-gray-600">Este es el diagrama del problema.</p>
        <div id="diagram-container" class="flex justify-center items-center min-h-[100px] bg-gray-50 p-4 rounded-lg border-2 border-dashed"></div>
        <div id="hint-container" class="mt-4"></div>
      </div>
    </div>

    <div id="step-3" class="mb-6 hidden-view">
  <h3 class="step-title"><span class="mr-3 text-2xl">3</span> CALCULO ${stepIndicator}</h3>
      <div class="step-content mt-4">
        <p class="mb-4 text-gray-600">Elige la operación y el resultado.</p>
        <div class="flex items-center gap-4" id="operations-container"></div>
        <input type="text" id="calculation-input" placeholder="Resultado" class="mt-4 w-32 text-lg px-4 py-2 border-2 border-gray-300 rounded-lg">
        <button id="check-step3-btn" class="mt-4 ml-4 font-bold text-white bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg">Comprobar</button>
        <p id="feedback-step3" class="feedback opacity-0 mt-2 font-bold h-6"></p>
      </div>
    </div>

    <div id="step-4" class="mb-6 hidden-view">
  <h3 class="step-title"><span class="mr-3 text-2xl">4</span> CONTESTO Y VALORO ${stepIndicator}</h3>
      <div class="step-content mt-4">
        <p class="mb-2 text-gray-600">Escribe la respuesta completa.</p>
        <input type="text" id="full-answer-input" placeholder="Respuesta completa..." class="w-full text-lg px-4 py-2 border-2 border-gray-300 rounded-lg">
        <div class="mt-4">
          <p class="mb-2 text-gray-600">¿La respuesta es lógica?</p>
          <div id="logic-check-container"></div>
        </div>
        <button id="check-step4-btn" class="mt-4 font-bold text-white bg-blue-500 hover:bg-blue-600 px-6 py-2 rounded-lg">Finalizar</button>
        <p id="feedback-step4" class="feedback opacity-0 mt-2 font-bold h-6"></p>
      </div>
    </div>
  `;
  // add enter animation to visible steps
  Array.from(container.querySelectorAll('#step-1, #step-2, #step-3, #step-4')).forEach(el => {
    if (!el.classList.contains('hidden-view')) {
      el.classList.remove('step-exit');
      el.classList.add('step-enter');
      setTimeout(() => el.classList.remove('step-enter'), 520);
    }
  });

  // add per-step 'Leer paso' buttons and wire them
  Array.from(container.querySelectorAll('.step-title')).forEach((titleEl, idx) => {
    // avoid adding multiple times
    if (titleEl.querySelector('.read-step-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'read-step-btn ml-3 px-2 py-1 text-sm rounded bg-indigo-600 text-white';
    btn.type = 'button';
    btn.textContent = '🔊 Leer paso';
    btn.setAttribute('data-step', String(idx+1));
    btn.onclick = (e) => { e.stopPropagation(); speakStep(idx+1); };
    titleEl.appendChild(btn);
  });

  $('#check-step1-btn').onclick = () => validateStep1(stepProblem);
  $('#check-step3-btn').onclick = () => validateStep3(stepProblem);
  $('#check-step4-btn').onclick = () => validateStep4(stepProblem);
}

// Small helpers to animate showing/hiding elements (adds classes then cleans up)
function animateShow(el) {
  if (!el) return;
  el.classList.remove('hidden-view');
  el.classList.remove('step-exit');
  el.classList.add('step-enter');
  setTimeout(() => el.classList.remove('step-enter'), 520);
}
function animateHide(el) {
  if (!el) return;
  el.classList.remove('step-enter');
  el.classList.add('step-exit');
  setTimeout(() => el.classList.add('hidden-view'), 320);
}

function setupStep1(stepProblem) {
  try { avatarStepAnnounce(0, 'start'); } catch(e){}
  renderStepUI(stepProblem);

  const numbersSource = $('#numbers-source');
  const numbers = Object.values(stepProblem.data).filter(v => v !== '?' && v !== 'RESULTADO_ANTERIOR');
  numbers.forEach(num => {
    const el = document.createElement('div');
    el.className = 'data-number bg-yellow-300 font-bold text-2xl p-4 rounded-lg shadow-md';
    el.textContent = num;
    el.draggable = true;
    el.id = `num-${num}-${Math.random()}`;
    el.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', e.target.id));
    numbersSource.appendChild(el);
  });

  const slotsContainer = $('#data-slots-container');
  const keys = Object.keys(stepProblem.labels);
  keys.forEach(key => {
    const slotDiv = document.createElement('div');
    slotDiv.className = 'p-4 rounded-lg bg-gray-100';
    slotDiv.innerHTML = `
      <p class="font-bold text-gray-700 mb-2">${stepProblem.labels[key]}</p>
      <div id="slot-${key}" data-key="${key}" class="data-slot p-2 rounded-lg flex items-center justify-center"></div>
    `;
    slotsContainer.appendChild(slotDiv);
  });

  document.querySelectorAll('.data-slot').forEach(slot => {
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('over'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('over'));
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.classList.remove('over');
      if (slot.children.length === 0) {
        const id = e.dataTransfer.getData('text');
        const draggedEl = document.getElementById(id);
        if (draggedEl) slot.appendChild(draggedEl);
      }
    });
  });
}

function setupStep2(stepProblem) {
  try { avatarStepAnnounce(1, 'start'); } catch(e){}
  const diagram = $('#diagram-container');
  const { data, type, hint } = stepProblem;

  let diagramHTML = '';
  if (type === "PPT") {
    diagramHTML = `
      <div class="text-center font-bold">
        <div class="flex gap-4 justify-center">
          <div class="p-4 border-2 rounded">P: ${data.p1}</div>
          <div class="p-4 border-2 rounded">P: ${data.p2}</div>
        </div>
        <div class="text-2xl my-2">↓</div>
        <div class="p-4 bg-blue-100 border-2 border-blue-400 rounded">T: ${data.t}</div>
      </div>`;
  } else if (type === "UVT") {
    diagramHTML = `
      <div class="text-center font-bold flex items-center gap-4 justify-center">
        <div class="p-4 border-2 rounded">U: ${data.u}</div>
        <div class="text-2xl">x</div>
        <div class="p-4 border-2 rounded">V: ${data.v}</div>
        <div class="text-2xl">=</div>
        <div class="p-4 bg-blue-100 border-2 border-blue-400 rounded">T: ${data.t}</div>
      </div>`;
  } else if (type === "COMPARACION") {
    diagramHTML = `
      <div class="text-center font-bold">
        <div class="p-4 border-2 rounded">CM: ${data.cm}</div>
        <div class="flex gap-4 mt-2 justify-center">
          <div class="p-4 border-2 rounded">cm: ${data.cmen}</div>
          <div class="p-4 border-2 rounded">d: ${data.d}</div>
        </div>
      </div>`;
  } else if (type === "CAMBIO") {
    diagramHTML = `
      <div class="text-center font-bold flex items-center gap-4 justify-center">
        <div class="p-4 border-2 rounded">CI: ${data.ci}</div>
        <div class="p-4 border-2 rounded">C: ${data.c}</div>
        <div class="text-2xl">→</div>
        <div class="p-4 bg-blue-100 border-2 border-blue-400 rounded">CF: ${data.cf}</div>
      </div>`;
  }
  diagram.innerHTML = diagramHTML;

  // --- CPA Tabs (Concreto / Pictórico / Abstracto) ---
  try {
    const stepContent = document.querySelector('#step-2 .step-content');
    if (stepContent && !document.getElementById('cpa-container')) {
      const tabsHtml = `
        <div class="mb-3 flex gap-2" id="cpa-tabs">
          <button id="tab-concreto" class="cpa-tab active" aria-pressed="true">Concreto</button>
          <button id="tab-pictorico" class="cpa-tab" aria-pressed="false">Pictórico</button>
          <button id="tab-abstracto" class="cpa-tab" aria-pressed="false">Abstracto</button>
        </div>
        <div id="cpa-container" class="min-h-[120px] p-3 bg-white rounded border mt-3" aria-live="polite"></div>
      `;
      stepContent.insertAdjacentHTML('beforeend', tabsHtml);

      // create cpa data (either provided or synthesized)
      const cpa = stepProblem.cpa || synthesizeCPA(stepProblem);
      const container = document.getElementById('cpa-container');

      function setActive(tabId) {
        document.querySelectorAll('.cpa-tab').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        const el = document.getElementById(tabId);
        if (el) { el.classList.add('active'); el.setAttribute('aria-pressed','true'); }
      }
      function showConcrete() { setActive('tab-concreto'); renderConcrete(cpa, stepProblem, container); announce('Mostrando representación concreta.'); }
      function showPictorial(){ setActive('tab-pictorico'); renderPictorial(cpa, stepProblem, container); announce('Mostrando representación pictórica.'); }
      function showAbstract(){ setActive('tab-abstracto'); renderAbstract(cpa, stepProblem, container); announce('Mostrando representación abstracta.'); }

      document.getElementById('tab-concreto').onclick = showConcrete;
      document.getElementById('tab-pictorico').onclick = showPictorial;
      document.getElementById('tab-abstracto').onclick = showAbstract;

      // default view by grade (if available in DOM)
      const grade = Number(document.getElementById('level-title')?.textContent?.[0] || 1);
      if (grade <= 2) showConcrete(); else if (grade <= 4) showPictorial(); else showAbstract();
    }
  } catch(e) { console.error('CPA init error', e); }

  // small entrance animation for the diagram
  try { diagram.classList.remove('step-exit'); diagram.classList.add('step-enter'); setTimeout(()=>diagram.classList.remove('step-enter'),520);}catch(e){}

  const hintContainer = $('#hint-container');
  hintContainer.innerHTML = '';
  if (hint) {
    hintContainer.innerHTML = `
      <button id="hint-btn" class="text-sm font-bold text-blue-600">Necesito una Pista</button>
      <p id="hint-text" class="hidden-view mt-2 p-2 bg-yellow-100 text-yellow-800 rounded-lg">${hint}</p>
    `;
    const hintBtn = $('#hint-btn');
    const hintText = $('#hint-text');
    if (hintBtn && hintText) {
      hintBtn.setAttribute('aria-expanded','false');
      hintBtn.setAttribute('aria-controls','hint-text');
      hintBtn.onclick = () => {
        const open = !hintText.classList.contains('hidden-view');
        if (open) {
          hintText.classList.add('hidden-view');
          hintBtn.setAttribute('aria-expanded','false');
        } else {
          hintText.classList.remove('hidden-view');
          hintBtn.setAttribute('aria-expanded','true');
          hintText.classList.add('step-enter');
          setTimeout(()=>hintText.classList.remove('step-enter'),420);
        }
      };
    }
  }

  setTimeout(() => {
    $('#step-3').classList.remove('hidden-view');
    setupStep3(stepProblem);
  }, 900);
}

function setupStep3(stepProblem) {
  const container = $('#operations-container');
  container.innerHTML = '';
  state.selectedOperation = null;
  $('#calculation-input').value = '';
  $('#feedback-step3').classList.add('opacity-0');
  $('#check-step3-btn').disabled = false;

  ['+', '-', '*', '/'].forEach(op => {
    const btn = document.createElement('button');
    btn.textContent = op;
    btn.className = 'op-btn text-2xl font-bold w-12 h-12 rounded-full border-2 border-gray-300 transition';
    btn.setAttribute('role','button');
    btn.setAttribute('title', `Operación ${op}`);
    btn.setAttribute('aria-pressed','false');
    btn.onclick = () => {
      // use semantic selected class so styles are centralized in CSS
      document.querySelectorAll('.op-btn').forEach(b => { b.classList.remove('bg-selected'); b.setAttribute('aria-pressed','false'); });
      btn.classList.add('bg-selected');
      btn.setAttribute('aria-pressed','true');
      state.selectedOperation = op;
    };
    container.appendChild(btn);
  });
}

function setupStep4(stepProblem) {
  try { avatarStepAnnounce(3, 'start'); } catch(e){}
  $('#full-answer-input').value = '';
  $('#feedback-step4').classList.add('opacity-0');
  $('#check-step4-btn').disabled = false;
  state.logicCorrect = false;

  const logicContainer = $('#logic-check-container');
  logicContainer.innerHTML = `
    <p class="italic text-gray-600">${state.currentProblem.logicCheck || ''}</p>
    <div class="flex gap-4 mt-2">
      <button id="logic-yes" class="logic-btn font-bold py-2 px-4 rounded-lg border-2 border-gray-300">Sí</button>
      <button id="logic-no" class="logic-btn font-bold py-2 px-4 rounded-lg border-2 border-gray-300">No</button>
    </div>
  `;
  $('#logic-yes').onclick = (e) => checkLogic(true, e.currentTarget);
  $('#logic-no').onclick = (e) => checkLogic(false, e.currentTarget);
}

// ---- Validaciones
function validateStep1(stepProblem) {
  let correct = true;
  const keys = Object.keys(stepProblem.labels);
  keys.forEach(key => {
    const slot = document.getElementById(`slot-${key}`);
    const expectedValue = stepProblem.data[key];
    const child = slot.firstChild;
    if (expectedValue === '?') { if (child) correct = false; }
    else if (expectedValue === 'RESULTADO_ANTERIOR') { if (child) correct = false; }
    else { if (!child || child.textContent != expectedValue) correct = false; }
  });
  const feedback = $('#feedback-step1');
  feedback.classList.remove('opacity-0');
  if (correct) {
  feedback.textContent = '¡Datos correctos!'; feedback.style.color = '#10B981';
    $('#check-step1-btn').disabled = true;
  try { avatarStepAnnounce(0, 'correct'); } catch(e){}
    setTimeout(() => { $('#step-2').classList.remove('hidden-view'); setupStep2(stepProblem); }, 1000);
  } else {
  feedback.textContent = 'Datos incorrectos.'; feedback.style.color = '#EF4444';
  try { avatarStepAnnounce(0, 'incorrect'); } catch(e){}
  }
}

function validateStep3(stepProblem) {
  const userAnswer = norm($('#calculation-input').value);
  const correct = (state.selectedOperation === stepProblem.operation && userAnswer === norm(stepProblem.answer));
  const feedback = $('#feedback-step3');
  feedback.classList.remove('opacity-0');

  if (correct) {
  feedback.textContent = '¡Cálculo correcto!'; feedback.style.color = '#10B981';
    $('#check-step3-btn').disabled = true;
  try { avatarStepAnnounce(2, 'correct'); } catch(e){}

    if (state.currentProblem.type === 'DOS_OPERACIONES' && state.currentStep === 0) {
      state.currentStep++;
      const nextStepProblem = JSON.parse(JSON.stringify(state.currentProblem.steps[1]));
      for (const key in nextStepProblem.data) {
        if (nextStepProblem.data[key] === 'RESULTADO_ANTERIOR') nextStepProblem.data[key] = stepProblem.answer;
      }
  // animate transition and update progress
  animateHide($('#step-1'));
  setTimeout(() => { setupStep1(nextStepProblem); updateGameProgress(); }, 520);
    } else {
  animateShow($('#step-4'));
  setTimeout(() => { setupStep4(stepProblem); updateGameProgress(); }, 220);
    }
  } else {
  feedback.textContent = 'Revisa la operación o el resultado.'; feedback.style.color = '#EF4444';
  try { avatarStepAnnounce(2, 'incorrect'); } catch(e){}
  }
}

function checkLogic(isLogical, element) {
  document.querySelectorAll('.logic-btn').forEach(b => b.classList.remove('bg-green-500', 'text-white', 'bg-red-500'));
  if (isLogical) { element.classList.add('bg-green-500', 'text-white'); state.logicCorrect = true; }
  else { element.classList.add('bg-red-500', 'text-white'); state.logicCorrect = false; }
}

function validateStep4(stepProblem) {
  const userAnswer = $('#full-answer-input').value.trim();
  const finalAnswer = state.currentProblem.type === 'DOS_OPERACIONES' ? state.currentProblem.steps[1].answer : state.currentProblem.answer;
  const correct = state.logicCorrect && userAnswer.includes(finalAnswer);

  const feedback = $('#feedback-step4');
  feedback.classList.remove('opacity-0');
  if (correct) {
  feedback.textContent = '¡Problema resuelto!'; feedback.style.color = '#10B981';
  try { avatarStepAnnounce(3, 'correct'); } catch(e){}
    $('#check-step4-btn').disabled = true;

    const finalButtonsContainer = $('#final-buttons-container');
    finalButtonsContainer.innerHTML = `
      <button id="btn-explain" class="font-bold text-white bg-purple-500 hover:bg-purple-600 px-8 py-3 rounded-lg">✨ Explicar Razonamiento</button>
      <button id="btn-choose" class="font-bold text-white bg-green-500 hover:bg-green-600 px-8 py-3 rounded-lg">Elegir Otro Problema →</button>
    `;
  $('#btn-explain').onclick = () => showToast("¡Genial! Identificaste los datos, razonaste con el diagrama, elegiste la operación correcta y escribiste una respuesta completa.", 'success');
    $('#btn-choose').onclick = () => showProblemSelection();
    updateGameProgress(true);
  } else {
  feedback.textContent = 'Revisa tu respuesta o la valoración.'; feedback.style.color = '#EF4444';
  try { avatarStepAnnounce(3, 'incorrect'); } catch(e){}
  }
}

function updateGameProgress(final=false) {
  try {
    const progressEl = document.querySelector('#game-progress .bar');
    if (!progressEl) return;
    const totalSteps = state.currentProblem.type === 'DOS_OPERACIONES' ? 4 : 4; // we render 4 step containers but flow may skip
    const stepIndex = final ? totalSteps : (state.currentStep + 1);
    const pct = Math.min(100, Math.round((stepIndex / totalSteps) * 100));
    progressEl.style.width = pct + '%';
  } catch(e){}
}

// -------- Avatar helper (selector, dialog, persistence) --------
const AV_KEY = 'ap_avatar_v1';
function loadAvatar() {
  try { const v = localStorage.getItem(AV_KEY); if (v) return JSON.parse(v); } catch(e){}
  return { img: null, name: 'Guía' };
}
function saveAvatar(a) { try { localStorage.setItem(AV_KEY, JSON.stringify(a)); } catch(e){} }
function renderAvatar() {
  const avatar = loadAvatar();
  const face = document.getElementById('avatar-face');
  const faceTop = document.getElementById('avatar-face-top');
  // prefer stored image, otherwise fall back to first available AV_IMAGES entry if present
  const fallback = (typeof AV_IMAGES !== 'undefined' && Array.isArray(AV_IMAGES) && AV_IMAGES.length) ? AV_IMAGES[0] : null;
  const imgSrc = (avatar && avatar.img) ? avatar.img : (fallback ? fallback.src : null);
  const title = (avatar && avatar.name) ? avatar.name : (fallback ? fallback.name : 'Guía');
  if (face) {
    if (imgSrc) { face.innerHTML = '<img src="'+imgSrc+'" alt="'+(title||'avatar')+'">'; } else { face.textContent = '🤖'; }
    face.title = title || 'Guía';
  }
  if (faceTop) {
    if (imgSrc) { faceTop.innerHTML = '<img src="'+imgSrc+'" alt="'+(title||'avatar')+'">'; } else { faceTop.textContent = '🤖'; }
    faceTop.title = title || 'Guía';
  }
  // also ensure fixed face (if mounted) is in sync
  try { const fixed = document.getElementById('avatar-face-fixed'); if (fixed) { if (imgSrc) fixed.innerHTML = '<img src="'+imgSrc+'" alt="'+(title||'avatar')+'">'; else fixed.textContent = '🤖'; fixed.title = title || 'Guía'; } } catch(e){}
}
function showAvatarMessage(text, opts={timeout:3000, small:false}){
  const bubble = document.getElementById('avatar-bubble'); if (!bubble) return;
  bubble.classList.remove('visually-hidden');
  // animation / preference
  bubble.classList.add('avatar-reaction');
  bubble.textContent = text; if (opts.small) bubble.classList.add('small'); else bubble.classList.remove('small');
  // tts if enabled
  try {
    const prefs = JSON.parse(localStorage.getItem(AV_PREF_KEY) || '{}');
    if (prefs.voice) {
      try { const ut = new SpeechSynthesisUtterance(text); window.speechSynthesis.speak(ut); } catch(e){}
    }
  } catch(e){}
  // focus animation on avatar face
  try { const f = document.getElementById('avatar-face'); if (f) f.classList.add('avatar-react'); } catch(e){}
  setTimeout(()=>{ try { bubble.classList.remove('avatar-reaction'); bubble.classList.add('visually-hidden'); const f = document.getElementById('avatar-face'); if (f) f.classList.remove('avatar-react'); } catch(e){} }, opts.timeout || 3000);
}
function avatarCelebrate(){ renderAvatar(); showAvatarMessage('¡Buen trabajo! 🎉', {timeout:2200}); }
function avatarEncourage(){ renderAvatar(); showAvatarMessage('Inténtalo de nuevo, tú puedes 💪', {timeout:2600}); }

// Sync fixed avatar face with main avatar and show a message in steps
function syncFixedFace(){
  try {
    const a = loadAvatar();
    const fixed = document.getElementById('avatar-face-fixed');
    if (!fixed) return;
    if (a && a.img) fixed.innerHTML = '<img src="'+a.img+'" alt="'+(a.name||'avatar')+'">'; else fixed.textContent = '🤖';
    fixed.title = a.name || 'Guía';
  } catch(e){}
}

function avatarStepAnnounce(stepIndex, status){
  // status: 'start'|'correct'|'incorrect'|'hint'
  try {
    syncFixedFace();
    if (status === 'start') showAvatarMessage('Vamos con el paso ' + (stepIndex+1) + ' — tú puedes', {timeout:2000, small:true});
    if (status === 'correct') avatarCelebrate();
    if (status === 'incorrect') avatarEncourage();
    if (status === 'hint') showAvatarMessage('Pista: revisa las operaciones', {timeout:2200, small:true});
    // small visual pulse on fixed face
    const f = document.getElementById('avatar-face-fixed'); if (f) { f.classList.add('avatar-react'); setTimeout(()=>f.classList.remove('avatar-react'), 600); }
  } catch(e){}
}

// Quick selector: clicking face toggles a small prompt (emoji picker via prompt for simplicity)
// Open picker modal when avatar clicked
document.addEventListener('click', (e) => {
  try {
    const clicked = e.target;
    // if either avatar element (top or in-game) was clicked, open picker
    if (clicked && (clicked.id === 'avatar-face' || clicked.id === 'avatar-face-top' || (clicked.closest && (clicked.closest('#avatar-face') || clicked.closest('#avatar-face-top'))))) {
      openAvatarPicker();
    }
  } catch (err) {}
});

// Avatar picker implementation using local SVG images
const AV_IMAGES = [
  { id: 'robot', src: 'avatars/avatar_robot.svg', name: 'Robot' },
  { id: 'cat', src: 'avatars/avatar_cat.svg', name: 'Gato' },
  { id: 'unicorn', src: 'avatars/avatar_unicorn.svg', name: 'Unicornio' }
];
function openAvatarPicker(){
  const modal = document.getElementById('avatar-picker'); if (!modal) return;
  const options = document.getElementById('avatar-options'); options.innerHTML = '';
  AV_IMAGES.forEach(img => {
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'avatar-img-btn';
    const imgel = document.createElement('img'); imgel.src = img.src; imgel.alt = img.name; btn.appendChild(imgel);
    btn.dataset.src = img.src; btn.dataset.name = img.name;
    btn.onclick = () => { options.querySelectorAll('.avatar-img-btn').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); };
    options.appendChild(btn);
  });
  // populate prefs
  try {
    const prefs = JSON.parse(localStorage.getItem(AV_PREF_KEY) || '{}');
    document.getElementById('avatar-pref-animate').checked = !!prefs.animate;
    document.getElementById('avatar-pref-voice').checked = !!prefs.voice;
  } catch(e){}
  // preselect current image
  const cur = loadAvatar().img;
  Array.from(options.children).forEach(b => { if (b.dataset.src === cur) b.classList.add('selected'); });
  // make visible even if CSS classes have conflicts by setting inline !important
  // move modal to body to avoid parent stacking/context issues
  try {
    if (modal.parentNode !== document.body) {
      document.body.appendChild(modal);
    }
  } catch(e){}
  modal.classList.remove('hidden-view'); modal.classList.remove('hidden');
  modal.classList.add('modal-visible');
  try {
    modal.style.setProperty('display','flex','important');
    modal.style.setProperty('position','fixed','important');
    modal.style.setProperty('inset','0','important');
    modal.style.setProperty('z-index','99999','important');
    modal.style.setProperty('align-items','center','important');
    modal.style.setProperty('justify-content','center','important');
  } catch(e) {
    modal.style.display = 'flex'; modal.style.position = 'fixed'; modal.style.inset = '0'; modal.style.zIndex = 99999;
  }
  modal.setAttribute('aria-hidden', 'false');
  // wire buttons
  document.getElementById('avatar-cancel').onclick = () => { modal.classList.add('hidden-view'); modal.classList.add('hidden'); };
  document.getElementById('avatar-close').onclick = () => {
    const sel = options.querySelector('.avatar-img-btn.selected');
    if (sel) {
      const next = { img: sel.dataset.src, name: sel.dataset.name };
      saveAvatar(next); renderAvatar(); showAvatarMessage('¡Hola! Soy ' + (next.name||'tu guía'), {timeout:1800});
    }
    // save prefs
    try {
      const prefs = { animate: !!document.getElementById('avatar-pref-animate').checked, voice: !!document.getElementById('avatar-pref-voice').checked };
      localStorage.setItem(AV_PREF_KEY, JSON.stringify(prefs));
    } catch(e){}
    modal.classList.add('hidden-view'); modal.classList.add('hidden'); modal.classList.remove('modal-visible');
    try { modal.style.setProperty('display','none','important'); } catch(e) { modal.style.display = 'none'; }
    modal.setAttribute('aria-hidden','true');
  };
  // ensure cancel/close hide fully
  document.getElementById('avatar-cancel').addEventListener('click', () => { modal.classList.add('hidden-view'); modal.classList.add('hidden'); modal.classList.remove('modal-visible'); try { modal.style.setProperty('display','none','important'); } catch(e) { modal.style.display = 'none'; } modal.setAttribute('aria-hidden','true'); });
  document.getElementById('avatar-close').addEventListener('click', () => { modal.classList.add('hidden-view'); modal.classList.add('hidden'); modal.classList.remove('modal-visible'); try { modal.style.setProperty('display','none','important'); } catch(e) { modal.style.display = 'none'; } modal.setAttribute('aria-hidden','true'); });
  // close on escape
  const escHandler = (ev) => { if (ev.key === 'Escape') { modal.classList.add('hidden-view'); modal.classList.add('hidden'); modal.classList.remove('modal-visible'); try { modal.style.setProperty('display','none','important'); } catch(e) { modal.style.display = 'none'; } modal.setAttribute('aria-hidden','true'); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  // click outside to close
  modal.addEventListener('click', (ev) => { if (ev.target === modal) { modal.classList.add('hidden-view'); modal.classList.add('hidden'); modal.classList.remove('modal-visible'); modal.style.display = 'none'; modal.setAttribute('aria-hidden','true'); } });
  // keyboard: allow arrow navigation and Enter to select
  options.querySelectorAll('.avatar-img-btn').forEach((b, i, arr) => {
    b.tabIndex = 0;
    b.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { b.click(); }
      if (ev.key === 'ArrowRight') { const next = arr[(i+1)%arr.length]; next && next.focus(); }
      if (ev.key === 'ArrowLeft') { const prev = arr[(i-1+arr.length)%arr.length]; prev && prev.focus(); }
    });
  });
}

// Hook avatar reactions into key validation points
const origValidateStep1 = validateStep1;
function validateStep1_withAvatar(stepProblem){
  const res = origValidateStep1(stepProblem);
  // if feedback shows correct (green) -> celebrate, else encourage
  const fb = document.getElementById('feedback-step1'); if (fb && fb.textContent) {
    if (fb.textContent.toLowerCase().includes('correct')) avatarCelebrate();
    else if (fb.textContent.toLowerCase().includes('incorrect')) avatarEncourage();
  }
  return res;
}
// Replace usage points: many callers call validateStep1 directly; patch references where used
validateStep1 = validateStep1_withAvatar;

// patch validateStep3/4 reactions by wrapping them
const origValidateStep3 = validateStep3;
function validateStep3_withAvatar(stepProblem){
  const res = origValidateStep3(stepProblem);
  const fb = document.getElementById('feedback-step3'); if (fb && fb.textContent) {
    if (fb.textContent.toLowerCase().includes('correct')) avatarCelebrate(); else avatarEncourage();
  }
  return res;
}
validateStep3 = validateStep3_withAvatar;

const origValidateStep4 = validateStep4;
function validateStep4_withAvatar(stepProblem){
  const res = origValidateStep4(stepProblem);
  const fb = document.getElementById('feedback-step4'); if (fb && fb.textContent) {
    if (fb.textContent.toLowerCase().includes('resuelto') || fb.textContent.toLowerCase().includes('¡problema resuelto')) avatarCelebrate(); else avatarEncourage();
  }
  return res;
}
validateStep4 = validateStep4_withAvatar;

// ensure avatar is rendered on startup
function wireAvatarUI(){
  try {
    const face = document.getElementById('avatar-face');
    const faceTop = document.getElementById('avatar-face-top');
    const faceFixed = document.getElementById('avatar-face-fixed');
    [face, faceTop].forEach(el => {
      if (!el) return;
      el.addEventListener('click', (ev) => { ev.stopPropagation(); try { openAvatarPicker(); } catch(e){} });
      el.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); try { openAvatarPicker(); } catch(e){} } });
      // make sure the element is focusable
      el.tabIndex = el.tabIndex || 0;
    });
    if (faceFixed) {
      faceFixed.addEventListener('click', (ev) => { ev.stopPropagation(); try { openAvatarPicker(); } catch(e){} });
      faceFixed.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); try { openAvatarPicker(); } catch(e){} } });
      faceFixed.tabIndex = faceFixed.tabIndex || 0;
    }
  } catch(e){}
}

function initAvatar(){ try { renderAvatar(); wireAvatarUI(); } catch(e){} }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAvatar); else initAvatar();

// Delegated handlers as fallback if direct handlers are not firing
document.addEventListener('click', function delegatedAvatarClick(e){
  try {
    const faceFixed = e.target.closest && e.target.closest('#avatar-face-fixed');
    if (faceFixed) {
      console.log('delegated click on avatar-face-fixed');
      try { openAvatarPicker(); } catch(err) { console.error(err); }
    }
  } catch(err){}
});
document.addEventListener('keydown', function delegatedAvatarKey(e){
  try {
    if (e.key === 'Enter' || e.key === ' ') {
      const activeClosest = document.activeElement && document.activeElement.closest && document.activeElement.closest('#avatar-face-fixed');
      if (activeClosest) { e.preventDefault(); console.log('delegated key activate avatar-face-fixed'); try { openAvatarPicker(); } catch(err){} }
    }
  } catch(err){}
});

// -------- Editor --------
function renderEditor() {
  const modal = $('#add-problem-modal');
  modal.addEventListener('click', (e) => { if (e.target === modal) hideAddProblemForm(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideAddProblemForm(); });

  const addBtn = $('#btn-add-manual');
  if (addBtn) addBtn.onclick = () => showAddProblemForm();
  const btnExport = $('#btn-export-json');
  const btnImport = $('#btn-import-json');
  const fileInput = $('#import-file-input');
  const btnExportGrade = $('#export-grade-selector');
  const importPreviewModal = $('#import-preview-modal');
  const importPreviewContent = $('#import-preview-content');
  const importConfirm = $('#import-confirm');
  const importCancel = $('#import-cancel');
  const importReplace = $('#import-replace');
  const importMerge = $('#import-merge');
  if (btnExport) btnExport.onclick = () => exportProblems();
  if (btnImport) btnImport.onclick = () => fileInput.click();
  if (fileInput) fileInput.onchange = (e) => { if (e.target.files && e.target.files[0]) readFileForPreview(e.target.files[0]); };
  const btnImportPreview = $('#btn-import-preview');
  if (btnImportPreview) btnImportPreview.onclick = () => {
    // Trigger file chooser which will call readFileForPreview via onchange
    if (fileInput) fileInput.click();
    else importPreviewModal.classList.remove('hidden-view');
  };
  if (btnExportGrade) btnExportGrade.addEventListener('change', () => {});
  if (importCancel) importCancel.onclick = () => { importPreviewModal.classList.add('hidden-view'); };

  // readFileForPreview is now global (see below)
  $('#grade-selector').addEventListener('change', (e) => fetchProblemsForEditor(e.target.value));

  fetchProblemsForEditor($('#grade-selector').value);
  // Ensure export/import toolbar exists (for cases where HTML doesn't include the controls)
  ensureExportImportToolbar();

  // Wire backups UI if present
  const btnShowBackups = $('#btn-show-backups');
  const btnRevertLast = $('#btn-revert-last-import');
  const btnUndoAction = $('#btn-undo-action');
  const backupsClose = $('#backups-close');
  if (btnShowBackups) btnShowBackups.onclick = () => showBackupsModal();
  if (btnRevertLast) btnRevertLast.onclick = () => {
    if (confirm('¿Revertir la última importación y restaurar el backup más reciente?')) revertLastImport();
  };
  if (btnUndoAction) btnUndoAction.onclick = () => undoLastAction();
  if (backupsClose) backupsClose.onclick = () => { const m = $('#backups-modal'); if (m) { m.classList.remove('modal-visible'); setTimeout(()=>{ m.classList.add('hidden'); m.classList.add('hidden-view'); }, 320); } };
}

// --- IA: Generar problema con Gemini vía API Vercel ---
function ensureAiModal() {
  if (document.getElementById('ai-modal')?.firstChild) return;
  const modal = document.getElementById('ai-modal');
  if (!modal) return;
  modal.innerHTML = `
    <div class="card rounded-2xl shadow-2xl p-6 w-full max-w-xl">
      <h3 class="text-xl font-bold mb-3">Generar Problema con IA</h3>
      <div class="grid gap-3 mb-3">
        <label class="text-sm">Curso
          <select id="ai-grade" class="w-full p-2 border rounded">
            <option value="1">1º</option><option value="2">2º</option><option value="3">3º</option>
            <option value="4">4º</option><option value="5">5º</option><option value="6">6º</option>
          </select>
        </label>
        <label class="text-sm">Tipo de problema
          <select id="ai-type" class="w-full p-2 border rounded">
            <option value="PPT">Parte-Parte-Total</option>
            <option value="UVT">Unidad-Veces-Total</option>
            <option value="COMPARACION">Comparación</option>
            <option value="CAMBIO">Cambio</option>
            <option value="DOS_OPERACIONES">Dos Operaciones</option>
          </select>
        </label>
        <label class="text-sm">Cantidad (1-10)
          <input id="ai-count" type="number" min="1" max="10" value="1" class="w-full p-2 border rounded" />
        </label>
        <label class="text-sm">Tema (opcional)
          <input id="ai-theme" class="w-full p-2 border rounded" placeholder="Ej: frutas, tienda, excursión"/>
        </label>
      </div>
  <div id="ai-status" class="text-sm text-gray-600 mb-2"></div>
  <div class="text-xs text-gray-500 mb-2">Endpoint: <span id="ai-endpoint-view"></span> <button id="ai-config-api" class="ml-2 underline text-blue-600">Configurar</button></div>
      <div class="flex justify-end gap-2">
        <button id="ai-cancel" class="py-2 px-4 rounded border">Cancelar</button>
        <button id="ai-generate" class="py-2 px-4 rounded bg-purple-600 text-white">Generar uno</button>
        <button id="ai-generate-batch" class="py-2 px-4 rounded bg-indigo-600 text-white">Generar lote</button>
      </div>
    </div>`;
}

function openAiModal() {
  ensureAiModal();
  const modal = document.getElementById('ai-modal');
  if (!modal) return;
  modal.classList.remove('hidden', 'hidden-view');
  void modal.offsetWidth; modal.classList.add('modal-visible');
  const cancel = document.getElementById('ai-cancel');
  cancel.onclick = () => { modal.classList.remove('modal-visible'); setTimeout(()=>{ modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 260); };
  modal.addEventListener('click', (e) => { if (e.target === modal) cancel.click(); });
  const btnOne = document.getElementById('ai-generate');
  const btnBatch = document.getElementById('ai-generate-batch');
  btnOne.onclick = () => doAiGenerate(false);
  btnBatch.onclick = () => doAiGenerate(true);
  // show current endpoint and allow configuring
  const view = document.getElementById('ai-endpoint-view');
  if (view) view.textContent = (getApiBase() || window.location.origin) + '/api/generate-problem';
  const cfg = document.getElementById('ai-config-api');
  if (cfg) cfg.onclick = () => {
    const cur = getApiBase();
    const next = prompt('Introduce la URL base del backend (Vercel):\nEj: https://tu-app.vercel.app', cur || '');
    if (next != null) { setApiBase(next.trim()); showToast('Endpoint actualizado', 'success'); if (view) view.textContent = (getApiBase() || window.location.origin) + '/api/generate-problem'; }
  };
}

function wireAiGenerator() {
  const btn = document.getElementById('btn-ai-generate');
  if (!btn) return;
  btn.addEventListener('click', () => openAiModal());
}

async function doAiGenerate(asBatch) {
  const grade = Number(document.getElementById('ai-grade').value || 1);
  const type = document.getElementById('ai-type').value || 'PPT';
  const theme = (document.getElementById('ai-theme').value || '').trim();
  const count = Math.max(1, Math.min(10, Number(document.getElementById('ai-count').value || (asBatch ? 5 : 1))));
  const status = document.getElementById('ai-status');
  status.textContent = 'Generando… Por favor espera.';
  try {
    const base = getApiBase();
    const url = (base ? base : '') + '/api/generate-problem';
    // Helpful hint if running on GitHub Pages without configured API
    if (!base && /github\.io$/i.test(window.location.hostname)) {
      showToast('Configura el endpoint (Vercel) antes de generar con IA.', 'warn');
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, type, theme, count })
    });
    if (!res.ok) {
      let detail = '';
      try { const ej = await res.json(); detail = ej && ej.error ? String(ej.error) : ''; } catch(_) { /* ignore */ }
      const msg = detail ? `Error de generación (${res.status}): ${detail}` : `Error de generación (${res.status})`;
      throw new Error(msg);
    }
    const data = await res.json();
    const problems = Array.isArray(data.problems) ? data.problems : (data.problem ? [data.problem] : []);
    if (!problems.length) throw new Error('Respuesta IA incompleta');

    if (asBatch) {
      const incoming = problems.map(p => ({ id: p.id || rid(), ...p, grade: Number(p.grade), createdAt: p.createdAt || Date.now() }));
      const existingIds = new Set(state.problems.map(pr => pr.id));
      incoming.forEach(pr => { if (existingIds.has(pr.id)) pr.id = rid(); state.problems.push(pr); });
      saveProblems(state.problems);
      if (!document.getElementById('editor-view').classList.contains('hidden-view')) {
        fetchProblemsForEditor(document.getElementById('grade-selector').value);
      }
      status.textContent = '';
      const modal = document.getElementById('ai-modal'); if (modal) { modal.classList.remove('modal-visible'); setTimeout(()=>{ modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 260); }
      showToast(`Se añadieron ${incoming.length} problemas generados.`, 'success');
      return;
    }

    const p = problems[0];
    editingProblemId = null;
    showAddProblemForm();
    const form = document.getElementById('add-problem-form');
    if (!form) return;
    const gradeEl = form.querySelector('[name="grade"]'); if (gradeEl) gradeEl.value = String(p.grade || grade);
    const qEl = form.querySelector('[name="question"]'); if (qEl) qEl.value = p.question || '';
    const typeSel = form.querySelector('[name="type"]');
    typeSel.value = p.type || type;
    renderFormFields();
    if (p.type === 'DOS_OPERACIONES' && Array.isArray(p.steps)) {
      const s1 = p.steps[0] || {};
      const s2 = p.steps[1] || {};
      form.querySelector('[name="step1_type"]').value = s1.type || 'PPT';
      form.querySelector('[name="step1_operation"]').value = s1.operation || '+';
      form.querySelector('[name="step1_answer"]').value = s1.answer ?? '';
      form.querySelector('[name="step1_label1"]').value = (s1.labels && (s1.labels.p1||s1.labels.u||s1.labels.cm||s1.labels.ci)) || 'Dato 1';
      form.querySelector('[name="step1_label2"]').value = (s1.labels && (s1.labels.p2||s1.labels.v||s1.labels.cmen||s1.labels.c)) || 'Dato 2';
      form.querySelector('[name="step1_labelT"]').value = (s1.labels && (s1.labels.t||s1.labels.d||s1.labels.cf)) || 'Total';
      form.querySelector('[name="step2_type"]').value = s2.type || 'PPT';
      form.querySelector('[name="step2_operation"]').value = s2.operation || '+';
      form.querySelector('[name="step2_answer"]').value = s2.answer ?? '';
      form.querySelector('[name="step2_label1"]').value = (s2.labels && (s2.labels.p1||s2.labels.u||s2.labels.cm||s2.labels.ci)) || 'Dato 1';
      form.querySelector('[name="step2_label2"]').value = (s2.labels && (s2.labels.p2||s2.labels.v||s2.labels.cmen||s2.labels.c)) || 'Dato 2';
      form.querySelector('[name="step2_labelT"]').value = (s2.labels && (s2.labels.t||s2.labels.d||s2.labels.cf)) || 'Total';
      const mapVals = (stype, data, prefix) => {
        if (!data) return;
        if (stype === 'PPT') { form.querySelector(`[name="${prefix}_data1"]`).value = data.p1 ?? ''; form.querySelector(`[name="${prefix}_data2"]`).value = data.p2 ?? ''; form.querySelector(`[name="${prefix}_dataT"]`).value = data.t ?? ''; }
        else if (stype === 'UVT') { form.querySelector(`[name="${prefix}_data1"]`).value = data.u ?? ''; form.querySelector(`[name="${prefix}_data2"]`).value = data.v ?? ''; form.querySelector(`[name="${prefix}_dataT"]`).value = data.t ?? ''; }
        else if (stype === 'COMPARACION') { form.querySelector(`[name="${prefix}_data1"]`).value = data.cm ?? ''; form.querySelector(`[name="${prefix}_data2"]`).value = data.cmen ?? ''; form.querySelector(`[name="${prefix}_dataT"]`).value = data.d ?? ''; }
        else if (stype === 'CAMBIO') { form.querySelector(`[name="${prefix}_data1"]`).value = data.ci ?? ''; form.querySelector(`[name="${prefix}_data2"]`).value = data.c ?? ''; form.querySelector(`[name="${prefix}_dataT"]`).value = data.cf ?? ''; }
      };
      mapVals(s1.type, s1.data, 'step1');
      mapVals(s2.type, s2.data, 'step2');
      form.querySelector('[name="fullAnswer"]').value = p.fullAnswer || '';
      form.querySelector('[name="logicCheck"]').value = p.logicCheck || '¿La respuesta es lógica?';
    } else {
      const labels = p.labels || {};
      const data = p.data || {};
      form.querySelector('[name="operation"]').value = p.operation || '+';
      form.querySelector('[name="answer"]').value = p.answer ?? '';
      form.querySelector('[name="fullAnswer"]').value = p.fullAnswer || '';
      form.querySelector('[name="logicCheck"]').value = p.logicCheck || '¿La respuesta es lógica?';
      form.querySelector('[name="label1"]').value = labels.p1 || labels.u || labels.cm || labels.ci || 'Dato 1';
      form.querySelector('[name="label2"]').value = labels.p2 || labels.v || labels.cmen || labels.c || 'Dato 2';
      form.querySelector('[name="labelT"]').value = labels.t || labels.d || labels.cf || 'Total';
      if (p.type === 'PPT') { form.querySelector('[name="data1"]').value = data.p1 ?? ''; form.querySelector('[name="data2"]').value = data.p2 ?? ''; form.querySelector('[name="dataT"]').value = data.t ?? ''; }
      else if (p.type === 'UVT') { form.querySelector('[name="data1"]').value = data.u ?? ''; form.querySelector('[name="data2"]').value = data.v ?? ''; form.querySelector('[name="dataT"]').value = data.t ?? ''; }
      else if (p.type === 'COMPARACION') { form.querySelector('[name="data1"]').value = data.cm ?? ''; form.querySelector('[name="data2"]').value = data.cmen ?? ''; form.querySelector('[name="dataT"]').value = data.d ?? ''; }
      else if (p.type === 'CAMBIO') { form.querySelector('[name="data1"]').value = data.ci ?? ''; form.querySelector('[name="data2"]').value = data.c ?? ''; form.querySelector('[name="dataT"]').value = data.cf ?? ''; }
    }
    const modal = document.getElementById('ai-modal');
    if (modal) { modal.classList.remove('modal-visible'); setTimeout(()=>{ modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 260); }
    showToast('Problema generado. Revisa y guarda.', 'success');
  } catch (err) {
    console.error(err);
  status.innerHTML = `<span class="text-red-600">${err.message || 'Fallo generando problema'}</span>`;
  showToast(err.message || 'Fallo generando problema', 'error', 6000);
  }
}

// Read a file and show a tabular import preview. Kept global so injected toolbar handlers work.
function readFileForPreview(file) {
  const importPreviewModal = document.getElementById('import-preview-modal');
  const importPreviewContent = document.getElementById('import-preview-content');
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      _lastImportParsed = Array.isArray(parsed) ? parsed : [];
      renderImportPreview(_lastImportParsed);
      // show modal with animation
      importPreviewModal.classList.remove('hidden');
      importPreviewModal.classList.remove('hidden-view');
      void importPreviewModal.offsetWidth;
      importPreviewModal.classList.add('modal-visible');
    } catch (err) { showToast('JSON inválido: ' + err.message, 'error'); }
  };
  reader.onerror = () => showToast('Error leyendo fichero', 'error');
  reader.readAsText(file);
}

// Render a selectable table inside the import preview modal
function renderImportPreview(parsed) {
  const container = document.getElementById('import-preview-content');
  if (!container) return;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    container.innerHTML = '<p class="italic text-gray-600">No se encontraron entradas válidas en el JSON.</p>';
    return;
  }
  _lastImportParsed = parsed;
  // Build UI: search + table
  let html = `
    <div class="mb-3 flex items-center gap-3">
      <input id="import-search" placeholder="Buscar por enunciado o tipo..." class="p-2 border rounded flex-1" />
      <div class="text-sm text-gray-600">Mostrando <span id="import-count">${parsed.length}</span></div>
      <div id="import-pager-controls" class="ml-2 flex items-center gap-2">
        <button id="import-prev" class="p-1 border rounded">◀</button>
        <span id="import-page">1</span>
        <button id="import-next" class="p-1 border rounded">▶</button>
        <select id="import-page-size" class="p-1 border rounded">
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100" selected>100</option>
          <option value="250">250</option>
        </select>
      </div>
      <button id="btn-view-errors" class="ml-2 p-2 border rounded text-sm">Ver errores</button>
    </div>
  `;
  html += '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">';
  html += '<thead><tr class="bg-gray-100"><th class="p-2 text-left"><input id="import-select-all" type="checkbox"></th><th class="p-2 text-left">#</th><th class="p-2 text-left">Curso</th><th class="p-2 text-left">Tipo</th><th class="p-2 text-left">Enunciado</th></tr></thead>';
  html += '<tbody id="import-rows">';
  parsed.forEach((p, idx) => {
    const q = (p.question || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const errs = validateProblemObj(p);
    const hasErr = errs && errs.length > 0;
    const errorHtml = hasErr ? `<div class="text-xs text-red-600 mt-1">${errs.map(e=>`<div>- ${e}</div>`).join('')}</div>` : '';
    const disabledAttr = hasErr ? 'disabled' : '';
    const rowClass = `border-b import-row ${hasErr? 'opacity-60':''}`;
    html += `<tr class="${rowClass}" data-idx="${idx}"><td class="p-2"><input class="import-row-select" data-idx="${idx}" type="checkbox" checked ${disabledAttr}></td><td class="p-2">${idx+1}</td><td class="p-2">${p.grade ?? ''}</td><td class="p-2">${p.type ?? ''}</td><td class="p-2"><div><span class="import-preview-q">${q}</span> <span class="row-expand" data-idx="${idx}">ver más</span>${errorHtml}</div></td></tr>`;
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Update counts: total / valid / invalid
  const total = parsed.length;
  const invalidCount = parsed.reduce((acc,p) => acc + (validateProblemObj(p).length ? 1 : 0), 0);
  const validCount = total - invalidCount;
  const topSummary = container.querySelector('.mb-3');
  if (topSummary) {
    const summary = topSummary.querySelector('#import-count');
    if (summary) summary.textContent = String(validCount);
    const badge = document.createElement('div'); badge.className = 'text-sm text-red-600 ml-2'; badge.textContent = ` ( válidos: ${validCount}, inválidos: ${invalidCount} )`;
    topSummary.appendChild(badge);
  }

  // Pager controls
  const selectAll = document.getElementById('import-select-all');
  const search = document.getElementById('import-search');
  const rowsContainer = document.getElementById('import-rows');
  const countEl = document.getElementById('import-count');
  const prevBtn = document.getElementById('import-prev');
  const nextBtn = document.getElementById('import-next');
  const pageSpan = document.getElementById('import-page');
  const pageSizeSel = document.getElementById('import-page-size');

  function getVisibleRowElements() {
    return Array.from(rowsContainer.querySelectorAll('.import-row')).filter(r => r.style.display !== 'none');
  }

  function renderPage() {
    const page = _importPreviewPageState.page || 1;
    const pageSize = _importPreviewPageState.pageSize || Number(pageSizeSel.value) || 100;
    const allRows = Array.from(rowsContainer.querySelectorAll('.import-row'));
    const filteredRows = allRows.filter(r => r.style.display !== 'none');
    const totalVisible = filteredRows.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    allRows.forEach(r => r.style.display = 'none');
    filteredRows.forEach((r, i) => { if (i >= start && i < end) r.style.display = ''; });
    pageSpan.textContent = String(page);
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = end >= totalVisible;
    countEl.textContent = String(totalVisible);
  }

  // Make select-all operate across all pages (global select) and keep indeterminate state
  selectAll.title = 'Seleccionar todo (todas las páginas)';
  function updateSelectAllState() {
    const allCbs = Array.from(rowsContainer.querySelectorAll('.import-row-select')).filter(cb => !cb.disabled);
    if (!allCbs.length) { selectAll.checked = false; selectAll.indeterminate = false; return; }
    const checked = allCbs.filter(cb => cb.checked).length;
    selectAll.checked = checked === allCbs.length;
    selectAll.indeterminate = checked > 0 && checked < allCbs.length;
  }
  selectAll.addEventListener('change', (e) => {
    const allCbs = Array.from(rowsContainer.querySelectorAll('.import-row-select'));
    allCbs.forEach(cb => { if (!cb.disabled) cb.checked = e.target.checked; });
    // keep UI consistent
    updateSelectAllState();
  });
  // delegate changes from individual checkboxes to update select-all state
  rowsContainer.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t && t.classList && t.classList.contains('import-row-select')) updateSelectAllState();
  });

  // Filter and then render page
  const doFilter = () => {
    const q = (search.value || '').toLowerCase().trim();
    const rows = Array.from(rowsContainer.querySelectorAll('.import-row'));
    rows.forEach(r => {
      const idx = Number(r.getAttribute('data-idx'));
      const item = parsed[idx];
      const hay = `${item.question || ''} ${item.type || ''}`.toLowerCase();
      const ok = q === '' || hay.indexOf(q) !== -1;
      r.style.display = ok ? '' : 'none';
    });
    _importPreviewPageState.page = 1;
    renderPage();
  };
  search.addEventListener('input', doFilter);

  // Wire expand rows
  rowsContainer.querySelectorAll('.row-expand').forEach(exp => {
    exp.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.getAttribute('data-idx'));
      const item = parsed[idx];
      const row = rowsContainer.querySelector(`.import-row[data-idx="${idx}"]`);
      if (!row) return;
      let next = row.nextElementSibling;
      if (row.classList.contains('expanded')) {
        if (next && next.classList && next.classList.contains('import-expanded')) next.remove();
        row.classList.remove('expanded');
        return;
      }
      rowsContainer.querySelectorAll('.import-expanded').forEach(n => n.remove());
      rowsContainer.querySelectorAll('.import-row.expanded').forEach(r => r.classList.remove('expanded'));
      const tr = document.createElement('tr'); tr.className = 'import-expanded';
      const td = document.createElement('td'); td.colSpan = 5; td.className = 'p-3 bg-gray-50 text-gray-700';
      td.innerHTML = `<div><strong>Enunciado:</strong><div class="mt-2">${(item.question||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div></div>`;
      tr.appendChild(td);
      row.after(tr);
      row.classList.add('expanded');
    });
  });

  // Wire import buttons
  const importReplace = document.getElementById('import-replace');
  const importMerge = document.getElementById('import-merge');
  const importCancel = document.getElementById('import-cancel');
  importCancel.onclick = () => {
    const modal = document.getElementById('import-preview-modal');
    modal.classList.remove('modal-visible');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 320);
  };
  const doImport = (mode) => {
    const checks = Array.from(document.querySelectorAll('.import-row-select'));
    const selected = checks.filter(cb => cb.checked && !cb.disabled).map(cb => parsed[Number(cb.getAttribute('data-idx'))]);
    if (!selected.length) { showToast('No hay entradas seleccionadas para importar.', 'info'); return; }
    const modal = document.getElementById('import-preview-modal');
    modal.classList.remove('modal-visible');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 320);
    importParsed(selected, mode);
    _lastImportParsed = null;
  };
  if (importReplace) importReplace.onclick = () => doImport('replace');
  if (importMerge) importMerge.onclick = () => doImport('merge');

  // pager wiring
  pageSizeSel.addEventListener('change', () => { _importPreviewPageState.pageSize = Number(pageSizeSel.value) || 100; _importPreviewPageState.page = 1; renderPage(); });
  prevBtn.addEventListener('click', () => { if (_importPreviewPageState.page > 1) { _importPreviewPageState.page -= 1; renderPage(); } });
  nextBtn.addEventListener('click', () => { _importPreviewPageState.page += 1; renderPage(); });

  // initial render
  _importPreviewPageState.page = 1; _importPreviewPageState.pageSize = Number(pageSizeSel.value) || 100; renderPage();
  // ensure select-all reflects current state
  updateSelectAllState();

  // Wire 'Ver errores'
  const btnViewErrors = document.getElementById('btn-view-errors');
  if (btnViewErrors) btnViewErrors.onclick = () => renderImportErrors(parsed);
}

// Suggest fixes for common issues and apply them to a parsed array
function suggestFixes(parsed) {
  const suggestions = parsed.map((p, idx) => {
    const fixes = [];
    if (p.grade && typeof p.grade === 'string' && /^\d+$/.test(p.grade.trim())) {
      fixes.push({ field: 'grade', from: p.grade, to: Number(p.grade.trim()) });
    }
    if ((p.type === 'SIMPLE' || !p.type) && (p.answer === undefined || p.answer === null || String(p.answer).trim() === '')) {
      fixes.push({ field: 'answer', from: p.answer, to: '?' });
    }
    if (p.type && typeof p.type === 'string') {
      const t = p.type.toUpperCase().trim();
      if (t === 'SIMPLE' && p.type !== 'SIMPLE') fixes.push({ field: 'type', from: p.type, to: 'SIMPLE' });
      if (t === 'DOS_OPERACIONES' && p.type !== 'DOS_OPERACIONES') fixes.push({ field: 'type', from: p.type, to: 'DOS_OPERACIONES' });
    }
    return { index: idx, fixes };
  });
  return suggestions.filter(s => s.fixes && s.fixes.length > 0);
}

function applySuggestedFixes(parsed, suggestions, selectedIdxs) {
  const clone = JSON.parse(JSON.stringify(parsed));
  suggestions.forEach(s => {
    if (selectedIdxs && selectedIdxs.length && !selectedIdxs.includes(s.index)) return;
    const target = clone[s.index];
    if (!target) return;
    s.fixes.forEach(f => { target[f.field] = f.to; });
  });
  return clone;
}

// Render detailed errors modal
function renderImportErrors(parsed) {
  const modal = document.getElementById('import-errors-modal');
  const content = document.getElementById('import-errors-content');
  const filter = document.getElementById('errors-filter');
  const exportBtn = document.getElementById('errors-export');
  if (!modal || !content) return;

  // Build errors list
  const perRow = parsed.map((p, idx) => ({ idx, errors: validateProblemObj(p) }));
  const onlyInvalid = perRow.filter(r => r.errors && r.errors.length);
  if (!onlyInvalid.length) {
    content.innerHTML = '<p class="italic text-gray-600">No se han detectado errores en las entradas.</p>';
  } else {
    // collect distinct error messages
    const allErrs = new Set();
    onlyInvalid.forEach(r => r.errors.forEach(e => allErrs.add(e)));
    const errArray = Array.from(allErrs);
    // populate filter
    filter.innerHTML = '<option value="all">Todos los errores</option>' + errArray.map((e,i)=>`<option value="${i}">${e}</option>`).join('');

    // build suggestion-aware list: for each invalid row, compute suggestions and show a checkbox
    const suggestions = suggestFixes(parsed);
    const suggestionsByIndex = {};
    suggestions.forEach(s => suggestionsByIndex[s.index] = s.fixes);

    let html = '<ul class="space-y-2">';
    onlyInvalid.forEach(r => {
      const sug = suggestionsByIndex[r.idx] || [];
      const sugHtml = sug.length ? `<div class="mt-2 text-sm text-green-700">Sugerencias:<ul class="ml-4 list-disc">${sug.map(f=>`<li>${f.field}: ${String(f.from)} → ${String(f.to)}</li>`).join('')}</ul></div>` : '';
      const checkboxHtml = sug.length ? `<label class="inline-flex items-center gap-2"><input type="checkbox" class="apply-suggestion-checkbox" data-idx="${r.idx}" checked> Aplicar</label>` : '';
      html += `<li class="p-2 border rounded">
        <div class="flex justify-between items-center">
          <div><strong>Fila ${r.idx+1}</strong> ${checkboxHtml}</div>
          <div><button class="btn-jump px-2 py-1 text-sm border rounded" data-idx="${r.idx}">Ir a fila</button></div>
        </div>
        <div class="mt-2 text-sm text-red-600">${r.errors.map(er=>`<div>- ${er}</div>`).join('')}</div>
        ${sugHtml}
      </li>`;
    });
    html += '</ul>';
    content.innerHTML = html;

    // wire jump buttons
    content.querySelectorAll('.btn-jump').forEach(b => b.onclick = (e) => {
      const idx = Number(e.currentTarget.getAttribute('data-idx'));
      // ensure preview modal is open and expand the row
      const previewModal = document.getElementById('import-preview-modal');
      if (previewModal && previewModal.classList.contains('hidden')) {
        previewModal.classList.remove('hidden'); previewModal.classList.remove('hidden-view'); void previewModal.offsetWidth; previewModal.classList.add('modal-visible');
      }
      // find row and expand
      const rows = document.querySelectorAll('.import-row');
      const row = document.querySelector(`.import-row[data-idx="${idx}"]`);
      if (row) {
        // scroll into view
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // trigger expand click
        const exp = row.querySelector('.row-expand'); if (exp) exp.click();
      }
    });

    // wire filter
    filter.onchange = () => {
      const val = filter.value;
      const items = onlyInvalid.filter(r => {
        if (val === 'all') return true;
        const idx = Number(val);
        return r.errors.includes(errArray[idx]);
      });
      let html2 = '<ul class="space-y-2">';
      items.forEach(r => { html2 += `<li class="p-2 border rounded"><div class="flex justify-between items-center"><div><strong>Fila ${r.idx+1}</strong></div><div><button class="btn-jump px-2 py-1 text-sm border rounded" data-idx="${r.idx}">Ir a fila</button></div></div><div class="mt-2 text-sm text-red-600">${r.errors.map(er=>`<div>- ${er}</div>`).join('')}</div></li>`; });
      html2 += '</ul>';
      content.innerHTML = html2;
      content.querySelectorAll('.btn-jump').forEach(b => b.onclick = (e) => { const idx = Number(e.currentTarget.getAttribute('data-idx')); const row = document.querySelector(`.import-row[data-idx="${idx}"]`); if (row) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); const exp = row.querySelector('.row-expand'); if (exp) exp.click(); } });
    };

    exportBtn.onclick = () => {
      // export only invalid rows with their errors
      const payload = onlyInvalid.map(r => ({ index: r.idx, errors: r.errors, entry: parsed[r.idx] }));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `import_errors_${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    };
  }

  // open modal
  modal.classList.remove('hidden'); modal.classList.remove('hidden-view'); void modal.offsetWidth; modal.classList.add('modal-visible');
  // wire close
  const closeBtn = document.getElementById('import-errors-close'); if (closeBtn) closeBtn.onclick = () => { modal.classList.remove('modal-visible'); setTimeout(()=>{ modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 320); };
  const applyBtn = document.getElementById('import-errors-apply');
  if (applyBtn) {
    applyBtn.onclick = () => {
      const suggestions = suggestFixes(parsed);
      if (!suggestions.length) { showToast('No hay sugerencias automáticas disponibles.', 'info'); return; }
      // Confirm applying all suggestions
      if (!confirm(`Se han detectado ${suggestions.length} entradas con sugerencias. ¿Aplicar todas las correcciones sugeridas?`)) return;
      // create backup before changes
      try {
        const snap = localStorage.getItem(LS_KEY);
        const key = `${LS_KEY}_backup_${new Date().toISOString()}`;
        localStorage.setItem(key, snap || JSON.stringify([]));
        const idxRaw = localStorage.getItem(`${LS_KEY}_backups_index`);
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        idx.unshift({ key, at: new Date().toISOString() });
        localStorage.setItem(`${LS_KEY}_backups_index`, JSON.stringify(idx.slice(0,20)));
        pushUndo({ type: 'import', payload: { backupKey: key } });
      } catch (e) { /* ignore */ }
      const fixed = applySuggestedFixes(parsed, suggestions, []);
      // apply fixes to last parsed and re-render preview/errors
      _lastImportParsed = fixed;
      renderImportPreview(fixed);
      renderImportErrors(fixed);
      showToast('Correcciones aplicadas (previsualización). Revisa y luego importa.', 'success');
    };
  }
  // Wire apply-selected button
  const applySelectedBtn = document.getElementById('import-errors-apply-selected');
  if (applySelectedBtn) {
    applySelectedBtn.onclick = () => {
      // collect checked suggestion indexes
      const checks = Array.from(content.querySelectorAll('.apply-suggestion-checkbox'));
      const selected = checks.filter(cb => cb.checked).map(cb => Number(cb.getAttribute('data-idx')));
      if (!selected.length) { showToast('No hay sugerencias seleccionadas.', 'info'); return; }
      // build suggestions list and filter to selected
      const allSuggestions = suggestFixes(parsed);
      const filtered = allSuggestions.filter(s => selected.includes(s.index));
      if (!filtered.length) { showToast('No hay sugerencias aplicables a las filas seleccionadas.', 'info'); return; }
      if (!confirm(`Aplicar sugerencias a ${filtered.length} filas seleccionadas?`)) return;
      // create backup
      try {
        const snap = localStorage.getItem(LS_KEY);
        const key = `${LS_KEY}_backup_${new Date().toISOString()}`;
        localStorage.setItem(key, snap || JSON.stringify([]));
        const idxRaw = localStorage.getItem(`${LS_KEY}_backups_index`);
        const idx = idxRaw ? JSON.parse(idxRaw) : [];
        idx.unshift({ key, at: new Date().toISOString() });
        localStorage.setItem(`${LS_KEY}_backups_index`, JSON.stringify(idx.slice(0,20)));
        pushUndo({ type: 'import', payload: { backupKey: key } });
      } catch (e) { /* ignore */ }
      const fixed = applySuggestedFixes(parsed, allSuggestions, selected);
      _lastImportParsed = fixed;
      renderImportPreview(fixed);
      renderImportErrors(fixed);
      showToast('Sugerencias aplicadas (previsualización). Revisa y luego importa.', 'success');
    };
  }
}

// Ensure export/import toolbar exists (creates and wires controls if missing)
function ensureExportImportToolbar() {
  if ($('#btn-export-json')) return; // already present
  const editorCard = document.querySelector('#editor-view .card');
  if (!editorCard) return;
  const toolbarHTML = `
    <div id="injected-export-import" class="mt-4 mb-4">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select id="export-grade-selector" class="p-2 border rounded">
          <option value="all">Exportar: Todos</option>
          <option value="1">Exportar: 1º</option>
          <option value="2">Exportar: 2º</option>
          <option value="3">Exportar: 3º</option>
          <option value="4">Exportar: 4º</option>
          <option value="5">Exportar: 5º</option>
          <option value="6">Exportar: 6º</option>
        </select>
        <button id="btn-export-json" class="font-bold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">Exportar JSON</button>
        <button id="btn-export-selected" class="font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded">Exportar seleccionados</button>
        <button id="btn-import-json" class="font-bold text-white bg-gray-700 hover:bg-gray-800 px-4 py-2 rounded">Importar JSON</button>
        <input type="file" id="import-file-input" accept=".json,application/json" class="hidden" />
      </div>
    </div>
  `;
  const modal = document.getElementById('add-problem-modal');
  editorCard.insertAdjacentHTML('beforebegin', toolbarHTML);

  // Wire handlers for injected controls
  const btnExport = document.getElementById('btn-export-json');
  const btnExportSelected = document.getElementById('btn-export-selected');
  const btnImport = document.getElementById('btn-import-json');
  const fileInput = document.getElementById('import-file-input');
  const exportGrade = document.getElementById('export-grade-selector');
  if (btnExport) btnExport.onclick = () => exportProblems();
  if (btnExportSelected) btnExportSelected.onclick = () => exportSelectedProblems();
  if (btnImport && fileInput) { btnImport.onclick = () => fileInput.click(); fileInput.onchange = (e) => { if (e.target.files && e.target.files[0]) readFileForPreview(e.target.files[0]); }; }
}


function exportSelectedProblems() {
  const checked = Array.from(document.querySelectorAll('.problem-select:checked'));
  if (!checked.length) { showToast('No hay problemas seleccionados para exportar.', 'info'); return; }
  const ids = checked.map(cb => cb.getAttribute('data-id'));
  const sel = state.problems.filter(p => ids.includes(p.id));
  const filename = `problems_selected_${new Date().toISOString().slice(0,10)}.json`;
  const data = JSON.stringify(sel, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Export problems as a JSON file download (current state.problems)
function exportProblems() {
  try {
  const gradeSel = $('#export-grade-selector') ? $('#export-grade-selector').value : 'all';
  let problemsToExport = state.problems;
  if (gradeSel && gradeSel !== 'all') problemsToExport = state.problems.filter(p => String(p.grade) === String(gradeSel));
  const data = JSON.stringify(problemsToExport, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `problems_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) { showToast('Error al exportar: ' + err.message, 'error'); }
}

// Import problems from a JSON file. Validates basic shape and asks to merge/replace.
// importParsed(parsed, mode)
// - parsed: array of problem objects parsed from a JSON file
// - mode: 'replace' to replace the current bank, 'merge' to append (avoids id collisions)
//
// Debug hooks: to temporarily re-enable import tracing, add console.info lines near the
// start of this function and inside the save block. Keep them only while diagnosing.
function importParsed(parsed, mode = 'replace') {
  if (!Array.isArray(parsed)) { showToast('JSON inválido: se esperaba un array de problemas.', 'error'); return; }

  const validTypes = new Set(['PPT','UVT','COMPARACION','CAMBIO','DOS_OPERACIONES']);
  const validOps = new Set(['+','-','*','/']);

  const validateStep = (s) => {
    if (!s || typeof s !== 'object') return 'Paso inválido (debe ser objeto).';
    if (!s.type || !validTypes.has(s.type)) return 'Tipo de paso inválido.';
    if (!s.data || typeof s.data !== 'object') return 'Paso sin campo data válido.';
    if (!s.labels || typeof s.labels !== 'object') return 'Paso sin campo labels válido.';
    if (!s.operation || !validOps.has(s.operation)) return 'Operación inválida en paso.';
    if (s.answer == null) return 'Paso sin respuesta.';
    return null;
  };

  const errors = [];
  parsed.forEach((p, idx) => {
    if (!p || typeof p !== 'object') { errors.push(`Entrada ${idx}: no es un objeto`); return; }
    if (!p.question || typeof p.question !== 'string') errors.push(`Entrada ${idx}: falta question (string).`);
    if (p.grade == null || Number.isNaN(Number(p.grade))) errors.push(`Entrada ${idx}: grade inválido.`);
    if (!p.type || !validTypes.has(p.type)) errors.push(`Entrada ${idx}: type inválido.`);

    if (p.type === 'DOS_OPERACIONES') {
      if (!Array.isArray(p.steps) || p.steps.length !== 2) { errors.push(`Entrada ${idx}: DOS_OPERACIONES debe tener 'steps' como array de 2 pasos.`); return; }
      p.steps.forEach((s, si) => {
        const e = validateStep(s);
        if (e) errors.push(`Entrada ${idx} paso ${si}: ${e}`);
      });
    } else {
      if (!p.data || typeof p.data !== 'object') errors.push(`Entrada ${idx}: falta data válido.`);
      if (!p.labels || typeof p.labels !== 'object') errors.push(`Entrada ${idx}: falta labels válido.`);
      if (!p.operation || !validOps.has(p.operation)) errors.push(`Entrada ${idx}: operación inválida.`);
      if (p.answer == null) errors.push(`Entrada ${idx}: falta answer.`);
    }
  });

  if (errors.length) { showToast('Errores al importar: revisa la consola', 'error', 7000); console.error('Import errors:', errors); return; }

  // create autosnapshot backup before applying changes
  try {
    const snap = localStorage.getItem(LS_KEY);
    const key = `${LS_KEY}_backup_${new Date().toISOString()}`;
    localStorage.setItem(key, snap || JSON.stringify([]));
    // maintain a simple index of backups
    try {
      const idxRaw = localStorage.getItem(`${LS_KEY}_backups_index`);
      const idx = idxRaw ? JSON.parse(idxRaw) : [];
      idx.unshift({ key, at: new Date().toISOString() });
      // keep last 20 backups
      localStorage.setItem(`${LS_KEY}_backups_index`, JSON.stringify(idx.slice(0,20)));
      // push undo action for this import (allow undo restoring this backup)
      pushUndo({ type: 'import', payload: { backupKey: key } });
    } catch(e) {}
  } catch (e) { /* ignore */ }

  if (mode === 'replace') {
    // Replace: normalize grades to numbers and ensure id/createdAt
    state.problems = parsed.map(p => ({ id: p.id || rid(), ...p, grade: Number(p.grade), createdAt: p.createdAt || Date.now() }));
  } else {
    const existingIds = new Set(state.problems.map(p => p.id));
    parsed.forEach(p => {
      const id = p.id || rid();
      const entry = { id, ...p, grade: Number(p.grade), createdAt: p.createdAt || Date.now() };
      if (existingIds.has(id)) entry.id = rid();
      state.problems.push(entry);
    });
  }
  saveProblems(state.problems);
  showToast('Importación completada', 'success');
  // saved to state and localStorage
  try { const raw = localStorage.getItem(LS_KEY); } catch (e) { /* ignore */ }
  // After import, switch grade selector to first imported grade to make problems visible
  try {
    const firstGrade = parsed && parsed.length ? String(Number(parsed[0].grade || parsed[0].grade)) : null;
    if (firstGrade && $('#grade-selector')) { $('#grade-selector').value = firstGrade; }
  } catch (e) { /* ignore */ }
  fetchProblemsForEditor($('#grade-selector').value);
  alert('Importación completada.');
}

// List backups (reads `${LS_KEY}_backups_index`) and render inside modal
function showBackupsModal() {
  const modal = document.getElementById('backups-modal');
  const content = document.getElementById('backups-content');
  try {
    const idxRaw = localStorage.getItem(`${LS_KEY}_backups_index`);
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    if (!idx.length) {
      content.innerHTML = '<p class="italic text-gray-600">No hay backups disponibles.</p>';
    } else {
      let html = '<ul class="space-y-2">';
      idx.forEach((entry, i) => {
        html += `<li class="flex justify-between items-center p-2 border rounded">
          <div class="text-sm">Backup ${i+1} — ${new Date(entry.at).toLocaleString()}</div>
          <div class="flex gap-2">
            <button class="btn-restore py-1 px-3 bg-green-600 text-white rounded" data-key="${entry.key}">Restaurar</button>
            <button class="btn-delete-backup py-1 px-3 bg-red-500 text-white rounded" data-key="${entry.key}">Borrar</button>
          </div>
        </li>`;
      });
      html += '</ul>';
      content.innerHTML = html;
      // wire restore buttons
      content.querySelectorAll('.btn-restore').forEach(b => b.onclick = (e) => {
        const k = e.currentTarget.getAttribute('data-key');
        restoreBackup(k);
        modal.classList.remove('modal-visible');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.add('hidden-view'); }, 320);
      });
      content.querySelectorAll('.btn-delete-backup').forEach(b => b.onclick = (e) => {
        const k = e.currentTarget.getAttribute('data-key');
        try { localStorage.removeItem(k); } catch(e){}
        // remove from index
        try { const idxRaw2 = localStorage.getItem(`${LS_KEY}_backups_index`); const arr = idxRaw2 ? JSON.parse(idxRaw2).filter(x=>x.key!==k) : []; localStorage.setItem(`${LS_KEY}_backups_index`, JSON.stringify(arr)); } catch(e){}
        showBackupsModal();
      });
    }
  } catch (e) { content.innerHTML = '<p class="text-red-600">Error al leer backups.</p>'; }
  modal.classList.remove('hidden'); modal.classList.remove('hidden-view'); void modal.offsetWidth; modal.classList.add('modal-visible');
}

function restoreBackup(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) { showToast('Backup no encontrado', 'error'); return; }
    localStorage.setItem(LS_KEY, raw);
    state.problems = JSON.parse(raw || '[]');
    saveProblems(state.problems);
    showToast('Backup restaurado', 'success');
    fetchProblemsForEditor($('#grade-selector').value);
  } catch (e) { showToast('Error al restaurar backup: ' + e.message, 'error'); }
}

// Revertir la última importación (restaura el primer backup del índice)
function revertLastImport() {
  try {
    const idxRaw = localStorage.getItem(`${LS_KEY}_backups_index`);
    const idx = idxRaw ? JSON.parse(idxRaw) : [];
    if (!idx.length) { showToast('No hay backups para revertir', 'info'); return; }
    const latest = idx[0];
    restoreBackup(latest.key);
    // remove it from the index (we consider revert a consume)
    const arr = idx.slice(1);
    localStorage.setItem(`${LS_KEY}_backups_index`, JSON.stringify(arr));
  } catch (e) { showToast('Error al revertir: ' + e.message, 'error'); }
}

function importProblems(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      // show debug of parsed length
      
      importParsed(parsed);
    } catch (err) { showToast('Error leyendo JSON: ' + err.message, 'error'); }
  };
  reader.onerror = () => showToast('Error al leer el fichero.', 'error');
  reader.readAsText(file);
}


function fetchProblemsForEditor(grade) {
  const container = $('#problem-list-container');
  container.innerHTML = `<p class="text-gray-500">Cargando problemas...</p>`;

  const problems = state.problems.filter(p => p.grade === parseInt(grade));
  if (!problems.length) {
    container.innerHTML = `<p class="text-gray-500 italic">No hay problemas para este curso.</p>`;
    return;
  }

  problems.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  let html = '<ul class="space-y-3">'; 
  problems.forEach((p, i) => { 
    const safeQ = (p.question || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += ` 
  <li class="bg-gray-100 p-3 rounded-lg flex justify-between items-center"> 
    <label class="flex items-center gap-3"> 
      <input type="checkbox" data-id="${p.id}" class="problem-select"> 
      <div id="problem-question-edit-${i}" class="problem-question pr-4">${safeQ}</div>
    </label> 
    <div class="flex items-center gap-2"> 
      <button data-id="${p.id}" class="text-blue-600 hover:text-blue-800 font-bold btn-edit mr-3">Editar</button>
      <button class="view-full-btn text-sm text-blue-600" data-idx="${i}" aria-expanded="false" aria-controls="problem-question-edit-${i}">Ver completo</button>
      <button data-id="${p.id}" class="text-red-500 hover:text-red-700 font-bold btn-delete">Eliminar</button> 
    </div> 
  </li>`; 
  }); 
  container.innerHTML = html + '</ul>'; 

  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.onclick = () => deleteProblem(btn.getAttribute('data-id'), grade);
  });
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => showEditProblemForm(btn.getAttribute('data-id'));
  });
 
  // allow selecting problems for export
  document.querySelectorAll('.problem-select').forEach(cb => cb.addEventListener('change', () => {}));

  // wire view-full buttons to expand/collapse the question text without selecting the row
  container.querySelectorAll('.view-full-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = btn.getAttribute('data-idx');
      const qel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!qel) return;
      const expanded = qel.classList.toggle('expanded');
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.textContent = expanded ? 'Ocultar' : 'Ver completo';
      if (expanded) qel.style.maxHeight = 'none'; else qel.style.maxHeight = '';
    });
  });
}

function deleteProblem(id, grade) {
  if (!confirm("¿Estás seguro?")) return;
  const idx = state.problems.findIndex(p => p.id === id);
  if (idx === -1) return;
  const [removed] = state.problems.splice(idx, 1);
  _lastDeleted = { item: removed, index: idx };
  saveProblems(state.problems);
  fetchProblemsForEditor(grade);
  // push undo action into stack
  pushUndo({ type: 'delete', payload: { item: removed, index: idx } });
  showToastAction('Problema eliminado', 'Deshacer', () => {
    if (!_lastDeleted) return;
    state.problems.splice(_lastDeleted.index, 0, _lastDeleted.item);
    saveProblems(state.problems);
    fetchProblemsForEditor(grade);
    _lastDeleted = null;
    showToast('Restaurado', 'success');
  }, 'info', 7000);
}

function showAddProblemForm() {
  renderProblemForm();
  // Title changes depending on whether we're editing or creating
  $('#add-problem-title').textContent = editingProblemId ? 'Editar Problema' : 'Nuevo Problema Manual';
  const modal = $('#add-problem-modal');
  // Show modal via animation class. Keep hidden classes in place for
  // accessibility/fallback, but toggle a visible class that controls opacity
  // and pointer-events. Focus the first input once visible.
  modal.classList.remove('hidden');
  modal.classList.remove('hidden-view');
  // Force reflow then add visible class to trigger transition
  void modal.offsetWidth;
  modal.classList.add('modal-visible');
  // Focus the first focusable element inside the form after a short timeout
  setTimeout(() => {
    const first = modal.querySelector('input, textarea, select, button');
    if (first) first.focus();
  }, 260);
}
function hideAddProblemForm() {
  // clear editing state when closing the modal
  editingProblemId = null;
  const modal = $('#add-problem-modal');
  // Remove visible class so animation plays, then add hidden classes when
  // transition completes to fully remove from layout.
  modal.classList.remove('modal-visible');
  const onEnd = (e) => {
    if (e && e.target !== modal) return;
    modal.classList.add('hidden-view');
    modal.classList.add('hidden');
    modal.removeEventListener('transitionend', onEnd);
  };
  modal.addEventListener('transitionend', onEnd);
}

function renderProblemForm() {
  const form = $('#add-problem-form');
  form.innerHTML = `
    <div>
      <label class="font-bold">Curso:</label>
      <select name="grade" required class="w-full p-2 border rounded mt-1">
        <option value="1">1º</option><option value="2">2º</option><option value="3">3º</option>
        <option value="4">4º</option><option value="5">5º</option><option value="6">6º</option>
      </select>
    </div>
    <div>
      <label class="font-bold">Enunciado:</label>
      <textarea name="question" required class="w-full p-2 border rounded mt-1" rows="3"></textarea>
    </div>
    <div>
      <label class="font-bold">Tipo:</label>
      <select name="type" id="problem-type-selector" required class="w-full p-2 border rounded mt-1">
        <option value="PPT">Parte-Parte-Total</option>
        <option value="UVT">Unidad-Veces-Total</option>
        <option value="COMPARACION">Comparación</option>
        <option value="CAMBIO">Cambio</option>
        <option value="DOS_OPERACIONES">Dos Operaciones</option>
      </select>
    </div>
    <div id="form-fields-container"></div>
    <div>
      <label class="font-bold">Operación:</label>
      <select name="operation" required class="w-full p-2 border rounded mt-1">
        <option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option>
      </select>
    </div>
    <div>
      <label class="font-bold">Respuesta Numérica:</label>
      <input type="text" name="answer" required class="w-full p-2 border rounded mt-1">
    </div>
    <div>
      <label class="font-bold">Respuesta Completa:</label>
      <input type="text" name="fullAnswer" required class="w-full p-2 border rounded mt-1">
    </div>
    <div>
      <label class="font-bold">Pista (opcional):</label>
      <input type="text" name="hint" class="w-full p-2 border rounded mt-1">
    </div>
    <div>
      <label class="font-bold">Pregunta Lógica:</label>
      <input type="text" name="logicCheck" required class="w-full p-2 border rounded mt-1">
    </div>
    <div class="flex justify-end gap-4 pt-2">
      <button type="button" id="cancel-add" class="font-bold py-2 px-6 rounded-lg">Cancelar</button>
      <button type="submit" class="font-bold text-white bg-blue-500 hover:bg-blue-600 py-2 px-6 rounded-lg">Guardar</button>
    </div>
  `;
  // --- CPA optional fields (insert after base form) ---
  const cpaDetails = document.createElement('details');
  cpaDetails.className = 'mt-2';
  cpaDetails.innerHTML = `
    <summary class="font-bold">Opciones CPA (opcional)</summary>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
      <div>
        <label class="text-sm font-semibold">Icono concreto (emoji)</label>
        <input type="text" name="cpaIcon" placeholder="🍎 / 🔷 / 🧱" class="p-2 border rounded w-full">
      </div>
      <div>
        <label class="text-sm font-semibold">Tema pictórico</label>
        <select name="cpaTheme" class="p-2 border rounded w-full">
          <option value="">(auto)</option>
          <option value="bars">Barras</option>
          <option value="numberline">Línea numérica</option>
        </select>
      </div>
      <div>
        <label class="text-sm font-semibold">Plantilla abstracta</label>
        <input type="text" name="cpaTpl" placeholder="{p1} + {p2} = {t}" class="p-2 border rounded w-full">
      </div>
    </div>
  `;
  // preview and counts editor for single-step CPA
  const previewWrap = document.createElement('div');
  previewWrap.className = 'mt-2';
  previewWrap.innerHTML = `
    <div class="flex gap-2 items-center mt-2">
      <button type="button" id="cpa-preview-concrete" class="px-3 py-1 rounded bg-indigo-600 text-white">Previsualizar (Concreto)</button>
      <button type="button" id="cpa-preview-pictorial" class="px-3 py-1 rounded bg-sky-600 text-white">Previsualizar (Pictórico)</button>
      <button type="button" id="cpa-preview-abstract" class="px-3 py-1 rounded bg-emerald-600 text-white">Previsualizar (Abstracto)</button>
      <button type="button" id="cpa-edit-counts-btn" class="px-3 py-1 rounded border">Editar counts</button>
    </div>
    <div id="cpa-counts-editor" class="mt-2"></div>
    <div id="cpa-preview" class="mt-2 p-2 bg-gray-50 rounded border"></div>
  `;
  form.appendChild(previewWrap);
  form.appendChild(cpaDetails);
  $('#problem-type-selector').addEventListener('change', renderFormFields);
  $('#cancel-add').onclick = () => hideAddProblemForm();
  renderFormFields();

  // wire per-step CPA preview/edit handlers (guard presence)
  setTimeout(() => {
    try {
      const s1Preview = form.querySelector('#step1_cpa_preview');
      const s1Edit = form.querySelector('#step1_cpa_edit_counts');
      const s2Preview = form.querySelector('#step2_cpa_preview');
      const s2Edit = form.querySelector('#step2_cpa_edit_counts');
      if (s1Preview) s1Preview.addEventListener('click', (ev) => {
        const mode = ev && ev.detail && ev.detail.mode; // allow custom mode
        const fd = new FormData(form); const snap = buildCPASnapshot(fd, 'step1'); const mount = form.querySelector('#step1_cpa_counts_editor') || document.getElementById('cpa-preview'); (form.querySelector('#step1_cpa_preview_mount') || mount).innerHTML = '';
        renderConcrete(snap.cpa || synthesizeCPA(snap), snap, mount);
      });
      if (s1Edit) s1Edit.addEventListener('click', () => { const mount = form.querySelector('#step1_cpa_counts_editor'); if (!mount) return; if (mount.innerHTML.trim()) { mount.innerHTML = ''; return; } const fd = new FormData(form); const type = fd.get('step1_type'); generateCountsEditor('step1', type); });
      if (s2Preview) s2Preview.addEventListener('click', (ev) => {
        const fd = new FormData(form); const snap = buildCPASnapshot(fd, 'step2'); const mount = form.querySelector('#step2_cpa_counts_editor') || document.getElementById('cpa-preview'); (form.querySelector('#step2_cpa_preview_mount') || mount).innerHTML = '';
        renderConcrete(snap.cpa || synthesizeCPA(snap), snap, mount);
      });
      if (s2Edit) s2Edit.addEventListener('click', () => { const mount = form.querySelector('#step2_cpa_counts_editor'); if (!mount) return; if (mount.innerHTML.trim()) { mount.innerHTML = ''; return; } const fd = new FormData(form); const type = fd.get('step2_type'); generateCountsEditor('step2', type); });
    } catch(e){}
  }, 80);

  // helper: build snapshot object (step-like) from form values for preview
  function buildCPASnapshot(fd, prefix) {
    // prefix undefined for single-step
    const get = (name) => fd.get(prefix ? (prefix + '_' + name) : name);
    const type = (get('type') || get('step1_type') || get('step2_type') || '').toString() || fd.get('type');
    const stype = prefix ? get('type') || get('step1_type') : fd.get('type');
    // determine keys depending on type
    const keysMap = { 'PPT':['p1','p2','t'], 'UVT':['u','v','t'], 'COMPARACION':['cm','cmen','d'], 'CAMBIO':['ci','c','cf'] };
    const keys = (keysMap[stype] || []);
    const data = {};
    if (prefix) {
      // step-specific names
      const map = { p1: 'data1', p2: 'data2', t: 'dataT', u: 'data1', v: 'data2', cm: 'data1', cmen: 'data2', d: 'dataT', ci: 'data1', c: 'data2', cf: 'dataT' };
      keys.forEach(k => { const val = fd.get(prefix + '_' + (map[k] || 'data1')); if (val != null) data[k] = val; });
      // labels
      const labels = {}; const labelMap = { p1:'label1', p2:'label2', t:'labelT', u:'label1', v:'label2', cm:'label1', cmen:'label2', d:'labelT', ci:'label1', c:'label2', cf:'labelT' };
      keys.forEach(k => { const v = fd.get(prefix + '_' + (labelMap[k] || 'label1')); if (v != null) labels[k] = v; });
      // cpa fields
      const cpaIcon = (fd.get(prefix + '_cpaIcon') || '').trim();
      const cpaTheme = (fd.get(prefix + '_cpaTheme') || '').trim();
      const cpaTpl = (fd.get(prefix + '_cpaTpl') || '').trim();
      // counts overrides
      const items = {};
      keys.forEach(k => {
        const override = fd.get(prefix + '_cpaCount_' + k);
        if (override != null && String(override).trim() !== '') items[k] = { count: Number(String(override).replace(',', '.')), icon: cpaIcon || undefined };
      });
      const cpa = { concrete: Object.keys(items).length ? { items, layout: 'row' } : (cpaIcon ? { items: {}, layout: 'row' } : undefined), pictorial: cpaTheme ? { theme: cpaTheme } : undefined, abstract: cpaTpl ? { template: cpaTpl, hideUnknown: true } : undefined };
      return { type: stype, data, labels, cpa };
    } else {
      // single-step
      const stype2 = fd.get('type');
      const map2 = { p1:'data1', p2:'data2', t:'dataT', u:'data1', v:'data2', cm:'data1', cmen:'data2', d:'dataT', ci:'data1', c:'data2', cf:'dataT' };
      const keys2 = (keysMap[stype2] || []);
      keys2.forEach(k => { const val = fd.get(map2[k]); if (val != null) data[k] = val; });
      const labels = {}; const labelMap2 = { p1:'label1', p2:'label2', t:'labelT', u:'label1', v:'label2', cm:'label1', cmen:'label2', d:'labelT', ci:'label1', c:'label2', cf:'labelT' };
      keys2.forEach(k => { const v = fd.get(labelMap2[k]); if (v != null) labels[k] = v; });
      const cpaIcon = (fd.get('cpaIcon') || '').trim();
      const cpaTheme = (fd.get('cpaTheme') || '').trim();
      const cpaTpl = (fd.get('cpaTpl') || '').trim();
      const items = {};
      keys2.forEach(k => { const override = fd.get('cpaCount_' + k); if (override != null && String(override).trim() !== '') items[k] = { count: Number(String(override).replace(',', '.')), icon: cpaIcon || undefined }; });
      const cpa = { concrete: Object.keys(items).length ? { items, layout: 'row' } : (cpaIcon ? { items: {}, layout: 'row' } : undefined), pictorial: cpaTheme ? { theme: cpaTheme } : undefined, abstract: cpaTpl ? { template: cpaTpl, hideUnknown: true } : undefined };
      return { type: stype2, data, labels, cpa };
    }
  }

  // generate counts editor UI for a given prefix and type
  function generateCountsEditor(prefix, type) {
    const mount = document.getElementById(prefix ? (prefix + '_cpa_counts_editor') : 'cpa-counts-editor');
    if (!mount) return;
    mount.innerHTML = '';
    const keysMap = { 'PPT':['p1','p2','t'], 'UVT':['u','v','t'], 'COMPARACION':['cm','cmen','d'], 'CAMBIO':['ci','c','cf'] };
    const keys = keysMap[type] || [];
    if (!keys.length) { mount.textContent = 'No hay claves para editar counts.'; return; }
    keys.forEach(k => {
      const row = document.createElement('div'); row.className = 'flex items-center gap-2 mb-2';
      const lbl = document.createElement('label'); lbl.textContent = k; lbl.className = 'w-20 font-bold';
      const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.step = '1'; inp.name = (prefix ? (prefix + '_cpaCount_' + k) : ('cpaCount_' + k)); inp.placeholder = 'Ej: 6'; inp.className = 'p-1 border rounded w-24';
      const note = document.createElement('div'); note.className = 'text-sm text-red-600 ml-2'; note.style.minWidth = '160px';
      // validation on input
      inp.addEventListener('input', () => {
        const v = inp.value.trim();
        if (v === '') { note.textContent = ''; inp.dataset.valid = 'false'; return; }
        const n = Number(v);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) { note.textContent = 'Debe ser entero ≥ 0'; inp.dataset.valid = 'false'; } else { note.textContent = ''; inp.dataset.valid = 'true'; }
      });
      row.appendChild(lbl); row.appendChild(inp); row.appendChild(note); mount.appendChild(row);
    });
  }

  // validate template contains required keys
  function validateTemplate(tpl, keys) {
    const missing = [];
    keys.forEach(k => { if (!tpl.includes('{' + k + '}')) missing.push(k); });
    return missing;
  }

  // attach preview and edit-counts handlers
  // wire new multi-layer preview buttons
  const btnConcrete = document.getElementById('cpa-preview-concrete');
  const btnPict = document.getElementById('cpa-preview-pictorial');
  const btnAbstract = document.getElementById('cpa-preview-abstract');
  if (btnConcrete) btnConcrete.addEventListener('click', () => {
    const fd = new FormData(form); const snap = buildCPASnapshot(fd, null); const mount = document.getElementById('cpa-preview'); mount.innerHTML = ''; renderConcrete(snap.cpa || synthesizeCPA(snap), snap, mount);
  });
  if (btnPict) btnPict.addEventListener('click', () => {
    const fd = new FormData(form); const snap = buildCPASnapshot(fd, null); const mount = document.getElementById('cpa-preview'); mount.innerHTML = ''; renderPictorial(snap.cpa || synthesizeCPA(snap), snap, mount);
  });
  if (btnAbstract) btnAbstract.addEventListener('click', () => {
    const fd = new FormData(form); const snap = buildCPASnapshot(fd, null); const mount = document.getElementById('cpa-preview'); mount.innerHTML = '';
    const keysMap = { 'PPT':['p1','p2','t'], 'UVT':['u','v','t'], 'COMPARACION':['cm','cmen','d'], 'CAMBIO':['ci','c','cf'] };
    const keys = keysMap[snap.type] || [];
    const tpl = (snap.cpa && snap.cpa.abstract && snap.cpa.abstract.template) ? snap.cpa.abstract.template : '';
    if (!tpl) {
      mount.textContent = 'No hay plantilla abstracta configurada. Use el editor para añadir `cpaTpl`.'; return;
    }
    const missing = validateTemplate(tpl, keys);
    if (missing.length) { mount.innerHTML = '<div class="text-red-600">Plantilla incompleta. Faltan: ' + missing.join(', ') + '</div>'; return; }
    renderAbstract(snap.cpa || synthesizeCPA(snap), snap, mount);
  });
  document.getElementById('cpa-edit-counts-btn').addEventListener('click', () => {
    const fd = new FormData(form);
    const type = fd.get('type');
    // reuse the mount
    const mount = document.getElementById('cpa-counts-editor');
    if (mount.innerHTML.trim()) { mount.innerHTML = ''; return; }
    generateCountsEditor(null, type);
  });

  // If editing, prefill values
  if (editingProblemId) {
    const existing = state.problems.find(p => p.id === editingProblemId);
    if (existing) {
      const gradeEl = form.querySelector('[name="grade"]'); if (gradeEl) gradeEl.value = String(existing.grade || '1');
      const qEl = form.querySelector('[name="question"]'); if (qEl) qEl.value = existing.question || '';
      const typeEl = form.querySelector('[name="type"]'); if (typeEl) typeEl.value = existing.type || 'PPT';
      const opEl = form.querySelector('[name="operation"]'); if (opEl) opEl.value = existing.operation || '+';
      const ansEl = form.querySelector('[name="answer"]'); if (ansEl) ansEl.value = existing.answer ?? '';
      const fullEl = form.querySelector('[name="fullAnswer"]'); if (fullEl) fullEl.value = existing.fullAnswer || '';
      const hintEl = form.querySelector('[name="hint"]'); if (hintEl) hintEl.value = existing.hint || '';
      const logicEl = form.querySelector('[name="logicCheck"]'); if (logicEl) logicEl.value = existing.logicCheck || '';
      // If DOS_OPERACIONES, set up fields in renderFormFields and fill steps
      if (existing.type === 'DOS_OPERACIONES' && existing.steps && existing.steps.length === 2) {
        // set type and re-render fields
        const sel = form.querySelector('#problem-type-selector'); if (sel) sel.value = 'DOS_OPERACIONES'; renderFormFields();
        // populate step1 and step2 fields via names used in renderFormFields (guard each)
        try {
          const s1 = existing.steps[0]; const s2 = existing.steps[1];
          const s1_type = form.querySelector('[name="step1_type"]'); if (s1_type) s1_type.value = s1.type || 'PPT';
          const s1_d1 = form.querySelector('[name="step1_data1"]'); if (s1_d1) s1_d1.value = s1.data ? (s1.data.p1||s1.data.u||s1.data.cm||s1.data.ci||'') : '';
          const s1_d2 = form.querySelector('[name="step1_data2"]'); if (s1_d2) s1_d2.value = s1.data ? (s1.data.p2||s1.data.v||s1.data.cmen||s1.data.c||'') : '';
          const s1_dT = form.querySelector('[name="step1_dataT"]'); if (s1_dT) s1_dT.value = s1.data ? (s1.data.t||s1.data.d||s1.data.cf||'') : '';
          const s1_l1 = form.querySelector('[name="step1_label1"]'); if (s1_l1) s1_l1.value = s1.labels ? (s1.labels.p1||s1.labels.u||s1.labels.cm||s1.labels.ci||'') : '';
          const s1_l2 = form.querySelector('[name="step1_label2"]'); if (s1_l2) s1_l2.value = s1.labels ? (s1.labels.p2||s1.labels.v||s1.labels.cmen||s1.labels.c||'') : '';
          const s1_lT = form.querySelector('[name="step1_labelT"]'); if (s1_lT) s1_lT.value = s1.labels ? (s1.labels.t||s1.labels.d||s1.labels.cf||'') : '';
          const s1_op = form.querySelector('[name="step1_operation"]'); if (s1_op) s1_op.value = s1.operation || '+';
          const s1_ans = form.querySelector('[name="step1_answer"]'); if (s1_ans) s1_ans.value = s1.answer ?? '';
          const s1_hint = form.querySelector('[name="step1_hint"]'); if (s1_hint) s1_hint.value = s1.hint || '';
          // prefill per-step CPA if present
          const s1_cpaIcon = form.querySelector('[name="step1_cpaIcon"]'); if (s1_cpaIcon) s1_cpaIcon.value = s1.cpa && s1.cpa.concrete && Object.values(s1.cpa.concrete.items || {})[0] ? (Object.values(s1.cpa.concrete.items || {})[0].icon || '') : (s1.cpa && s1.cpa.concrete && s1.cpa.concrete.items && Object.keys(s1.cpa.concrete.items)[0] ? '' : '');
          const s1_cpaTheme = form.querySelector('[name="step1_cpaTheme"]'); if (s1_cpaTheme) s1_cpaTheme.value = s1.cpa && s1.cpa.pictorial ? (s1.cpa.pictorial.theme || '') : '';
          const s1_cpaTpl = form.querySelector('[name="step1_cpaTpl"]'); if (s1_cpaTpl) s1_cpaTpl.value = s1.cpa && s1.cpa.abstract ? (s1.cpa.abstract.template || '') : '';

          const s2_type = form.querySelector('[name="step2_type"]'); if (s2_type) s2_type.value = s2.type || 'PPT';
          const s2_d1 = form.querySelector('[name="step2_data1"]'); if (s2_d1) s2_d1.value = s2.data ? (s2.data.p1||s2.data.u||s2.data.cm||s2.data.ci||'') : '';
          const s2_d2 = form.querySelector('[name="step2_data2"]'); if (s2_d2) s2_d2.value = s2.data ? (s2.data.p2||s2.data.v||s2.data.cmen||s2.data.c||'') : '';
          const s2_dT = form.querySelector('[name="step2_dataT"]'); if (s2_dT) s2_dT.value = s2.data ? (s2.data.t||s2.data.d||s2.data.cf||'') : '';
          const s2_l1 = form.querySelector('[name="step2_label1"]'); if (s2_l1) s2_l1.value = s2.labels ? (s2.labels.p1||s2.labels.u||s2.labels.cm||s2.labels.ci||'') : '';
          const s2_l2 = form.querySelector('[name="step2_label2"]'); if (s2_l2) s2_l2.value = s2.labels ? (s2.labels.p2||s2.labels.v||s2.labels.cmen||s2.labels.c||'') : '';
          const s2_lT = form.querySelector('[name="step2_labelT"]'); if (s2_lT) s2_lT.value = s2.labels ? (s2.labels.t||s2.labels.d||s2.labels.cf||'') : '';
          const s2_op = form.querySelector('[name="step2_operation"]'); if (s2_op) s2_op.value = s2.operation || '+';
          const s2_ans = form.querySelector('[name="step2_answer"]'); if (s2_ans) s2_ans.value = s2.answer ?? '';
          const s2_hint = form.querySelector('[name="step2_hint"]'); if (s2_hint) s2_hint.value = s2.hint || '';
            const s2_cpaIcon = form.querySelector('[name="step2_cpaIcon"]'); if (s2_cpaIcon) s2_cpaIcon.value = s2.cpa && s2.cpa.concrete && Object.values(s2.cpa.concrete.items || {})[0] ? (Object.values(s2.cpa.concrete.items || {})[0].icon || '') : '';
            const s2_cpaTheme = form.querySelector('[name="step2_cpaTheme"]'); if (s2_cpaTheme) s2_cpaTheme.value = s2.cpa && s2.cpa.pictorial ? (s2.cpa.pictorial.theme || '') : '';
            const s2_cpaTpl = form.querySelector('[name="step2_cpaTpl"]'); if (s2_cpaTpl) s2_cpaTpl.value = s2.cpa && s2.cpa.abstract ? (s2.cpa.abstract.template || '') : '';
        } catch (e) { /* best effort */ }
      }
    }
  }

  // Adjust submit button text depending on editing state
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.textContent = editingProblemId ? 'Guardar cambios' : 'Guardar';

  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const type = fd.get('type');

    if (editingProblemId && type !== 'DOS_OPERACIONES') {
      // fall through to edit single-step problem
    }

    if (type === 'DOS_OPERACIONES') {
      // Helper to build a step from prefixed form fields (step1_, step2_)
      const buildStep = (prefix) => {
        const stype = fd.get(prefix + '_type');
        const d1 = fd.get(prefix + '_data1');
        const d2 = fd.get(prefix + '_data2');
        const dT = fd.get(prefix + '_dataT');
        const l1 = fd.get(prefix + '_label1');
        const l2 = fd.get(prefix + '_label2');
        const lT = fd.get(prefix + '_labelT');
    // CPA per-step optional fields
    const cpaIcon = (fd.get(prefix + '_cpaIcon') || '').trim();
    const cpaTheme = (fd.get(prefix + '_cpaTheme') || '').trim();
    const cpaTpl = (fd.get(prefix + '_cpaTpl') || '').trim();
        const operation = fd.get(prefix + '_operation');
        const answer = fd.get(prefix + '_answer');
        const hint = fd.get(prefix + '_hint');

  let data = {}, labels = {};
  if (stype === 'PPT') { data = { p1: d1, p2: d2, t: dT }; labels = { p1: l1, p2: l2, t: lT }; }
        else if (stype === 'UVT') { data = { u: d1, v: d2, t: dT }; labels = { u: l1, v: l2, t: lT }; }
        else if (stype === 'COMPARACION') { data = { cm: d1, cmen: d2, d: dT }; labels = { cm: l1, cmen: l2, d: lT }; }
        else if (stype === 'CAMBIO') { data = { ci: d1, c: d2, cf: dT }; labels = { ci: l1, c: l2, cf: lT }; }

        // build cpa if provided
        let cpa = undefined;
        if (cpaIcon || cpaTheme || cpaTpl) {
          cpa = { concrete: cpaIcon ? { items: {}, layout: 'row' } : undefined, pictorial: cpaTheme ? { theme: cpaTheme } : undefined, abstract: cpaTpl ? { template: cpaTpl, hideUnknown: true } : undefined };
          const assignCount = (key, val) => { const n = Number(String(val).replace(',', '.')); if (!Number.isFinite(n) || n < 0) return; cpa.concrete = cpa.concrete || { items:{}, layout:'row' }; cpa.concrete.items[key] = { count: n, icon: cpaIcon || '🔷' }; };
          Object.entries(data || {}).forEach(([k,v]) => { if (v && v !== '?' && v !== 'RESULTADO_ANTERIOR') assignCount(k, v); });
        }

        return { type: stype, data, labels, operation, answer, hint, cpa };
      };

      const step1 = buildStep('step1');
      const step2 = buildStep('step2');

      const newProblem = {
        id: rid(),
        grade: parseInt(fd.get('grade')),
        question: fd.get('question'),
        type: 'DOS_OPERACIONES',
        steps: [step1, step2],
        fullAnswer: fd.get('fullAnswer'),
        hint: fd.get('hint'),
        logicCheck: fd.get('logicCheck'),
        createdAt: Date.now()
      };
      if (editingProblemId) {
        // replace existing
        const idx = state.problems.findIndex(p => p.id === editingProblemId);
        if (idx !== -1) { state.problems[idx] = { id: editingProblemId, ...newProblem, createdAt: state.problems[idx].createdAt || Date.now() }; }
        editingProblemId = null;
      } else {
        newProblem.id = rid();
        state.problems.push(newProblem);
      }
      saveProblems(state.problems);
      hideAddProblemForm();
      fetchProblemsForEditor(newProblem.grade);
      return;
    }

    // collect CPA optional fields (single-step problem)
    const cpaIcon = (fd.get('cpaIcon') || '').trim();
    const cpaTheme = (fd.get('cpaTheme') || '').trim();
    const cpaTpl = (fd.get('cpaTpl') || '').trim();
    let cpa = undefined;
    if (cpaIcon || cpaTheme || cpaTpl) {
      cpa = { concrete: cpaIcon ? { items: {}, layout: 'row' } : undefined, pictorial: cpaTheme ? { theme: cpaTheme } : undefined, abstract: cpaTpl ? { template: cpaTpl, hideUnknown: true } : undefined };
      // populate counts if present in data
      const assignCount = (key, val) => {
        const n = Number(String(val).replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return;
        cpa.concrete = cpa.concrete || { items: {}, layout: 'row' };
        cpa.concrete.items[key] = { count: n, icon: cpaIcon || '🔷' };
      };
      Object.entries(newProblem.data || {}).forEach(([k,v]) => { if (v && v !== '?' && v !== 'RESULTADO_ANTERIOR') assignCount(k, v); });
    }

    let data = {}, labels = {};
    if (type === 'PPT') { data = { p1: fd.get('data1'), p2: fd.get('data2'), t: fd.get('dataT') }; labels = { p1: fd.get('label1'), p2: fd.get('label2'), t: fd.get('labelT') }; }
    else if (type === 'UVT') { data = { u: fd.get('data1'), v: fd.get('data2'), t: fd.get('dataT') }; labels = { u: fd.get('label1'), v: fd.get('label2'), t: fd.get('labelT') }; }
    else if (type === 'COMPARACION') { data = { cm: fd.get('data1'), cmen: fd.get('data2'), d: fd.get('dataT') }; labels = { cm: fd.get('label1'), cmen: fd.get('label2'), d: fd.get('labelT') }; }
    else if (type === 'CAMBIO') { data = { ci: fd.get('data1'), c: fd.get('data2'), cf: fd.get('dataT') }; labels = { ci: fd.get('label1'), c: fd.get('label2'), cf: fd.get('labelT') }; }

    const newProblem = {
      grade: parseInt(fd.get('grade')),
      question: fd.get('question'),
      type, data, labels,
      operation: fd.get('operation'),
      answer: fd.get('answer'),
      fullAnswer: fd.get('fullAnswer'),
      hint: fd.get('hint'),
      logicCheck: fd.get('logicCheck')
    ,
    cpa // may be undefined; synthesizeCPA will be used at render time
  };

    if (editingProblemId) {
      const idx = state.problems.findIndex(p => p.id === editingProblemId);
      if (idx !== -1) {
        state.problems[idx] = { id: editingProblemId, ...newProblem, createdAt: state.problems[idx].createdAt || Date.now() };
      }
      editingProblemId = null;
    } else {
      state.problems.push({ id: rid(), ...newProblem, createdAt: Date.now() });
    }
    saveProblems(state.problems);
    hideAddProblemForm();
    fetchProblemsForEditor($('#grade-selector').value);
  };
}

function showEditProblemForm(id) {
  const p = state.problems.find(x => x.id === id);
  if (!p) { showToast('Problema no encontrado', 'error'); return; }
  editingProblemId = id;
  showAddProblemForm();
}

function renderFormFields() {
  const type = $('#problem-type-selector').value;
  const container = $('#form-fields-container');

  if (type === 'DOS_OPERACIONES') {
    container.innerHTML = `
      <div class="space-y-4">
        <p class="text-sm text-gray-600">Define los dos pasos del problema. Para usar el resultado del primer paso en el segundo, escribe <code>RESULTADO_ANTERIOR</code> en el campo correspondiente.</p>

        <fieldset class="p-3 border rounded">
          <legend class="font-bold">Paso 1</legend>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <select name="step1_type" required class="p-2 border rounded">
              <option value="PPT">Parte-Parte-Total</option>
              <option value="UVT">Unidad-Veces-Total</option>
              <option value="COMPARACION">Comparación</option>
              <option value="CAMBIO">Cambio</option>
            </select>
            <input type="text" name="step1_data1" placeholder="Dato 1" required class="p-2 border rounded">
            <input type="text" name="step1_data2" placeholder="Dato 2" required class="p-2 border rounded">
            <input type="text" name="step1_dataT" placeholder="Total / '?'" required class="p-2 border rounded md:col-span-1">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <input type="text" name="step1_label1" placeholder="Etiqueta Dato 1" required class="p-2 border rounded">
            <input type="text" name="step1_label2" placeholder="Etiqueta Dato 2" required class="p-2 border rounded">
            <input type="text" name="step1_labelT" placeholder="Etiqueta Total" required class="p-2 border rounded">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <select name="step1_operation" required class="p-2 border rounded">
              <option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option>
            </select>
            <input type="text" name="step1_answer" placeholder="Respuesta numérica" required class="p-2 border rounded">
            <input type="text" name="step1_hint" placeholder="Pista (opcional)" class="p-2 border rounded">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <input type="text" name="step1_cpaIcon" placeholder="Icono (emoji) opcional" class="p-2 border rounded" />
            <select name="step1_cpaTheme" class="p-2 border rounded"><option value="">(auto)</option><option value="bars">Barras</option><option value="numberline">Línea numérica</option></select>
            <input type="text" name="step1_cpaTpl" placeholder="Plantilla abstracta opcional" class="p-2 border rounded" />
          </div>
          <div class="flex gap-2 mt-2 items-center">
            <button type="button" id="step1_cpa_preview" class="px-3 py-1 rounded bg-indigo-600 text-white">Previsualizar paso 1</button>
            <button type="button" id="step1_cpa_edit_counts" class="px-3 py-1 rounded border">Editar counts paso 1</button>
            <div id="step1_cpa_counts_editor" class="ml-4 w-full"></div>
          </div>
        </fieldset>

        <fieldset class="p-3 border rounded">
          <legend class="font-bold">Paso 2</legend>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <select name="step2_type" required class="p-2 border rounded">
              <option value="PPT">Parte-Parte-Total</option>
              <option value="UVT">Unidad-Veces-Total</option>
              <option value="COMPARACION">Comparación</option>
              <option value="CAMBIO">Cambio</option>
            </select>
            <input type="text" name="step2_data1" placeholder="Dato 1 (usa RESULTADO_ANTERIOR si aplica)" required class="p-2 border rounded">
            <input type="text" name="step2_data2" placeholder="Dato 2" required class="p-2 border rounded">
            <input type="text" name="step2_dataT" placeholder="Total / '?'" required class="p-2 border rounded md:col-span-1">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <input type="text" name="step2_label1" placeholder="Etiqueta Dato 1" required class="p-2 border rounded">
            <input type="text" name="step2_label2" placeholder="Etiqueta Dato 2" required class="p-2 border rounded">
            <input type="text" name="step2_labelT" placeholder="Etiqueta Total" required class="p-2 border rounded">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <select name="step2_operation" required class="p-2 border rounded">
              <option value="+">+</option><option value="-">-</option><option value="*">*</option><option value="/">/</option>
            </select>
            <input type="text" name="step2_answer" placeholder="Respuesta numérica final" required class="p-2 border rounded">
            <input type="text" name="step2_hint" placeholder="Pista (opcional)" class="p-2 border rounded">
          </div>
          <div class="grid md:grid-cols-3 gap-2 mt-2">
            <input type="text" name="step2_cpaIcon" placeholder="Icono (emoji) opcional" class="p-2 border rounded" />
            <select name="step2_cpaTheme" class="p-2 border rounded"><option value="">(auto)</option><option value="bars">Barras</option><option value="numberline">Línea numérica</option></select>
            <input type="text" name="step2_cpaTpl" placeholder="Plantilla abstracta opcional" class="p-2 border rounded" />
          </div>
          <div class="flex gap-2 mt-2 items-center">
            <button type="button" id="step2_cpa_preview" class="px-3 py-1 rounded bg-indigo-600 text-white">Previsualizar paso 2</button>
            <button type="button" id="step2_cpa_edit_counts" class="px-3 py-1 rounded border">Editar counts paso 2</button>
            <div id="step2_cpa_counts_editor" class="ml-4 w-full"></div>
          </div>
  </fieldset>

  <div>
          <label class="font-bold">Respuesta Completa Final:</label>
          <input type="text" name="fullAnswer" required class="w-full p-2 border rounded mt-1">
  </div>

  <div>
          <label class="font-bold">Pregunta Lógica Final:</label>
          <input type="text" name="logicCheck" required class="w-full p-2 border rounded mt-1">
        </div>
 
      </div>
    `;

    // Disable global single-step inputs to avoid confusion
    const globOp = document.querySelector('select[name="operation"]');
    const globAns = document.querySelector('input[name="answer"]');
    if (globOp) { globOp.disabled = true; globOp.classList.add('opacity-50', 'cursor-not-allowed'); }
    if (globAns) { globAns.disabled = true; globAns.classList.add('opacity-50', 'cursor-not-allowed'); }

    return;
  }

  let labels = { data1: 'Dato 1', data2: 'Dato 2', dataT: 'Total' };
  if (type === 'COMPARACION') labels = { data1: 'Cant. Mayor', data2: 'Cant. Menor', dataT: 'Diferencia' };
  if (type === 'CAMBIO') labels = { data1: 'Cant. Inicial', data2: 'Cambio', dataT: 'Cant. Final' };
  if (type === 'UVT') labels = { data1: 'Unidad', data2: 'Veces', dataT: 'Total' };
  if (type === 'PPT') labels = { data1: 'Parte 1', data2: 'Parte 2', dataT: 'Total' };

  container.innerHTML = `
    <div>
      <label class="font-bold">Datos ('?' para la incógnita):</label>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
        <input type="text" name="data1" placeholder="${labels.data1}" required class="p-2 border rounded">
        <input type="text" name="data2" placeholder="${labels.data2}" required class="p-2 border rounded">
        <input type="text" name="dataT" placeholder="${labels.dataT}" required class="p-2 border rounded">
      </div>
    </div>
    <div>
      <label class="font-bold">Etiquetas de Datos:</label>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
        <input type="text" name="label1" placeholder="Etiqueta ${labels.data1}" required class="p-2 border rounded">
        <input type="text" name="label2" placeholder="Etiqueta ${labels.data2}" required class="p-2 border rounded">
        <input type="text" name="labelT" placeholder="Etiqueta ${labels.dataT}" required class="p-2 border rounded">
      </div>
    </div>
  `;
  // Re-enable global single-step inputs when not in DOS_OPERACIONES mode
  const globOp = document.querySelector('select[name="operation"]');
  const globAns = document.querySelector('input[name="answer"]');
  if (globOp) { globOp.disabled = false; globOp.classList.remove('opacity-50', 'cursor-not-allowed'); }
  if (globAns) { globAns.disabled = false; globAns.classList.remove('opacity-50', 'cursor-not-allowed'); }
}
