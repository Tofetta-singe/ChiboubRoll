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
const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://chiboubroll.onrender.com/api/auth/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'https://chiboubroll.vercel.app';

// ===== MIDDLEWARE =====
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// ===== UPGRADE DEFINITIONS (server-side validation) =====
const UPGRADES = {
  // ---- Original/Core upgrades ----
  extra_wheel:      { baseCost: 150,   costScale: 2.8,  maxLevel: 10 },  // Max 11 wheels
  turbo_spin:       { baseCost: 100,   costScale: 1.5,  maxLevel: 10 },  // Faster
  multiplier:       { baseCost: 250,   costScale: 1.35, maxLevel: 50 },  // Huge scaling
  lucky:            { baseCost: 500,   costScale: 1.8,  maxLevel: 15 },
  auto_spin:        { baseCost: 1000,  costScale: 2.2,  maxLevel: 10 },  // Max speed
  golden_wheel:     { baseCost: 5000,  costScale: 5.0,  maxLevel: 5 },   // Multiple golden wheels
  mega_segments:    { baseCost: 1500,  costScale: 2.5,  maxLevel: 10 },  // Richer segments
  coin_magnet:      { baseCost: 200,   costScale: 1.25, maxLevel: 100 }, // +1000% bonus
  // ---- Power Roll & Special (Advanced) ----
  power_roll:       { baseCost: 2000,  costScale: 2.5,  maxLevel: 10 },
  power_roll_boost: { baseCost: 3000,  costScale: 2.0,  maxLevel: 25 },
  power_roll_freq:  { baseCost: 5000,  costScale: 1.8,  maxLevel: 5 },   // Down to 10 spins min
  diamond_rain:     { baseCost: 10000, costScale: 2.2,  maxLevel: 10 },
  combo_streak:     { baseCost: 1200,  costScale: 1.4,  maxLevel: 30 },
  jackpot_chance:   { baseCost: 25000, costScale: 3.5,  maxLevel: 5 },
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
app.get('/api/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

/** Step 2: Discord callback — exchange code for token, fetch user, upsert DB */
app.get('/api/auth/callback', async (req, res) => {
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
    res.redirect(`${CLIENT_URL}/?token=${jwt}`);

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

  // ===== Calculate upgrade effects =====
  const multiplierLevel = upgrades.multiplier || 0;
  const coinMultiplier = Math.pow(1.8, multiplierLevel);
  const magnetLevel = upgrades.coin_magnet || 0;
  const magnetBonus = 1 + magnetLevel * 0.10;
  const wheelCount = 1 + (upgrades.extra_wheel || 0);
  const luckyLevel = upgrades.lucky || 0;
  const hasGolden = (upgrades.golden_wheel || 0) > 0;
  const megaLevel = upgrades.mega_segments || 0;

  // ===== Power Roll check =====
  const powerRollLevel = upgrades.power_roll || 0;
  const powerBoostLevel = upgrades.power_roll_boost || 0;
  const powerFreqLevel = upgrades.power_roll_freq || 0;
  const powerRollThreshold = Math.max(10, 25 - powerFreqLevel * 3);
  const powerRollMultiplier = 5 + powerBoostLevel * 2;
  // Power Roll triggers when threshold is reached AND user has the upgrade
  const spinsBeforePower = user.spins_since_power || 0;
  const isPowerRoll = powerRollLevel > 0 && spinsBeforePower >= (powerRollThreshold - 1);

  // ===== Combo Streak =====
  const comboLevel = upgrades.combo_streak || 0;
  const lastSpinTime = user.last_spin_at ? new Date(user.last_spin_at + 'Z').getTime() : 0;
  const now = Date.now();
  const streakTimeout = 30000; // 30 seconds
  let currentStreak = user.spin_streak || 0;
  if (now - lastSpinTime > streakTimeout) {
    currentStreak = 0; // Reset streak if inactive too long
  }
  const streakBonus = comboLevel > 0 ? 1 + currentStreak * 0.05 * comboLevel : 1;

  // ===== Diamond Rain =====
  const diamondLevel = upgrades.diamond_rain || 0;
  const diamondProc = diamondLevel > 0 && Math.random() < diamondLevel * 0.05;

  // ===== Jackpot =====
  const jackpotLevel = upgrades.jackpot_chance || 0;
  const jackpotProc = jackpotLevel > 0 && Math.random() < jackpotLevel * 0.02;

  // ===== Server-side spin calculation =====
  let totalWin = 0;
  const results = [];

  const goldenLevel = upgrades.golden_wheel || 0;

  for (let w = 0; w < wheelCount; w++) {
    const segments = getServerSegments(w, upgrades);
    const isGolden = w < goldenLevel;
    
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
    let earned = Math.floor(baseValue * coinMultiplier * magnetBonus * streakBonus);

    // Power Roll multiplier
    if (isPowerRoll) {
      earned = Math.floor(earned * powerRollMultiplier);
    }

    totalWin += earned;
    results.push({ wheelIndex: w, segmentIndex: winIndex, value: earned, isGolden });
  }

  // Apply Diamond Rain (double total)
  if (diamondProc) {
    totalWin = totalWin * 2;
  }

  // Apply Jackpot (x10 total)
  if (jackpotProc) {
    totalWin = totalWin * 10;
  }

  // ===== Update database =====
  const updatedUser = db.addCoins(req.userId, totalWin);

  // Reset power counter if power roll triggered
  if (isPowerRoll) {
    db.resetPowerCounter(req.userId);
  }

  // Update streak
  db.updateStreak(req.userId, currentStreak + 1);

  // Fetch fresh user for accurate data
  const freshUser = db.getUser(req.userId);

  res.json({
    results,
    totalWin,
    coins: freshUser.coins,
    totalEarned: freshUser.total_earned,
    totalSpins: freshUser.total_spins,
    // Special event flags
    isPowerRoll,
    powerRollMultiplier: isPowerRoll ? powerRollMultiplier : null,
    isDiamondRain: diamondProc,
    isJackpot: jackpotProc,
    comboStreak: currentStreak + 1,
    spinsSincePower: isPowerRoll ? 0 : (freshUser.spins_since_power || 0),
    powerRollThreshold,
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

// ===== SERVER SEGMENT VALUES (mirrors client) — BOOSTED x5 =====
function getServerSegments(wheelIndex, upgrades) {
  const megaLevel = upgrades.mega_segments || 0;
  const goldenLevel = upgrades.golden_wheel || 0;
  
  let values = [5, 10, 15, 25, 10, 5, 50, 15, 5, 25, 10, 100];

  if (megaLevel >= 1) { values[6] = 125; values.push(250); }
  if (megaLevel >= 2) { values.push(500); }
  if (megaLevel >= 3) { values.push(1000); }
  if (megaLevel >= 4) { values.push(2500); }
  if (megaLevel >= 5) { values.push(5000); }
  if (megaLevel >= 10) { values.push(25000); }

  // If this wheel index is within the golden range
  if (wheelIndex < goldenLevel) {
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
  console.log(`🔗 Discord login: http://localhost:${PORT}/api/auth/discord`);
});
