const API_BASE = '';

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
