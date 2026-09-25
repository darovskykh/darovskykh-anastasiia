/**
 * Demo mode: answers every backend request in the browser with fake data so the
 * admin can be clicked through without a backend. Enabled only by
 * VITE_MOCK_API=true (see `npm run dev:mock`). Nothing here is meant for production.
 */
import {
  MOCK_CASE_ID,
  MOCK_PERSONA_ID,
  MOCK_TOKEN,
  mockAdmin,
  mockBasePrompt,
  mockCase,
  mockPersona,
  mockPersonaStructure,
} from './mockData';

const STORAGE_KEY = 'mock_api_db_v1';

interface MockDb {
  case: typeof mockCase;
  persona: typeof mockPersona;
  structure: typeof mockPersonaStructure;
  basePrompt: typeof mockBasePrompt;
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to fresh data
  }
  return { case: mockCase, persona: mockPersona, structure: mockPersonaStructure, basePrompt: mockBasePrompt };
}

function saveDb(db: MockDb) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ok = (data: unknown) => json({ success: true, event: 'mock', data });

async function readBody(init?: RequestInit): Promise<any> {
  if (!init?.body || typeof init.body !== 'string') return {};
  try {
    return JSON.parse(init.body);
  } catch {
    return {};
  }
}

async function handle(path: string, method: string, init?: RequestInit): Promise<Response> {
  const db = loadDb();
  const body = method === 'GET' ? {} : await readBody(init);

  if (path === '/auth/login') return ok({ token: MOCK_TOKEN, user: mockAdmin });
  if (path === '/auth/me') return ok(mockAdmin);

  if (path === '/users/admin/dashboard') {
    const stat = { count: 0, percentageGrowth: '0' };
    return ok({ active_simulations: stat, completed_simulations: stat, all_chats: stat, last_activity: [] });
  }
  if (path === '/notifications') return ok({ items: [], unread_count: 0 });
  if (path.startsWith('/notifications/')) return ok({});

  if (path === '/cases' && method === 'GET') return ok([db.case]);
  if (path === `/cases/${MOCK_CASE_ID}/all_data`) return ok({ case: db.case, persona: db.persona });
  if (path === `/cases/${MOCK_CASE_ID}/validate`) {
    return ok({ case_title: 'Adrian I3', persona_name: db.persona.name, findings: [], errors: 0, warnings: 0 });
  }
  if (path === `/cases/${MOCK_CASE_ID}` && method === 'PUT') {
    db.case = { ...db.case, ...body };
    saveDb(db);
    return ok(db.case);
  }

  if (path === '/personas' && method === 'GET') return ok([db.persona]);
  if (path === `/personas/${MOCK_PERSONA_ID}` && method === 'PUT') {
    db.persona = { ...db.persona, ...body };
    saveDb(db);
    return ok(db.persona);
  }
  if (path === `/personas/${MOCK_PERSONA_ID}/all_data`) return ok({ persona: db.persona, case: db.case });
  if (path === `/personas/${MOCK_PERSONA_ID}/structure`) {
    if (method === 'PUT') {
      db.structure = body;
      saveDb(db);
    }
    return ok(db.structure);
  }

  if (path === '/base-prompt') {
    if (method === 'PUT') {
      db.basePrompt = body;
      saveDb(db);
    }
    return ok(db.basePrompt);
  }

  if (path.startsWith('/evaluation_prompt/')) {
    return ok({ prompt: { id: 'mock-eval', name: 'Demo', main_prompt: '', categories_prompts: {}, is_draft: false } });
  }
  if (path.startsWith('/final_evaluation_prompt/')) {
    return ok({ id: 'mock-final-eval', name: 'Demo', prompt: '', is_draft: false });
  }

  if (method === 'GET') return ok([]);
  return json({ success: false, detail: 'Демо-режим: ця дія недоступна без бекенду.' }, 501);
}

export function installMockApi() {
  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const originalFetch = window.fetch.bind(window);

  if (!localStorage.getItem('auth_token')) {
    localStorage.setItem('auth_token', MOCK_TOKEN);
  }

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!apiBase || !url.startsWith(apiBase)) return originalFetch(input, init);
    const { pathname } = new URL(url.slice(apiBase.length) || '/', 'http://mock');
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    return handle(pathname, method, init);
  };

  console.info('[mock] Демо-режим: запити до бекенду обробляються в браузері.');
}

export function resetMockDb() {
  localStorage.removeItem(STORAGE_KEY);
}
