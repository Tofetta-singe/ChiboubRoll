require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const db = require('./db');
const { authMiddleware, generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== CONFIG =====
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'http://localhost:3001/auth/discord/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ===== MIDDLEWARE =====
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ===== UPGRADE DEFINITIONS (server-side validation) =====
const UPGRADES = {
  extra_wheel:   { baseCost: 100,  costScale: 2.5, maxLevel: 3 },
  turbo_spin:    { baseCost: 80,   costScale: 1.8, maxLevel: 5 },
  multiplier:    { baseCost: 250,  costScale: 3.0, maxLevel: 5 },
  lucky:         { baseCost: 500,  costScale: 2.8, maxLevel: 4 },
  auto_spin:     { baseCost: 1000, costScale: 3.5, maxLevel: 3 },
  golden_wheel:  { baseCost: 2500, costScale: 1,   maxLevel: 1 },
  mega_segments: { baseCost: 1500, costScale: 2.5, maxLevel: 3 },
  coin_magnet:   { baseCost: 200,  costScale: 1.6, maxLevel: 10 },
};

function getUpgradeCost(upgradeId, currentLevel) {
  const upg = UPGRADES[upgradeId];
  if (!upg) return Infinity;
  return Math.floor(upg.baseCost * Math.pow(upg.costScale, currentLevel));
}

// =========================================
//  AUTH ROUTES — Discord OAuth2
// =========================================

/** Step 1: Redirect user to Discord OAuth2 */
app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

/** Step 2: Discord callback — exchange code for token, fetch user, upsert DB */
app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: 'Code manquant' });
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Discord token error:', tokenData);
      return res.status(400).json({ error: 'Échec d\'authentification Discord' });
    }

    // Fetch user profile from Discord
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const discordUser = await userRes.json();
    if (!discordUser.id) {
      return res.status(400).json({ error: 'Impossible de récupérer le profil Discord' });
    }

    // Build avatar URL
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

    // Upsert user in database
    db.upsertUser(discordUser.id, discordUser.username, avatarUrl);

    // Generate JWT
    const jwt = generateToken(discordUser.id);

    // Redirect to frontend with token
    res.redirect(`${CLIENT_URL}/auth/callback?token=${jwt}`);

  } catch (err) {
    console.error('OAuth2 error:', err);
    res.status(500).json({ error: 'Erreur serveur lors de l\'authentification' });
  }
});

// =========================================
//  API ROUTES (require auth)
// =========================================

/** GET /api/me — Get current user profile + upgrades */
app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.getUser(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }
  const upgrades = db.getUpgrades(req.userId);
  res.json({ user, upgrades });
});

/** POST /api/spin — Process a spin result, server validates and awards coins */
app.post('/api/spin', authMiddleware, (req, res) => {
  const user = db.getUser(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur non trouvé' });
  }

  const upgrades = db.getUpgrades(req.userId);

  // Calculate multipliers from upgrades
  const multiplierLevel = upgrades.multiplier || 0;
  const coinMultiplier = Math.pow(2, multiplierLevel);
  const magnetLevel = upgrades.coin_magnet || 0;
  const magnetBonus = 1 + magnetLevel * 0.10;
  const wheelCount = 1 + (upgrades.extra_wheel || 0);
  const luckyLevel = upgrades.lucky || 0;
  const hasGolden = (upgrades.golden_wheel || 0) > 0;
  const megaLevel = upgrades.mega_segments || 0;

  // Server-side spin calculation
  let totalWin = 0;
  const results = [];

  for (let w = 0; w < wheelCount; w++) {
    const isGolden = w === 0 && hasGolden;
    const segments = getServerSegments(isGolden, megaLevel);

    // Lucky selection
    let winIndex;
    if (luckyLevel > 0 && Math.random() < luckyLevel * 0.12) {
      const sorted = segments.map((s, i) => ({ val: s, i })).sort((a, b) => b.val - a.val);
      const topThird = sorted.slice(0, Math.ceil(sorted.length / 3));
      winIndex = topThird[Math.floor(Math.random() * topThird.length)].i;
    } else {
      winIndex = Math.floor(Math.random() * segments.length);
    }

    const baseValue = segments[winIndex];
    const earned = Math.floor(baseValue * coinMultiplier * magnetBonus);
    totalWin += earned;
    results.push({ wheelIndex: w, segmentIndex: winIndex, value: earned, isGolden });
  }

  // Update database
  const updatedUser = db.addCoins(req.userId, totalWin);

  res.json({
    results,
    totalWin,
    coins: updatedUser.coins,
    totalEarned: updatedUser.total_earned,
    totalSpins: updatedUser.total_spins,
  });
});

/** POST /api/upgrade — Buy an upgrade */
app.post('/api/upgrade', authMiddleware, (req, res) => {
  const { upgradeId } = req.body;

  if (!upgradeId || !UPGRADES[upgradeId]) {
    return res.status(400).json({ error: 'Upgrade invalide' });
  }

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  const upgrades = db.getUpgrades(req.userId);
  const currentLevel = upgrades[upgradeId] || 0;
  const upg = UPGRADES[upgradeId];

  if (currentLevel >= upg.maxLevel) {
    return res.status(400).json({ error: 'Upgrade déjà au max!' });
  }

  const cost = getUpgradeCost(upgradeId, currentLevel);

  if (user.coins < cost) {
    return res.status(400).json({ error: 'Pas assez de Chiboub Coins!' });
  }

  // Deduct coins and set upgrade
  db.setCoins(req.userId, user.coins - cost);
  db.setUpgrade(req.userId, upgradeId, currentLevel + 1);

  const updatedUser = db.getUser(req.userId);
  const updatedUpgrades = db.getUpgrades(req.userId);

  res.json({ user: updatedUser, upgrades: updatedUpgrades });
});

/** GET /api/leaderboard — Top 10 players */
app.get('/api/leaderboard', (req, res) => {
  const leaderboard = db.getLeaderboard();
  res.json({ leaderboard });
});

// ===== SERVER SEGMENT VALUES (mirrors client) =====
function getServerSegments(isGolden, megaLevel) {
  let values = [1, 2, 3, 5, 2, 1, 10, 3, 1, 5, 2, 20];

  if (megaLevel >= 1) { values[6] = 25; values.push(50); }
  if (megaLevel >= 2) { values.push(100); }
  if (megaLevel >= 3) { values.push(250); }

  if (isGolden) {
    values = values.map(v => v * 3);
  }

  return values;
}

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

// ===== START =====
app.listen(PORT, () => {
  console.log(`🎰 ChiboubRoll server running on http://localhost:${PORT}`);
  console.log(`🔗 Discord login: http://localhost:${PORT}/auth/discord`);
});
