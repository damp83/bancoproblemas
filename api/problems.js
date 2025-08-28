// Vercel Serverless Function (Edge): Persist problems to a GitHub file
// GET  /api/problems -> { problems, sha }
// POST /api/problems body: { problems: Problem[], sha?: string, message?: string }
// Env vars required:
// - GITHUB_TOKEN   (repo scope)
// - GITHUB_REPO    (e.g., "damp83/bancoproblemas")
// - GITHUB_PATH    (e.g., "data/problems.json")
// - GITHUB_BRANCH  (e.g., "main")

export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const DEFAULTS = {
  repo: process.env.GITHUB_REPO || 'damp83/bancoproblemas',
  path: process.env.GITHUB_PATH || 'data/problems.json',
  branch: process.env.GITHUB_BRANCH || 'main',
};

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function gh(method, url, token, body) {
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

async function getFile({ token, owner, repo, path, ref }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
  const res = await gh('GET', url, token);
  if (res.status === 404) return { status: 404 };
  if (!res.ok) return { status: res.status, error: await res.text() };
  const json = await res.json();
  const content = fromBase64(json.content || '');
  return { status: 200, content, sha: json.sha };
}

async function putFile({ token, owner, repo, path, branch, message, content, sha }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = { message, content: toBase64(content), branch };
  if (sha) body.sha = sha;
  const res = await gh('PUT', url, token, body);
  if (!res.ok) return { status: res.status, error: await res.text() };
  const json = await res.json();
  return { status: res.status, sha: json.content?.sha };
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: { ...CORS } });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing GITHUB_TOKEN' }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  const [owner, repo] = (process.env.GITHUB_REPO || DEFAULTS.repo).split('/');
  const path = process.env.GITHUB_PATH || DEFAULTS.path;
  const branch = process.env.GITHUB_BRANCH || DEFAULTS.branch;

  if (req.method === 'GET') {
    const file = await getFile({ token, owner, repo, path, ref: branch });
    if (file.status === 404) {
      return new Response(JSON.stringify({ problems: [], sha: null, notFound: true }), { status: 404, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    if (file.error) {
      return new Response(JSON.stringify({ error: file.error }), { status: file.status || 500, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    let problems = [];
    try { problems = JSON.parse(file.content || '[]'); } catch (e) { /* malformed file */ }
    return new Response(JSON.stringify({ problems, sha: file.sha }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const problems = Array.isArray(body?.problems) ? body.problems : [];
      const sha = body?.sha || undefined;
      const message = body?.message || `Update problems ${new Date().toISOString()}`;
      // Persist
      const save = await putFile({ token, owner, repo, path, branch, message, content: JSON.stringify(problems, null, 2), sha });
      if (save.error) {
        const status = save.status || 500;
        // Conflict (sha mismatch)
        const isConflict = status === 409 || status === 412 || /sha/i.test(save.error);
        return new Response(JSON.stringify({ error: save.error, conflict: isConflict }), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
      }
      return new Response(JSON.stringify({ ok: true, sha: save.sha }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
}
