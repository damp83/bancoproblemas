// Vercel Serverless Function: Generate Problem via Google Gemini
// Endpoint: POST /api/generate-problem
// Expects JSON body: { grade: number (1..6), type: 'PPT'|'UVT'|'COMPARACION'|'CAMBIO'|'DOS_OPERACIONES', theme?: string }
// Returns: { problem: ProblemShape }

// IMPORTANT: Set GEMINI_API_KEY as an Environment Variable in Vercel
// e.g., vercel env add GEMINI_API_KEY

export const config = { runtime: 'edge' };

const MODEL = 'gemini-1.5-flash';

// Basic CORS headers to allow GitHub Pages (or other origins) to call this API
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function genId() {
  return (
    Math.random().toString(36).slice(2, 10) + '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function buildPrompt({ grade, type, theme, count }) {
  const n = Math.max(1, Math.min(10, Number(count || 1)));
  const themeLine = theme ? `Usa el tema \"${theme}\" de forma natural y culturalmente neutra.` : 'Varía el contexto (tienda, cole, excursión, deportes) con lenguaje cercano a Primaria.';
  const ranges = `Rangos aproximados por curso (usa enteros salvo que el tipo requiera):\n1º: 1-20 sum/resta; 2º: 1-50; 3º: 1-100 (multiplicación básica); 4º: hasta 1000 (dos pasos); 5º-6º: hasta 10000 (incluye división). Evita decimales salvo 5º-6º (<= 1 decimal).`;
  const rules = [
    `Devuelve SOLO un JSON válido como un array con ${n} elemento(s).`,
    'No incluyas texto fuera del JSON. No uses Markdown ni ```.',
    'Idioma: español (España), tono infantil y claro.',
    'Evita temas sensibles. Nombres y contextos neutrales.',
    'answer y todos los valores numéricos en data deben ser cadenas ("12") o "?".',
    'operation: usa +, -, *, / según corresponda.',
    'labels: rellena etiquetas claras para cada clave.',
    'Si tipo = DOS_OPERACIONES: exactamente 2 pasos; el segundo paso debe usar "RESULTADO_ANTERIOR" en una de sus claves de data para depender del primer resultado.',
    'fullAnswer: frase completa y coherente; hint: pista breve; logicCheck: pregunta de verificación.'
  ].join('\n- ');

  return `Eres un generador de problemas de matemáticas para Primaria (España). Genera ${n} problema(s) de ${grade}º, tipo ${type}.
${themeLine}
${ranges}
Instrucciones:
- ${rules}
Esquema por tipo:
- PPT: data {"p1","p2","t"}; labels {"p1","p2","t"}
- UVT: data {"u","v","t"}; labels {"u","v","t"}
- COMPARACION: data {"cm","cmen","d"}; labels {"cm","cmen","d"}
- CAMBIO: data {"ci","c","cf"}; labels {"ci","c","cf"}
Salida: un ARRAY JSON de longitud ${n}. Cada objeto contiene: {"id","grade", "question","type", ("data"+"labels"+"operation"+"answer") o ("steps" de 2), "fullAnswer","hint","logicCheck","createdAt"(epoch ms)}.`;
}

 async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: 'Missing GEMINI_API_KEY' };
  }
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 }
      })
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { error: `Gemini error ${resp.status}: ${t.slice(0,500)}` };
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON robustly, handling Markdown code fences and extra prose
    const problems = extractProblemsFromText(text);
    return { problems };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

function extractProblemsFromText(text) {
  let t = String(text || '').trim();
  // If wrapped in Markdown code fences, keep only the inner content
  const startFence = t.indexOf('```');
  const endFence = t.lastIndexOf('```');
  if (startFence !== -1 && endFence !== -1 && endFence > startFence) {
    t = t.slice(startFence + 3, endFence).trim();
    // Strip optional language tag like "json"
    t = t.replace(/^json\s*/i, '').trim();
  }
  // Slice to first JSON bracket and last closing bracket
  const firstSq = t.indexOf('[');
  const firstCurly = t.indexOf('{');
  const first = [firstSq, firstCurly].filter(i => i >= 0).sort((a,b)=>a-b)[0];
  const lastSq = t.lastIndexOf(']');
  const lastCurly = t.lastIndexOf('}');
  const last = Math.max(lastSq, lastCurly);
  if (first >= 0 && last >= first) t = t.slice(first, last + 1).trim();
  // Try parse as JSON
  let parsed;
  try { parsed = JSON.parse(t); }
  catch (e) {
    // As a fallback, remove any stray backticks and try again
    const t2 = t.replace(/```/g, '').trim();
    parsed = JSON.parse(t2);
  }
  if (!Array.isArray(parsed)) parsed = [parsed];
  return parsed;
}

function coerceStr(v) {
  if (v === undefined || v === null) return '';
  if (v === '?' || v === 'RESULTADO_ANTERIOR') return v;
  return String(v).replace(',', '.').replace(/[^0-9.?-]/g, (m) => (m === '?' ? '?' : ''));
}

function normalizeProblem(p, { grade, type }) {
  const now = Date.now();
  const out = { ...p };
  if (!out.id) out.id = genId();
  if (!out.createdAt) out.createdAt = now;
  out.grade = Number(out.grade ?? grade);
  out.type = String(out.type || type).toUpperCase();
  // Normalize simple vs steps
  if (out.type === 'DOS_OPERACIONES' && Array.isArray(out.steps)) {
    out.steps = out.steps.slice(0, 2).map((s) => {
      const st = { ...s };
      st.type = String(st.type || 'PPT').toUpperCase();
      st.operation = ['+','-','*','/'].includes(st.operation) ? st.operation : '+';
      // coerce data values to strings
      const d = { ...(st.data || {}) };
      if (st.type === 'PPT') st.data = { p1: coerceStr(d.p1), p2: coerceStr(d.p2), t: coerceStr(d.t ?? '?') };
      else if (st.type === 'UVT') st.data = { u: coerceStr(d.u), v: coerceStr(d.v), t: coerceStr(d.t ?? '?') };
      else if (st.type === 'COMPARACION') st.data = { cm: coerceStr(d.cm), cmen: coerceStr(d.cmen), d: coerceStr(d.d ?? '?') };
      else if (st.type === 'CAMBIO') st.data = { ci: coerceStr(d.ci), c: coerceStr(d.c), cf: coerceStr(d.cf ?? '?') };
      // labels fallback
      const defaults = {
        PPT: { p1: 'Parte 1', p2: 'Parte 2', t: 'Total' },
        UVT: { u: 'Unidad', v: 'Veces', t: 'Total' },
        COMPARACION: { cm: 'Cantidad mayor', cmen: 'Cantidad menor', d: 'Diferencia' },
        CAMBIO: { ci: 'Cantidad inicial', c: 'Cambio', cf: 'Cantidad final' }
      };
      st.labels = st.labels || defaults[st.type] || {};
      st.answer = coerceStr(st.answer);
      return st;
    });
  } else {
    // Simple
    const d = { ...(out.data || {}) };
    if (out.type === 'PPT') out.data = { p1: coerceStr(d.p1), p2: coerceStr(d.p2), t: coerceStr(d.t ?? '?') };
    else if (out.type === 'UVT') out.data = { u: coerceStr(d.u), v: coerceStr(d.v), t: coerceStr(d.t ?? '?') };
    else if (out.type === 'COMPARACION') out.data = { cm: coerceStr(d.cm), cmen: coerceStr(d.cmen), d: coerceStr(d.d ?? '?') };
    else if (out.type === 'CAMBIO') out.data = { ci: coerceStr(d.ci), c: coerceStr(d.c), cf: coerceStr(d.cf ?? '?') };
    const defaults = {
      PPT: { p1: 'Parte 1', p2: 'Parte 2', t: 'Total' },
      UVT: { u: 'Unidad', v: 'Veces', t: 'Total' },
      COMPARACION: { cm: 'Cantidad mayor', cmen: 'Cantidad menor', d: 'Diferencia' },
      CAMBIO: { ci: 'Cantidad inicial', c: 'Cambio', cf: 'Cantidad final' }
    };
    out.labels = out.labels || defaults[out.type] || {};
    out.operation = ['+','-','*','/'].includes(out.operation) ? out.operation : '+';
    out.answer = coerceStr(out.answer);
  }
  return out;
}

export default async function handler(req) {
  // Preflight for cross-origin POST with JSON
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: { ...CORS_HEADERS } });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }
  try {
    const body = await req.json();
    const grade = Math.max(1, Math.min(6, Number(body?.grade || 1)));
    const type = String(body?.type || 'PPT').toUpperCase();
    const theme = (body?.theme || '').toString();
  const count = Math.max(1, Math.min(10, Number(body?.count || 1)));

  const prompt = buildPrompt({ grade, type, theme, count });
  const result = await callGemini(prompt);
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
    }
  const arr = (result.problems || []).slice(0, count).map(p => normalizeProblem(p, { grade, type }));
  const first = arr[0] || null;
  return new Response(JSON.stringify({ problem: first, problems: arr }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  }
}
