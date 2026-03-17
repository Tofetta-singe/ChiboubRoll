require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { authMiddleware, generateToken } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'chiboub-secret';
const server = http.createServer(app);

const allSkins = require(path.join(__dirname, '..', 'skins.json'));

const RARITY_SELL_VALUES = {
  'Consumer Grade': 5,
  'Industrial Grade': 15,
  'Mil-Spec Grade': 40,
  Restricted: 240,
  Classified: 900,
  Covert: 3500,
  Extraordinary: 12000,
  Contraband: 50000,
};

const RARITY_ORDER = [
  'Consumer Grade',
  'Industrial Grade',
  'Mil-Spec Grade',
  'Restricted',
  'Classified',
  'Covert',
  'Extraordinary',
  'Contraband',
];

const FEED_MIN_RARITY = 'Covert';

const WEAR_TIERS = [
  { short: 'FN', name: 'Factory New', min: 0.0, max: 0.07, multiplier: 2.5 },
  { short: 'MW', name: 'Minimal Wear', min: 0.07, max: 0.15, multiplier: 1.5 },
  { short: 'FT', name: 'Field-Tested', min: 0.15, max: 0.38, multiplier: 1.0 },
  { short: 'WW', name: 'Well-Worn', min: 0.38, max: 0.45, multiplier: 0.8 },
  { short: 'BS', name: 'Battle-Scarred', min: 0.45, max: 1.01, multiplier: 0.5 },
];

const FREE_CASE_COOLDOWN_MS = 20_000;
const LIVE_FEED_LIMIT = 25;

const skinsByRarity = {};
allSkins.forEach((skin) => {
  const rarity = skin.rarity?.name;
  if (!rarity) return;
  if (!skinsByRarity[rarity]) skinsByRarity[rarity] = [];
  skinsByRarity[rarity].push(skin);
});

function rarityColor(rarity) {
  return allSkins.find((skin) => skin.rarity?.name === rarity)?.rarity?.color || '#ffffff';
}

const CASES = [
  {
    id: 'case_gratuite',
    name: 'Caisse Gratuite',
    icon: '🎁',
    price: 0,
    color: '#60d394',
    cooldownMs: FREE_CASE_COOLDOWN_MS,
    drops: [
      { rarity: 'Consumer Grade', weight: 64 },
      { rarity: 'Industrial Grade', weight: 24 },
      { rarity: 'Mil-Spec Grade', weight: 10 },
      { rarity: 'Restricted', weight: 2 },
    ],
  },
  {
    id: 'case_basique',
    name: 'Caisse Basique',
    icon: '🎁',
    price: 25,
    color: '#b0c3d9',
    drops: [
      { rarity: 'Consumer Grade', weight: 67 },
      { rarity: 'Industrial Grade', weight: 22 },
      { rarity: 'Mil-Spec Grade', weight: 9 },
      { rarity: 'Restricted', weight: 2 },
    ],
  },
  {
    id: 'case_standard',
    name: 'Caisse Standard',
    icon: '📦',
    price: 50,
    color: '#5e98d9',
    drops: [
      { rarity: 'Consumer Grade', weight: 57 },
      { rarity: 'Industrial Grade', weight: 22 },
      { rarity: 'Mil-Spec Grade', weight: 14 },
      { rarity: 'Restricted', weight: 6 },
      { rarity: 'Classified', weight: 1 },
    ],
  },
  {
    id: 'case_premium',
    name: 'Caisse Premium',
    icon: '💎',
    price: 200,
    color: '#4b69ff',
    drops: [
      { rarity: 'Industrial Grade', weight: 39 },
      { rarity: 'Mil-Spec Grade', weight: 29 },
      { rarity: 'Restricted', weight: 19 },
      { rarity: 'Classified', weight: 10 },
      { rarity: 'Covert', weight: 3 },
    ],
  },
  {
    id: 'case_elite',
    name: 'Caisse Elite',
    icon: '🔥',
    price: 500,
    color: '#8847ff',
    drops: [
      { rarity: 'Mil-Spec Grade', weight: 31 },
      { rarity: 'Restricted', weight: 31 },
      { rarity: 'Classified', weight: 21 },
      { rarity: 'Covert', weight: 12 },
      { rarity: 'Extraordinary', weight: 5 },
    ],
  },
  {
    id: 'case_legendary',
    name: 'Caisse Legendaire',
    icon: '👑',
    price: 1500,
    color: '#d32ce6',
    drops: [
      { rarity: 'Restricted', weight: 24 },
      { rarity: 'Classified', weight: 31 },
      { rarity: 'Covert', weight: 24 },
      { rarity: 'Extraordinary', weight: 16 },
      { rarity: 'Contraband', weight: 5 },
    ],
  },
  {
    id: 'case_gold',
    name: 'Caisse Gold',
    icon: '🌟',
    price: 5000,
    color: '#e4ae39',
    drops: [
      { rarity: 'Classified', weight: 18 },
      { rarity: 'Covert', weight: 34 },
      { rarity: 'Extraordinary', weight: 43 },
      { rarity: 'Contraband', weight: 5 },
    ],
  },
  {
    id: 'case_urban',
    name: 'Caisse Urbaine',
    icon: '🏙️',
    price: 85,
    color: '#7f8c8d',
    drops: [
      { rarity: 'Consumer Grade', weight: 49 },
      { rarity: 'Industrial Grade', weight: 27 },
      { rarity: 'Mil-Spec Grade', weight: 16 },
      { rarity: 'Restricted', weight: 6 },
      { rarity: 'Classified', weight: 2 },
    ],
  },
  {
    id: 'case_frost',
    name: 'Caisse Frostbite',
    icon: '❄️',
    price: 320,
    color: '#7dd3fc',
    drops: [
      { rarity: 'Industrial Grade', weight: 28 },
      { rarity: 'Mil-Spec Grade', weight: 32 },
      { rarity: 'Restricted', weight: 22 },
      { rarity: 'Classified', weight: 13 },
      { rarity: 'Covert', weight: 5 },
    ],
  },
  {
    id: 'case_inferno',
    name: 'Caisse Inferno',
    icon: '🔥',
    price: 750,
    color: '#ff6b35',
    drops: [
      { rarity: 'Mil-Spec Grade', weight: 24 },
      { rarity: 'Restricted', weight: 32 },
      { rarity: 'Classified', weight: 24 },
      { rarity: 'Covert', weight: 15 },
      { rarity: 'Extraordinary', weight: 5 },
    ],
  },
  {
    id: 'case_sakura',
    name: 'Caisse Sakura',
    icon: '🌸',
    price: 980,
    color: '#ff8fab',
    drops: [
      { rarity: 'Restricted', weight: 30 },
      { rarity: 'Classified', weight: 30 },
      { rarity: 'Covert', weight: 22 },
      { rarity: 'Extraordinary', weight: 14 },
      { rarity: 'Contraband', weight: 4 },
    ],
  },
  {
    id: 'case_void',
    name: 'Caisse Void',
    icon: '🪐',
    price: 2600,
    color: '#8b5cf6',
    drops: [
      { rarity: 'Classified', weight: 29 },
      { rarity: 'Covert', weight: 35 },
      { rarity: 'Extraordinary', weight: 30 },
      { rarity: 'Contraband', weight: 6 },
    ],
  },
];

for (const caseData of CASES) {
  if (caseData.id !== 'case_gratuite') {
    caseData.drops = createCaseDrops(caseData.price);
  }
}

const BATTLEPASS_TIERS = [
  { id: 'bp_01', spinsRequired: 5, reward: { type: 'coins', amount: 100 } },
  { id: 'bp_02', spinsRequired: 12, reward: { type: 'skin', rarity: 'Mil-Spec Grade', label: 'Drop Mil-Spec' } },
  { id: 'bp_03', spinsRequired: 25, reward: { type: 'coins', amount: 350 } },
  { id: 'bp_04', spinsRequired: 40, reward: { type: 'skin', rarity: 'Restricted', label: 'Drop Restricted' } },
  { id: 'bp_05', spinsRequired: 60, reward: { type: 'coins', amount: 900 } },
  { id: 'bp_06', spinsRequired: 85, reward: { type: 'skin', rarity: 'Classified', label: 'Drop Classified' } },
  { id: 'bp_07', spinsRequired: 120, reward: { type: 'coins', amount: 2200 } },
  { id: 'bp_08', spinsRequired: 160, reward: { type: 'skin', rarity: 'Covert', label: 'Drop Covert' } },
];

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT_URI =
  process.env.DISCORD_REDIRECT_URI || 'https://chiboubroll.onrender.com/api/auth/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'https://chiboubroll.vercel.app';

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

const activeSpinRequests = new Set();
const liveDrops = [];

const UPGRADES = {
  extra_wheel: { baseCost: 300, costScale: 3.2, maxLevel: 2 },
  turbo_spin: { baseCost: 180, costScale: 1.8, maxLevel: 3 },
  multiplier: { baseCost: 450, costScale: 1.7, maxLevel: 3 },
  lucky: { baseCost: 900, costScale: 2.1, maxLevel: 3 },
  auto_spin: { baseCost: 1800, costScale: 2.8, maxLevel: 3 },
  mega_segments: { baseCost: 2600, costScale: 3.0, maxLevel: 2 },
  coin_magnet: { baseCost: 500, costScale: 1.6, maxLevel: 3 },
  power_roll: { baseCost: 4200, costScale: 2.8, maxLevel: 3 },
  power_roll_boost: { baseCost: 5500, costScale: 2.4, maxLevel: 3 },
  power_roll_freq: { baseCost: 7000, costScale: 2.2, maxLevel: 3 },
  diamond_rain: { baseCost: 14000, costScale: 2.5, maxLevel: 3 },
  combo_streak: { baseCost: 2200, costScale: 1.7, maxLevel: 3 },
  jackpot_chance: { baseCost: 42000, costScale: 4.0, maxLevel: 2 },
};

function getUpgradeCost(upgradeId, currentLevel) {
  const upgrade = UPGRADES[upgradeId];
  if (!upgrade) return Infinity;
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costScale, currentLevel));
}

function getWearData(floatValue) {
  const wear = WEAR_TIERS.find((tier) => floatValue >= tier.min && floatValue < tier.max) || WEAR_TIERS[2];
  return { floatValue: Number(floatValue.toFixed(4)), ...wear };
}

function buildInventoryItemFromRoll(roll) {
  const wear = getWearData(Math.random());
  const baseValue = RARITY_SELL_VALUES[roll.rarity] || 5;
  const sellValue = Math.max(1, Math.round(baseValue * wear.multiplier));

  return {
    skin_id: roll.skin.id,
    skin_name: roll.skin.name,
    skin_image: roll.skin.image || '',
    rarity: roll.rarity,
    rarity_color: roll.skin.rarity?.color || rarityColor(roll.rarity),
    sell_value: sellValue,
    float_value: wear.floatValue,
    wear_name: wear.name,
    wear_short: wear.short,
  };
}

function createLiveDrop(payload) {
  liveDrops.unshift(payload);
  liveDrops.splice(LIVE_FEED_LIMIT);
  io.emit('global:drop', payload);
}

function shouldEmitFeedDrop(rarity) {
  return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(FEED_MIN_RARITY);
}

function emitGlobalDrop(user, item, caseName, source = 'case') {
  if (!shouldEmitFeedDrop(item.rarity)) return;
  createLiveDrop({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    userId: user.id,
    username: user.username,
    avatar: user.avatar,
    skin: item.skin_name,
    skinImage: item.skin_image,
    rarity: item.rarity,
    rarityColor: item.rarity_color,
    caseName,
    wearShort: item.wear_short,
    floatValue: item.float_value,
    sellValue: item.sell_value,
    createdAt: new Date().toISOString(),
  });
}

function rollSkinFromCase(caseData) {
  const totalWeight = caseData.drops.reduce((sum, drop) => sum + drop.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosenRarity = caseData.drops[caseData.drops.length - 1].rarity;

  for (const drop of caseData.drops) {
    roll -= drop.weight;
    if (roll <= 0) {
      chosenRarity = drop.rarity;
      break;
    }
  }

  const pool = skinsByRarity[chosenRarity] || skinsByRarity['Mil-Spec Grade'] || allSkins;
  const skin = pool[Math.floor(Math.random() * pool.length)];
  return { skin, rarity: chosenRarity };
}

function createCaseDrops(price) {
  if (price <= 25) {
    return [
      { rarity: 'Consumer Grade', weight: 68 },
      { rarity: 'Industrial Grade', weight: 21 },
      { rarity: 'Mil-Spec Grade', weight: 8 },
      { rarity: 'Restricted', weight: 2.6 },
      { rarity: 'Classified', weight: 0.35 },
      { rarity: 'Covert', weight: 0.05 },
    ];
  }

  if (price <= 100) {
    return [
      { rarity: 'Consumer Grade', weight: 56 },
      { rarity: 'Industrial Grade', weight: 24 },
      { rarity: 'Mil-Spec Grade', weight: 13 },
      { rarity: 'Restricted', weight: 5.5 },
      { rarity: 'Classified', weight: 1.25 },
      { rarity: 'Covert', weight: 0.25 },
    ];
  }

  if (price <= 400) {
    return [
      { rarity: 'Industrial Grade', weight: 29 },
      { rarity: 'Mil-Spec Grade', weight: 34 },
      { rarity: 'Restricted', weight: 23 },
      { rarity: 'Classified', weight: 10.5 },
      { rarity: 'Covert', weight: 2.2 },
      { rarity: 'Extraordinary', weight: 1.3 },
    ];
  }

  if (price <= 1200) {
    return [
      { rarity: 'Mil-Spec Grade', weight: 28 },
      { rarity: 'Restricted', weight: 34 },
      { rarity: 'Classified', weight: 24 },
      { rarity: 'Covert', weight: 9.5 },
      { rarity: 'Extraordinary', weight: 3.2 },
      { rarity: 'Contraband', weight: 1.3 },
    ];
  }

  return [
    { rarity: 'Restricted', weight: 31 },
    { rarity: 'Classified', weight: 34 },
    { rarity: 'Covert', weight: 23 },
    { rarity: 'Extraordinary', weight: 9.5 },
    { rarity: 'Contraband', weight: 2.5 },
  ];
}

function generateStrip(caseData, winningItem) {
  const strip = [];
  for (let i = 0; i < 40; i++) {
    if (i === 35) {
      strip.push({
        skin_name: winningItem.skin_name,
        skin_image: winningItem.skin_image,
        rarity: winningItem.rarity,
        rarity_color: winningItem.rarity_color,
        float_value: winningItem.float_value,
        wear_short: winningItem.wear_short,
      });
      continue;
    }
    const fakeItem = buildInventoryItemFromRoll(rollSkinFromCase(caseData));
    strip.push({
      skin_name: fakeItem.skin_name,
      skin_image: fakeItem.skin_image,
      rarity: fakeItem.rarity,
      rarity_color: fakeItem.rarity_color,
      float_value: fakeItem.float_value,
      wear_short: fakeItem.wear_short,
    });
  }
  return strip;
}

function getServerSegments(wheelIndex, upgrades) {
  const megaLevel = upgrades.mega_segments || 0;
  const values = [5, 5, 5, 10, 5, 5, 15, 5, 5, 10, 5, 25];
  if (megaLevel >= 1) {
    values[6] = 20;
    values.push(30);
  }
  if (megaLevel >= 2) values.push(55);
  if (megaLevel >= 3) values.push(90);
  return values;
}

function createInventoryRecord(userId, item) {
  const id = db.addInventoryItem(userId, item);
  return { id, ...item };
}

function rewardBattlepass(userId, tier) {
  const user = db.getUser(userId);
  if (!user) throw new Error('Utilisateur non trouve');

  if (tier.reward.type === 'coins') {
    const updatedUser = db.setCoins(userId, user.coins + tier.reward.amount);
    return {
      rewardType: 'coins',
      coinsGranted: tier.reward.amount,
      user: updatedUser,
    };
  }

  const pool = skinsByRarity[tier.reward.rarity] || allSkins;
  const item = buildInventoryItemFromRoll({
    skin: pool[Math.floor(Math.random() * pool.length)],
    rarity: tier.reward.rarity,
  });
  const record = createInventoryRecord(userId, item);
  emitGlobalDrop(user, record, `Battlepass ${tier.id.toUpperCase()}`, 'battlepass');
  return {
    rewardType: 'skin',
    item: record,
    user: db.getUser(userId),
  };
}

function serializeBattlepass(userId) {
  const user = db.getUser(userId);
  const claimed = new Set(db.getClaimedBattlepassTiers(userId));
  return {
    totalSpins: user?.total_spins || 0,
    claimedTierIds: [...claimed],
    tiers: BATTLEPASS_TIERS.map((tier) => ({
      ...tier,
      unlocked: (user?.total_spins || 0) >= tier.spinsRequired,
      claimed: claimed.has(tier.id),
    })),
  };
}

function getUserPublic(userId) {
  const user = db.getUser(userId);
  if (!user) return null;
  return { id: user.id, username: user.username, avatar: user.avatar };
}

app.get('/api/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Code manquant' });

  try {
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
      return res.status(400).json({ error: 'Echec authentification Discord' });
    }

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();
    if (!discordUser.id) return res.status(400).json({ error: 'Profil Discord indisponible' });

    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0', 10) % 5}.png`;

    db.upsertUser(discordUser.id, discordUser.username, avatarUrl);
    const token = generateToken(discordUser.id);
    res.redirect(`${CLIENT_URL}/?token=${token}`);
  } catch (error) {
    console.error('OAuth2 error:', error);
    res.status(500).json({ error: 'Erreur serveur lors de l authentification' });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });
  res.json({ user, upgrades: db.getUpgrades(req.userId) });
});

app.post('/api/spin', authMiddleware, (req, res) => {
  if (activeSpinRequests.has(req.userId)) {
    return res.status(429).json({ error: 'Spin deja en cours.' });
  }
  activeSpinRequests.add(req.userId);

  try {
    const user = db.getUser(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }

    const upgrades = db.getUpgrades(req.userId);
    const multiplierLevel = upgrades.multiplier || 0;
    const coinMultiplier = Math.pow(1.35, multiplierLevel);
    const magnetBonus = 1 + (upgrades.coin_magnet || 0) * 0.05;
    const wheelCount = 1 + (upgrades.extra_wheel || 0);
    const luckyLevel = upgrades.lucky || 0;
    const powerRollLevel = upgrades.power_roll || 0;
    const powerBoostLevel = upgrades.power_roll_boost || 0;
    const powerFreqLevel = upgrades.power_roll_freq || 0;
    const powerRollThreshold = Math.max(16, 36 - powerFreqLevel * 4);
    const powerRollMultiplier = 2.5 + powerBoostLevel * 0.75;
    const spinsBeforePower = user.spins_since_power || 0;
    const isPowerRoll = powerRollLevel > 0 && spinsBeforePower >= powerRollThreshold - 1;

    const comboLevel = upgrades.combo_streak || 0;
    const lastSpinTime = user.last_spin_at ? new Date(`${user.last_spin_at}Z`).getTime() : 0;
    let currentStreak = user.spin_streak || 0;
    if (Date.now() - lastSpinTime > 30_000) currentStreak = 0;
    const streakBonus = comboLevel > 0 ? 1 + currentStreak * 0.025 * comboLevel : 1;

    const diamondProc = (upgrades.diamond_rain || 0) > 0 && Math.random() < (upgrades.diamond_rain || 0) * 0.015;
    const jackpotProc = (upgrades.jackpot_chance || 0) > 0 && Math.random() < (upgrades.jackpot_chance || 0) * 0.004;

    let totalWin = 0;
    const results = [];

    for (let wheelIndex = 0; wheelIndex < wheelCount; wheelIndex++) {
      const segments = getServerSegments(wheelIndex, upgrades);
      let winIndex;

      if (luckyLevel > 0 && Math.random() < luckyLevel * 0.07) {
        const sorted = segments.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
        const topThird = sorted.slice(0, Math.ceil(sorted.length / 3));
        winIndex = topThird[Math.floor(Math.random() * topThird.length)].index;
      } else {
        winIndex = Math.floor(Math.random() * segments.length);
      }

      let earned = Math.floor(segments[winIndex] * coinMultiplier * magnetBonus * streakBonus);
      if (isPowerRoll) earned = Math.floor(earned * powerRollMultiplier);
      totalWin += earned;
      results.push({ wheelIndex, segmentIndex: winIndex, value: earned });
    }

    if (diamondProc) totalWin *= 2;
    if (jackpotProc) totalWin *= 10;

    db.addCoins(req.userId, totalWin);
    if (isPowerRoll) db.resetPowerCounter(req.userId);
    db.updateStreak(req.userId, currentStreak + 1);

    const freshUser = db.getUser(req.userId);
    res.json({
      results,
      totalWin,
      coins: freshUser.coins,
      totalEarned: freshUser.total_earned,
      totalSpins: freshUser.total_spins,
      isPowerRoll,
      powerRollMultiplier: isPowerRoll ? powerRollMultiplier : null,
      isDiamondRain: diamondProc,
      isJackpot: jackpotProc,
      comboStreak: currentStreak + 1,
      spinsSincePower: isPowerRoll ? 0 : freshUser.spins_since_power || 0,
      powerRollThreshold,
    });
  } finally {
    activeSpinRequests.delete(req.userId);
  }
});

app.post('/api/upgrade', authMiddleware, (req, res) => {
  const { upgradeId } = req.body;
  if (!upgradeId || !UPGRADES[upgradeId]) return res.status(400).json({ error: 'Upgrade invalide' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

  const upgrades = db.getUpgrades(req.userId);
  const currentLevel = upgrades[upgradeId] || 0;
  const upgrade = UPGRADES[upgradeId];
  if (currentLevel >= upgrade.maxLevel) return res.status(400).json({ error: 'Upgrade deja au max' });

  const cost = getUpgradeCost(upgradeId, currentLevel);
  if (user.coins < cost) return res.status(400).json({ error: 'Pas assez de Chiboub Coins' });

  db.setCoins(req.userId, user.coins - cost);
  db.setUpgrade(req.userId, upgradeId, currentLevel + 1);
  res.json({ user: db.getUser(req.userId), upgrades: db.getUpgrades(req.userId) });
});

app.get('/api/leaderboard', (req, res) => {
  res.json({
    leaderboard: db.getLeaderboard().map((player) => ({
      ...player,
      showcase_rarity_color: player.showcase_rarity ? rarityColor(player.showcase_rarity) : null,
    })),
  });
});

app.get('/api/cases', (req, res) => {
  res.json({
    cases: CASES.map((caseData) => ({
      id: caseData.id,
      name: caseData.name,
      icon: caseData.icon,
      price: caseData.price,
      color: caseData.color,
      isFree: caseData.price === 0,
      maxOpenAmount: caseData.price === 0 ? 1 : 5,
      cooldownMs: caseData.cooldownMs || null,
      drops: caseData.drops.map((drop) => ({
        rarity: drop.rarity,
        sellValue: RARITY_SELL_VALUES[drop.rarity] || 0,
        color: rarityColor(drop.rarity),
      })),
    })),
  });
});

app.post('/api/cases/open', authMiddleware, (req, res) => {
  const { caseId, amount: rawAmount } = req.body;
  const amount = Math.max(1, Math.min(5, Number(rawAmount) || 1));
  const caseData = CASES.find((item) => item.id === caseId);
  if (!caseData) return res.status(400).json({ error: 'Caisse invalide' });
  if (caseData.price === 0 && amount > 1) return res.status(400).json({ error: 'La caisse gratuite s ouvre une par une.' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

  if (caseData.price === 0) {
    const lastOpened = user.free_case_last_opened ? new Date(`${user.free_case_last_opened}Z`).getTime() : 0;
    const remainingMs = FREE_CASE_COOLDOWN_MS - (Date.now() - lastOpened);
    if (remainingMs > 0) {
      return res.status(429).json({ error: `Caisse gratuite disponible dans ${Math.ceil(remainingMs / 1000)}s.` });
    }
    db.markFreeCaseOpened(req.userId);
  }

  const totalCost = caseData.price * amount;
  if (user.coins < totalCost) return res.status(400).json({ error: 'Pas assez de Chiboub Coins' });
  if (totalCost > 0) db.setCoins(req.userId, user.coins - totalCost);

  const opener = db.getUser(req.userId);
  const results = [];
  for (let index = 0; index < amount; index++) {
    const item = createInventoryRecord(req.userId, buildInventoryItemFromRoll(rollSkinFromCase(caseData)));
    emitGlobalDrop(opener, item, caseData.name, 'case');
    results.push({ item, strip: generateStrip(caseData, item) });
  }

  res.json({
    items: results,
    amount,
    coins: db.getUser(req.userId).coins,
  });
});

app.get('/api/inventory', authMiddleware, (req, res) => {
  const inventory = db.getInventory(req.userId).map((item) => ({
    ...item,
    rarity_color: rarityColor(item.rarity),
  }));
  res.json({ inventory });
});

app.post('/api/inventory/sell', authMiddleware, (req, res) => {
  const { itemId } = req.body;
  if (!itemId) return res.status(400).json({ error: 'itemId manquant' });

  const item = db.getInventoryItem(itemId, req.userId);
  if (!item) return res.status(404).json({ error: 'Skin non trouve dans inventaire' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

  db.deleteInventoryItem(itemId, req.userId);
  const updatedUser = db.setCoins(req.userId, user.coins + item.sell_value);
  res.json({ coins: updatedUser.coins, soldValue: item.sell_value });
});

app.post('/api/inventory/sell-many', authMiddleware, (req, res) => {
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(Number).filter(Boolean) : [];
  if (itemIds.length === 0) return res.status(400).json({ error: 'Aucun skin a vendre' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });

  const result = db.sellInventoryItems(req.userId, itemIds);
  if (result.soldItemIds.length === 0) {
    return res.status(404).json({ error: 'Aucun skin valide a vendre' });
  }

  const updatedUser = db.setCoins(req.userId, user.coins + result.totalValue);
  res.json({
    coins: updatedUser.coins,
    soldValue: result.totalValue,
    soldItemIds: result.soldItemIds,
  });
});

app.post('/api/profile/showcase', authMiddleware, (req, res) => {
  const { itemId } = req.body;

  if (!itemId) {
    return res.json({ user: db.clearCurrentShowcase(req.userId) });
  }

  const item = db.getInventoryItem(itemId, req.userId);
  if (!item) return res.status(404).json({ error: 'Skin introuvable pour la vitrine' });

  const updatedUser = db.setShowcaseItem(req.userId, item);
  res.json({ user: updatedUser });
});

app.post('/api/case-battle/start', authMiddleware, (req, res) => {
  const { caseId } = req.body;
  const caseData = CASES.find((item) => item.id === caseId);
  if (!caseData) return res.status(400).json({ error: 'Caisse invalide' });

  const user = db.getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouve' });
  if (user.coins < caseData.price) return res.status(400).json({ error: 'Pas assez de Chiboub Coins' });

  db.setCoins(req.userId, user.coins - caseData.price);
  const playerSkin = buildInventoryItemFromRoll(rollSkinFromCase(caseData));
  const botSkin = buildInventoryItemFromRoll(rollSkinFromCase(caseData));
  const playerWins = playerSkin.sell_value >= botSkin.sell_value;

  if (playerWins) {
    createInventoryRecord(req.userId, playerSkin);
    createInventoryRecord(req.userId, botSkin);
    emitGlobalDrop(user, playerSkin, caseData.name, 'battle');
    emitGlobalDrop(user, botSkin, caseData.name, 'battle');
  }

  res.json({
    playerSkin,
    botSkin,
    playerWins,
    coins: db.getUser(req.userId).coins,
  });
});

app.get('/api/battlepass', authMiddleware, (req, res) => {
  res.json(serializeBattlepass(req.userId));
});

app.post('/api/battlepass/claim', authMiddleware, (req, res) => {
  const { tierId } = req.body;
  const tier = BATTLEPASS_TIERS.find((entry) => entry.id === tierId);
  if (!tier) return res.status(400).json({ error: 'Palier invalide' });

  const state = serializeBattlepass(req.userId);
  const target = state.tiers.find((entry) => entry.id === tierId);
  if (!target.unlocked) return res.status(400).json({ error: 'Palier non debloque' });
  if (target.claimed) return res.status(400).json({ error: 'Palier deja recupere' });

  db.addBattlepassClaim(req.userId, tierId);
  res.json({
    battlepass: serializeBattlepass(req.userId),
    reward: rewardBattlepass(req.userId, tier),
  });
});

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'], credentials: true },
});

const battleRooms = new Map();
const userSockets = new Map();
const tradeInvites = new Map();
const tradeRooms = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    const user = db.getUser(socket.userId);
    socket.username = user?.username || 'Joueur';
    socket.avatar = user?.avatar || '';
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

function sanitizeRoom(room) {
  return {
    id: room.id,
    totalPrice: room.totalPrice,
    rounds: room.rounds,
    creator: room.creator ? { id: room.creator.id, username: room.creator.username, avatar: room.creator.avatar } : null,
    joiner: room.joiner ? { id: room.joiner.id, username: room.joiner.username, avatar: room.joiner.avatar } : null,
    status: room.status,
  };
}

function getOpenRooms() {
  const rooms = [];
  for (const room of battleRooms.values()) {
    if (room.status === 'waiting') rooms.push(sanitizeRoom(room));
  }
  return rooms;
}

function sanitizeTradeRoom(room) {
  return {
    id: room.id,
    users: room.userIds.map((userId) => getUserPublic(userId)),
    offers: Object.fromEntries(
      room.userIds.map((userId) => [
        userId,
        room.offers[userId]
          .map((itemId) => {
            const item = db.getInventoryItem(itemId);
            return item ? { ...item, rarity_color: rarityColor(item.rarity) } : null;
          })
          .filter(Boolean),
      ])
    ),
    ready: room.ready,
    confirmed: room.confirmed,
  };
}

function broadcastTradeRoom(room) {
  io.to(room.id).emit('trade:update', sanitizeTradeRoom(room));
}

io.on('connection', (socket) => {
  userSockets.set(socket.userId, socket.id);
  socket.join(`user:${socket.userId}`);
  socket.emit('global:drops_init', { drops: liveDrops });
  io.emit('trade:online_users', { users: [...userSockets.keys()] });

  socket.on('battle:create', ({ caseIds }) => {
    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return socket.emit('battle:error', { error: 'Aucune caisse selectionnee' });
    }

    const casesData = [];
    let totalPrice = 0;
    for (const caseId of caseIds) {
      const caseData = CASES.find((item) => item.id === caseId);
      if (!caseData) return socket.emit('battle:error', { error: `Caisse invalide: ${caseId}` });
      if (caseData.price === 0) return socket.emit('battle:error', { error: 'La caisse gratuite est exclue des battles.' });
      casesData.push(caseData);
      totalPrice += caseData.price;
    }

    const user = db.getUser(socket.userId);
    if (!user || user.coins < totalPrice) {
      return socket.emit('battle:error', { error: 'Pas assez de CC pour la totalite' });
    }

    db.setCoins(socket.userId, user.coins - totalPrice);
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const room = {
      id: roomId,
      totalPrice,
      rounds: casesData.map((caseData) => ({
        caseId: caseData.id,
        caseName: caseData.name,
        caseIcon: caseData.icon,
        caseColor: caseData.color,
        price: caseData.price,
      })),
      creator: { id: socket.userId, username: socket.username, avatar: socket.avatar, socketId: socket.id },
      joiner: null,
      status: 'waiting',
    };
    battleRooms.set(roomId, room);
    socket.join(roomId);
    socket.emit('battle:created', { room: sanitizeRoom(room) });
    socket.emit('battle:coins', { coins: db.getUser(socket.userId).coins });
    io.emit('battle:lobby', { rooms: getOpenRooms() });
  });

  socket.on('battle:join', ({ roomId }) => {
    const room = battleRooms.get(roomId);
    if (!room) return socket.emit('battle:error', { error: 'Room introuvable' });
    if (room.status !== 'waiting') return socket.emit('battle:error', { error: 'Battle deja lancee' });
    if (room.creator.id === socket.userId) return socket.emit('battle:error', { error: 'Tu ne peux pas rejoindre ta propre room' });

    const user = db.getUser(socket.userId);
    if (!user || user.coins < room.totalPrice) return socket.emit('battle:error', { error: 'Pas assez de CC' });

    db.setCoins(socket.userId, user.coins - room.totalPrice);
    room.joiner = { id: socket.userId, username: socket.username, avatar: socket.avatar, socketId: socket.id };
    room.status = 'rolling';
    socket.join(roomId);
    socket.emit('battle:coins', { coins: db.getUser(socket.userId).coins });
    io.emit('battle:lobby', { rooms: getOpenRooms() });
    io.to(roomId).emit('battle:start_all', { room: sanitizeRoom(room) });

    const battleLoop = async () => {
      let creatorTotalValue = 0;
      let joinerTotalValue = 0;
      const creatorWinnings = [];
      const joinerWinnings = [];

      await new Promise((resolve) => setTimeout(resolve, 1000));

      for (let index = 0; index < room.rounds.length; index++) {
        const round = room.rounds[index];
        const caseData = CASES.find((item) => item.id === round.caseId);
        const creatorItem = buildInventoryItemFromRoll(rollSkinFromCase(caseData));
        const joinerItem = buildInventoryItemFromRoll(rollSkinFromCase(caseData));
        creatorTotalValue += creatorItem.sell_value;
        joinerTotalValue += joinerItem.sell_value;
        creatorWinnings.push(creatorItem);
        joinerWinnings.push(joinerItem);

        io.to(roomId).emit('battle:round_start', {
          roundIndex: index,
          creatorStrip: generateStrip(caseData, creatorItem),
          joinerStrip: generateStrip(caseData, joinerItem),
        });

        await new Promise((resolve) => setTimeout(resolve, 4000));

        io.to(roomId).emit('battle:round_result', {
          roundIndex: index,
          creatorSkin: creatorItem,
          joinerSkin: joinerItem,
          creatorRoundWins: creatorItem.sell_value >= joinerItem.sell_value,
        });

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      const creatorWins = creatorTotalValue >= joinerTotalValue;
      const winnerId = creatorWins ? room.creator.id : room.joiner.id;
      const winnerUser = db.getUser(winnerId);

      for (const item of [...creatorWinnings, ...joinerWinnings]) {
        createInventoryRecord(winnerId, item);
        emitGlobalDrop(winnerUser, item, 'Case Battle', 'battle');
      }

      room.status = 'done';
      io.to(roomId).emit('battle:finish', {
        creatorTotalValue,
        joinerTotalValue,
        winnerId,
        creatorWins,
      });
      setTimeout(() => battleRooms.delete(roomId), 30_000);
    };

    battleLoop().catch((error) => {
      console.error('Battle loop error:', error);
      io.to(roomId).emit('battle:error', { error: 'Erreur serveur durant la battle' });
    });
  });

  socket.on('battle:getLobby', () => {
    socket.emit('battle:lobby', { rooms: getOpenRooms() });
  });

  socket.on('battle:cancel', ({ roomId }) => {
    const room = battleRooms.get(roomId);
    if (!room || room.creator.id !== socket.userId || room.status !== 'waiting') return;
    const user = db.getUser(socket.userId);
    if (user) db.setCoins(socket.userId, user.coins + room.totalPrice);
    battleRooms.delete(roomId);
    socket.emit('battle:cancelled', { roomId });
    socket.emit('battle:coins', { coins: db.getUser(socket.userId).coins });
    io.emit('battle:lobby', { rooms: getOpenRooms() });
  });

  socket.on('trade:invite', ({ userId }) => {
    if (!userId || userId === socket.userId) return;
    const targetSocketId = userSockets.get(userId);
    if (!targetSocketId) return socket.emit('trade:error', { error: 'Joueur hors ligne' });
    tradeInvites.set(`${socket.userId}:${userId}`, { from: socket.userId, to: userId, createdAt: Date.now() });
    io.to(targetSocketId).emit('trade:invite_received', { from: getUserPublic(socket.userId) });
  });

  socket.on('trade:accept', ({ userId }) => {
    const inviteKey = `${userId}:${socket.userId}`;
    if (!tradeInvites.has(inviteKey)) return socket.emit('trade:error', { error: 'Invitation invalide' });
    tradeInvites.delete(inviteKey);

    const roomId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const room = {
      id: roomId,
      userIds: [userId, socket.userId],
      offers: { [userId]: [], [socket.userId]: [] },
      ready: { [userId]: false, [socket.userId]: false },
      confirmed: { [userId]: false, [socket.userId]: false },
    };
    tradeRooms.set(roomId, room);

    const otherSocketId = userSockets.get(userId);
    if (otherSocketId) io.sockets.sockets.get(otherSocketId)?.join(roomId);
    socket.join(roomId);
    io.to(roomId).emit('trade:started', sanitizeTradeRoom(room));
  });

  socket.on('trade:add_item', ({ roomId, inventoryId }) => {
    const room = tradeRooms.get(roomId);
    if (!room || !room.userIds.includes(socket.userId)) return;
    const item = db.getInventoryItem(inventoryId, socket.userId);
    if (!item) return socket.emit('trade:error', { error: 'Item invalide' });
    if (!room.offers[socket.userId].includes(inventoryId)) room.offers[socket.userId].push(inventoryId);
    room.userIds.forEach((userId) => {
      room.ready[userId] = false;
      room.confirmed[userId] = false;
    });
    broadcastTradeRoom(room);
  });

  socket.on('trade:remove_item', ({ roomId, inventoryId }) => {
    const room = tradeRooms.get(roomId);
    if (!room || !room.userIds.includes(socket.userId)) return;
    room.offers[socket.userId] = room.offers[socket.userId].filter((id) => id !== inventoryId);
    room.userIds.forEach((userId) => {
      room.ready[userId] = false;
      room.confirmed[userId] = false;
    });
    broadcastTradeRoom(room);
  });

  socket.on('trade:ready', ({ roomId }) => {
    const room = tradeRooms.get(roomId);
    if (!room || !room.userIds.includes(socket.userId)) return;
    room.ready[socket.userId] = !room.ready[socket.userId];
    room.userIds.forEach((userId) => {
      room.confirmed[userId] = false;
    });
    broadcastTradeRoom(room);
  });

  socket.on('trade:confirm', ({ roomId }) => {
    const room = tradeRooms.get(roomId);
    if (!room || !room.userIds.includes(socket.userId)) return;
    const [userAId, userBId] = room.userIds;
    if (!room.ready[userAId] || !room.ready[userBId]) {
      return socket.emit('trade:error', { error: 'Les deux joueurs doivent etre prets.' });
    }

    room.confirmed[socket.userId] = true;
    broadcastTradeRoom(room);

    if (room.confirmed[userAId] && room.confirmed[userBId]) {
      try {
        db.swapTradeItems(userAId, room.offers[userAId], userBId, room.offers[userBId]);
        io.to(room.id).emit('trade:complete', {
          roomId: room.id,
          users: room.userIds.map((userId) => getUserPublic(userId)),
        });
        tradeRooms.delete(room.id);
      } catch (error) {
        console.error('Trade complete error:', error);
        io.to(room.id).emit('trade:error', { error: 'Echec de validation de l echange.' });
      }
    }
  });

  socket.on('trade:decline', ({ userId }) => {
    io.to(`user:${userId}`).emit('trade:declined', { user: getUserPublic(socket.userId) });
  });

  socket.on('disconnect', () => {
    userSockets.delete(socket.userId);
    io.emit('trade:online_users', { users: [...userSockets.keys()] });
  });
});

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log(`ChiboubRoll server running on http://localhost:${PORT}`);
  console.log(`Discord login: http://localhost:${PORT}/api/auth/discord`);
});
