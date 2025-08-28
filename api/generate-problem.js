// Vercel Serverless Function: Generate Problem via Google Gemini
// Endpoint: POST /api/generate-problem
// Expects JSON body: { grade: number (1..6), type: 'PPT'|'UVT'|'COMPARACION'|'CAMBIO'|'DOS_OPERACIONES', theme?: string }
// Returns: { problem: ProblemShape }

// IMPORTANT: Set GEMINI_API_KEY as an Environment Variable in Vercel
// e.g., vercel env add GEMINI_API_KEY

export const config = { runtime: 'edge' };

const MODEL = 'gemini-1.5-flash';

function genId() {
  return (
    Math.random().toString(36).slice(2, 10) + '-' +
    Math.random().toString(36).slice(2, 6)
  );
}

function buildPrompt({ grade, type, theme, count }) {
  const themeLine = theme ? `Usa el tema "${theme}" de forma natural y culturalmente neutra.` : '';
  const n = Math.max(1, Math.min(10, Number(count || 1)));
  return `Eres un generador de problemas de matemáticas para Primaria (España). Genera ${n} problema(s) del curso ${grade}º del tipo ${type}.
${themeLine}
Devuelve SOLO un JSON válido como un array con ${n} elemento(s) (y nada más de texto). Formato EXACTO del objeto:
- Para tipos simples (PPT, UVT, COMPARACION, CAMBIO):
[
  {
    "id": "string-id-corto",
    "grade": ${grade},
    "question": "...",
    "type": "${type}",
    "data": { CLAVES },
    "labels": { CLAVES },
    "operation": "+"|"-"|"*"|"/",
    "answer": "número o ?",
    "fullAnswer": "respuesta en frase",
    "hint": "pista breve",
    "logicCheck": "pregunta de autoverificación",
    "createdAt": 1700000000000
  }
]
- Para DOS_OPERACIONES:
[
  {
    "id": "string-id-corto",
    "grade": ${grade},
    "question": "...",
    "type": "DOS_OPERACIONES",
    "steps": [
      { "type":"PPT|UVT|COMPARACION|CAMBIO", "data":{...}, "labels":{...}, "operation":"+|-|*|/", "answer":"...", "hint":"..." },
      { "type":"PPT|UVT|COMPARACION|CAMBIO", "data":{..."p1|u|cm|ci":"RESULTADO_ANTERIOR"...}, "labels":{...}, "operation":"+|-|*|/", "answer":"...", "hint":"..." }
    ],
    "fullAnswer": "respuesta final",
    "logicCheck": "pregunta",
    "createdAt": 1700000000000
  }
]
Claves por tipo:
- PPT: data {p1,p2,t}, labels {p1,p2,t}
- UVT: data {u,v,t}, labels {u,v,t}
- COMPARACION: data {cm,cmen,d}, labels {cm,cmen,d}
- CAMBIO: data {ci,c,cf}, labels {ci,c,cf}
Requisitos:
- Valores numéricos coherentes con ${grade}º.
- Todos los valores numéricos de data y answer deben ser cadenas ("12"), excepto "?".
- Puedes mencionar euros en question/fullAnswer, pero NO pongas símbolos en data/answer.
- Devuelve ÚNICAMENTE el JSON (array con 1 objeto), sin comentarios ni texto adicional.`;
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
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
    });
    if (!resp.ok) {
      const t = await resp.text();
      return { error: `Gemini error ${resp.status}: ${t.slice(0,500)}` };
    }
    const json = await resp.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON (array or object)
    const arrMatch = text.match(/\[[\s\S]*\]$/);
    const objMatch = text.match(/\{[\s\S]*\}$/);
    const raw = (arrMatch ? arrMatch[0] : (objMatch ? objMatch[0] : text)).trim();
    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) parsed = [parsed];
    return { problems: parsed };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
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
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  const arr = (result.problems || []).slice(0, count).map(p => normalizeProblem(p, { grade, type }));
  const first = arr[0] || null;
  return new Response(JSON.stringify({ problem: first, problems: arr }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
}
