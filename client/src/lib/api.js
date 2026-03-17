export const API_BASE = 'https://chiboubroll.onrender.com';

function getHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/api/me`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json();
}

export async function doSpin(token) {
  const res = await fetch(`${API_BASE}/api/spin`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Spin failed');
  }
  return res.json();
}

export async function buyUpgrade(token, upgradeId) {
  const res = await fetch(`${API_BASE}/api/upgrade`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ upgradeId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Upgrade failed');
  }
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/api/leaderboard`);
  if (!res.ok) throw new Error('Failed to load leaderboard');
  return res.json();
}

// ===== CASES =====
export async function fetchCases() {
  const res = await fetch(`${API_BASE}/api/cases`);
  if (!res.ok) throw new Error('Failed to load cases');
  return res.json();
}

export async function openCase(token, caseId) {
  const res = await fetch(`${API_BASE}/api/cases/open`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ caseId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Échec ouverture de caisse');
  }
  return res.json();
}

// ===== INVENTORY =====
export async function fetchInventory(token) {
  const res = await fetch(`${API_BASE}/api/inventory`, { headers: getHeaders(token) });
  if (!res.ok) throw new Error('Failed to load inventory');
  return res.json();
}

export async function sellSkin(token, itemId) {
  const res = await fetch(`${API_BASE}/api/inventory/sell`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ itemId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Échec de la vente');
  }
  return res.json();
}

// ===== CASE BATTLE =====
export async function startCaseBattle(token, caseId) {
  const res = await fetch(`${API_BASE}/api/case-battle/start`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ caseId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Échec du Case Battle');
  }
  return res.json();
}
