require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { authMiddleware, generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// ===== LOAD SKINS DATA =====
const allSkins = require(path.join(__dirname, '..', 'skins.json'));

// ===== RARITY CONFIG =====
const RARITY_SELL_VALUES = {
  'Consumer Grade':    5,
  'Industrial Grade':  15,
  'Mil-Spec Grade':    40,
  'Restricted':        120,
  'Classified':        350,
  'Covert':            1000,
  'Extraordinary':     3500,
  'Contraband':        15000,
};

const RARITY_ORDER = [
  'Consumer Grade', 'Industrial Grade', 'Mil-Spec Grade',
  'Restricted', 'Classified', 'Covert', 'Extraordinary', 'Contraband'
];

// Group skins by rarity
const skinsByRarity = {};
allSkins.forEach(skin => {
  const rName = skin.rarity?.name;
  if (!rName) return;
  if (!skinsByRarity[rName]) skinsByRarity[rName] = [];
  skinsByRarity[rName].push(skin);
});

// ===== CASE DEFINITIONS =====
const CASES = [
  {
    id: 'case_standard',
    name: 'Caisse Standard',
    icon: '📦',
    price: 50,
    color: '#5e98d9',
    drops: [
      { rarity: 'Consumer Grade',   weight: 60 },
      { rarity: 'Industrial Grade',  weight: 25 },
      { rarity: 'Mil-Spec Grade',    weight: 10 },
      { rarity: 'Restricted',        weight: 4 },
      { rarity: 'Classified',        weight: 1 },
    ],
  },
  {
    id: 'case_premium',
    name: 'Caisse Premium',
    icon: '💎',
    price: 200,
    color: '#4b69ff',
    drops: [
      { rarity: 'Industrial Grade',  weight: 40 },
      { rarity: 'Mil-Spec Grade',    weight: 30 },
      { rarity: 'Restricted',        weight: 20 },
      { rarity: 'Classified',        weight: 8 },
      { rarity: 'Covert',            weight: 2 },
    ],
  },
  {
    id: 'case_elite',
    name: 'Caisse Élite',
    icon: '🔥',
    price: 500,
    color: '#8847ff',
    drops: [
      { rarity: 'Mil-Spec Grade',    weight: 30 },
      { rarity: 'Restricted',        weight: 35 },
      { rarity: 'Classified',        weight: 20 },
      { rarity: 'Covert',            weight: 10 },
      { rarity: 'Extraordinary',     weight: 5 },
    ],
  },
  {
    id: 'case_legendary',
    name: 'Caisse Légendaire',
    icon: '👑',
    price: 1500,
    color: '#d32ce6',
    drops: [
      { rarity: 'Restricted',        weight: 20 },
      { rarity: 'Classified',        weight: 35 },
      { rarity: 'Covert',            weight: 25 },
      { rarity: 'Extraordinary',     weight: 15 },
      { rarity: 'Contraband',        weight: 5 },
    ],
  },
  {
    id: 'case_gold',
    name: 'Caisse GOLD',
    icon: '🌟',
    price: 5000,
    color: '#e4ae39',
    drops: [
      { rarity: 'Classified',        weight: 15 },
      { rarity: 'Covert',            weight: 35 },
      { rarity: 'Extraordinary',     weight: 45 },
      { rarity: 'Contraband',        weight: 5 },
    ],
  },
];

// Helper: pick a random skin from a case
function rollSkinFromCase(caseData) {
  const totalWeight = caseData.drops.reduce((sum, d) => sum + d.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosenRarity = caseData.drops[caseData.drops.length - 1].rarity;

  for (const drop of caseData.drops) {
    roll -= drop.weight;
    if (roll <= 0) {
      chosenRarity = drop.rarity;
      break;
    }
  }

  const pool = skinsByRarity[chosenRarity];
  if (!pool || pool.length === 0) {
    // Fallback to Mil-Spec if somehow empty
    const fallback = skinsByRarity['Mil-Spec Grade'] || allSkins;
    const skin = fallback[Math.floor(Math.random() * fallback.length)];
    return { skin, rarity: skin.rarity?.name || 'Mil-Spec Grade' };
  }

  const skin = pool[Math.floor(Math.random() * pool.length)];
  return { skin, rarity: chosenRarity };
}

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
  // ---- Original/Core upgrades (NERFED: max 3) ----
  extra_wheel:      { baseCost: 150,   costScale: 2.8,  maxLevel: 3 },
  turbo_spin:       { baseCost: 100,   costScale: 1.5,  maxLevel: 3 },
  multiplier:       { baseCost: 250,   costScale: 1.35, maxLevel: 3 },
  lucky:            { baseCost: 500,   costScale: 1.8,  maxLevel: 3 },
  auto_spin:        { baseCost: 1000,  costScale: 2.2,  maxLevel: 3 },
  golden_wheel:     { baseCost: 5000,  costScale: 5.0,  maxLevel: 2 },
  mega_segments:    { baseCost: 1500,  costScale: 2.5,  maxLevel: 3 },
  coin_magnet:      { baseCost: 200,   costScale: 1.25, maxLevel: 3 },
  // ---- Power Roll & Special (NERFED: max 3) ----
  power_roll:       { baseCost: 2000,  costScale: 2.5,  maxLevel: 3 },
  power_roll_boost: { baseCost: 3000,  costScale: 2.0,  maxLevel: 3 },
  power_roll_freq:  { baseCost: 5000,  costScale: 1.8,  maxLevel: 3 },
  diamond_rain:     { baseCost: 10000, costScale: 2.2,  maxLevel: 3 },
  combo_streak:     { baseCost: 1200,  costScale: 1.4,  maxLevel: 3 },
  jackpot_chance:   { baseCost: 25000, costScale: 3.5,  maxLevel: 3 },
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

// =========================================
//  CASE OPENING ROUTES
// =========================================

/** GET /api/cases — List all available cases */
app.get('/api/cases', (req, res) => {
  const casesForClient = CASES.map(c => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    price: c.price,
    color: c.color,
    drops: c.drops.map(d => ({
      rarity: d.rarity,
      chance: d.weight,
      sellValue: RARITY_SELL_VALUES[d.rarity] || 0,
      color: allSkins.find(s => s.rarity?.name === d.rarity)?.rarity?.color || '#fff',
    })),
  }));
  res.json({ cases: casesForClient });
});

/** POST /api/cases/open — Open a case (server-side RNG) */
app.post('/api/cases/open', authMiddleware, (req, res) => {
  const { caseId } = req.body;

  const caseData = CASES.find(c => c.id === caseId);
  if (!caseData) return res.status(400).json({ error: 'Caisse invalide' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  if (user.coins < caseData.price) {
    return res.status(400).json({ error: 'Pas assez de Chiboub Coins!' });
  }

  // Deduct coins
  db.setCoins(req.userId, user.coins - caseData.price);

  // Roll a skin
  const { skin, rarity } = rollSkinFromCase(caseData);
  const sellValue = RARITY_SELL_VALUES[rarity] || 5;

  // Add to inventory
  const itemId = db.addInventoryItem(
    req.userId,
    skin.id,
    skin.name,
    skin.image || '',
    rarity,
    sellValue
  );

  const freshUser = db.getUser(req.userId);

  res.json({
    item: {
      id: itemId,
      skin_id: skin.id,
      skin_name: skin.name,
      skin_image: skin.image || '',
      rarity,
      rarity_color: skin.rarity?.color || '#fff',
      sell_value: sellValue,
    },
    coins: freshUser.coins,
  });
});

/** GET /api/inventory — Get user inventory */
app.get('/api/inventory', authMiddleware, (req, res) => {
  const items = db.getInventory(req.userId);
  // Enrich with rarity color
  const enriched = items.map(item => ({
    ...item,
    rarity_color: allSkins.find(s => s.rarity?.name === item.rarity)?.rarity?.color || '#fff',
  }));
  res.json({ inventory: enriched });
});

/** POST /api/inventory/sell — Sell a skin from inventory */
app.post('/api/inventory/sell', authMiddleware, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId manquant' });

  const item = db.getInventoryItem(itemId, req.userId);
  if (!item) return res.status(404).json({ error: 'Skin non trouvé dans l\'inventaire' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  // Delete item and add coins
  db.deleteInventoryItem(itemId, req.userId);
  db.setCoins(req.userId, user.coins + item.sell_value);

  const freshUser = db.getUser(req.userId);
  res.json({ coins: freshUser.coins, soldValue: item.sell_value });
});

// =========================================
//  CASE BATTLE ROUTE
// =========================================

/** POST /api/case-battle/start — 1v1 case battle vs bot */
app.post('/api/case-battle/start', authMiddleware, (req, res) => {
  const { caseId } = req.body;

  const caseData = CASES.find(c => c.id === caseId);
  if (!caseData) return res.status(400).json({ error: 'Caisse invalide' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

  if (user.coins < caseData.price) {
    return res.status(400).json({ error: 'Pas assez de Chiboub Coins!' });
  }

  // Deduct coins for the battle
  db.setCoins(req.userId, user.coins - caseData.price);

  // Roll for player and bot
  const playerRoll = rollSkinFromCase(caseData);
  const botRoll = rollSkinFromCase(caseData);

  const playerValue = RARITY_SELL_VALUES[playerRoll.rarity] || 0;
  const botValue = RARITY_SELL_VALUES[botRoll.rarity] || 0;

  // Determine winner (higher sell value wins, tie = player wins)
  const playerWins = playerValue >= botValue;

  let resultItems = [];

  if (playerWins) {
    // Player wins: gets both skins
    const id1 = db.addInventoryItem(req.userId, playerRoll.skin.id, playerRoll.skin.name, playerRoll.skin.image || '', playerRoll.rarity, playerValue);
    const id2 = db.addInventoryItem(req.userId, botRoll.skin.id, botRoll.skin.name, botRoll.skin.image || '', botRoll.rarity, botValue);
    resultItems = [id1, id2];
  }
  // If player loses, they get nothing (coins already deducted)

  const freshUser = db.getUser(req.userId);

  res.json({
    playerSkin: {
      skin_name: playerRoll.skin.name,
      skin_image: playerRoll.skin.image || '',
      rarity: playerRoll.rarity,
      rarity_color: playerRoll.skin.rarity?.color || '#fff',
      sell_value: playerValue,
    },
    botSkin: {
      skin_name: botRoll.skin.name,
      skin_image: botRoll.skin.image || '',
      rarity: botRoll.rarity,
      rarity_color: botRoll.skin.rarity?.color || '#fff',
      sell_value: botValue,
    },
    playerWins,
    coins: freshUser.coins,
  });
});

// ===== SERVER SEGMENT VALUES (NERFED ÷10) =====
function getServerSegments(wheelIndex, upgrades) {
  const megaLevel = upgrades.mega_segments || 0;
  const goldenLevel = upgrades.golden_wheel || 0;
  
  let values = [1, 1, 2, 3, 1, 1, 5, 2, 1, 3, 1, 10];

  if (megaLevel >= 1) { values[6] = 12; values.push(25); }
  if (megaLevel >= 2) { values.push(50); }
  if (megaLevel >= 3) { values.push(100); }

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
