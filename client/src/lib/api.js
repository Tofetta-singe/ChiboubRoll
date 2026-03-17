export const API_BASE = 'https://chiboubroll.onrender.com';

function getHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse(res, fallbackMessage) {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || fallbackMessage);
  }
  return res.json();
}

export async function fetchMe(token) {
  const res = await fetch(`${API_BASE}/api/me`, { headers: getHeaders(token) });
  return parseResponse(res, 'Unauthorized');
}

export async function doSpin(token) {
  const res = await fetch(`${API_BASE}/api/spin`, {
    method: 'POST',
    headers: getHeaders(token),
  });
  return parseResponse(res, 'Spin failed');
}

export async function buyUpgrade(token, upgradeId) {
  const res = await fetch(`${API_BASE}/api/upgrade`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ upgradeId }),
  });
  return parseResponse(res, 'Upgrade failed');
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API_BASE}/api/leaderboard`);
  return parseResponse(res, 'Failed to load leaderboard');
}

export async function fetchCases() {
  const res = await fetch(`${API_BASE}/api/cases`);
  return parseResponse(res, 'Failed to load cases');
}

export async function openCase(token, caseId, amount = 1) {
  const res = await fetch(`${API_BASE}/api/cases/open`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ caseId, amount }),
  });
  return parseResponse(res, 'Echec ouverture de caisse');
}

export async function fetchInventory(token) {
  const res = await fetch(`${API_BASE}/api/inventory`, {
    headers: getHeaders(token),
  });
  return parseResponse(res, 'Failed to load inventory');
}

export async function sellSkin(token, itemId) {
  const res = await fetch(`${API_BASE}/api/inventory/sell`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ itemId }),
  });
  return parseResponse(res, 'Echec de la vente');
}

export async function setShowcaseSkin(token, itemId) {
  const res = await fetch(`${API_BASE}/api/profile/showcase`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ itemId }),
  });
  return parseResponse(res, 'Echec mise a jour vitrine');
}

export async function startCaseBattle(token, caseId) {
  const res = await fetch(`${API_BASE}/api/case-battle/start`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ caseId }),
  });
  return parseResponse(res, 'Echec du Case Battle');
}

export async function fetchBattlepass(token) {
  const res = await fetch(`${API_BASE}/api/battlepass`, {
    headers: getHeaders(token),
  });
  return parseResponse(res, 'Failed to load battlepass');
}

export async function claimBattlepassTier(token, tierId) {
  const res = await fetch(`${API_BASE}/api/battlepass/claim`, {
    method: 'POST',
    headers: getHeaders(token),
    body: JSON.stringify({ tierId }),
  });
  return parseResponse(res, 'Echec du claim battlepass');
}
