const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chiboubroll.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar TEXT,
    coins INTEGER DEFAULT 100,
    total_earned INTEGER DEFAULT 0,
    total_spins INTEGER DEFAULT 0,
    spins_since_power INTEGER DEFAULT 0,
    spin_streak INTEGER DEFAULT 0,
    last_spin_at TEXT,
    free_case_last_opened TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS upgrades (
    user_id TEXT NOT NULL,
    upgrade_id TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, upgrade_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    skin_id TEXT NOT NULL,
    skin_name TEXT NOT NULL,
    skin_image TEXT,
    rarity TEXT NOT NULL,
    sell_value INTEGER NOT NULL,
    float_value REAL DEFAULT 0.5,
    wear_name TEXT DEFAULT 'Field-Tested',
    wear_short TEXT DEFAULT 'FT',
    obtained_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS battlepass_claims (
    user_id TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, tier_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

try { db.exec('ALTER TABLE users ADD COLUMN spins_since_power INTEGER DEFAULT 0'); } catch { }
try { db.exec('ALTER TABLE users ADD COLUMN spin_streak INTEGER DEFAULT 0'); } catch { }
try { db.exec('ALTER TABLE users ADD COLUMN last_spin_at TEXT'); } catch { }
try { db.exec('ALTER TABLE users ADD COLUMN free_case_last_opened TEXT'); } catch { }
try { db.exec('ALTER TABLE inventory ADD COLUMN float_value REAL DEFAULT 0.5'); } catch { }
try { db.exec('ALTER TABLE inventory ADD COLUMN wear_name TEXT DEFAULT "Field-Tested"'); } catch { }
try { db.exec('ALTER TABLE inventory ADD COLUMN wear_short TEXT DEFAULT "FT"'); } catch { }

const stmts = {
  getUser: db.prepare('SELECT * FROM users WHERE id = ?'),

  upsertUser: db.prepare(`
    INSERT INTO users (id, username, avatar)
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      avatar = excluded.avatar,
      updated_at = datetime('now')
  `),

  updateCoinsForSpin: db.prepare(`
    UPDATE users
    SET coins = coins + ?,
        total_earned = total_earned + ?,
        total_spins = total_spins + 1,
        spins_since_power = spins_since_power + 1,
        updated_at = datetime('now')
    WHERE id = ?
  `),

  resetPowerCounter: db.prepare(`
    UPDATE users SET spins_since_power = 0, updated_at = datetime('now') WHERE id = ?
  `),

  updateStreak: db.prepare(`
    UPDATE users
    SET spin_streak = ?, last_spin_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),

  setCoins: db.prepare(`
    UPDATE users SET coins = ?, updated_at = datetime('now') WHERE id = ?
  `),

  setFreeCaseLastOpened: db.prepare(`
    UPDATE users SET free_case_last_opened = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `),

  getUpgrades: db.prepare('SELECT upgrade_id, level FROM upgrades WHERE user_id = ?'),

  setUpgrade: db.prepare(`
    INSERT INTO upgrades (user_id, upgrade_id, level)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, upgrade_id) DO UPDATE SET level = excluded.level
  `),

  getLeaderboard: db.prepare(`
    SELECT id, username, avatar, coins, total_earned, total_spins
    FROM users
    ORDER BY total_earned DESC
    LIMIT 10
  `),

  addInventoryItem: db.prepare(`
    INSERT INTO inventory (
      user_id, skin_id, skin_name, skin_image, rarity, sell_value, float_value, wear_name, wear_short
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  getInventory: db.prepare(`
    SELECT * FROM inventory WHERE user_id = ? ORDER BY obtained_at DESC, id DESC
  `),

  getInventoryItemForUser: db.prepare('SELECT * FROM inventory WHERE id = ? AND user_id = ?'),
  getInventoryItemById: db.prepare('SELECT * FROM inventory WHERE id = ?'),
  deleteInventoryItem: db.prepare('DELETE FROM inventory WHERE id = ? AND user_id = ?'),
  transferInventoryItem: db.prepare('UPDATE inventory SET user_id = ? WHERE id = ?'),

  getClaimedBattlepassTiers: db.prepare('SELECT tier_id FROM battlepass_claims WHERE user_id = ?'),
  addBattlepassClaim: db.prepare(`
    INSERT INTO battlepass_claims (user_id, tier_id)
    VALUES (?, ?)
    ON CONFLICT(user_id, tier_id) DO NOTHING
  `),
};

const swapTradeItemsTx = db.transaction((userAId, userAItemIds, userBId, userBItemIds) => {
  for (const itemId of userAItemIds) {
    const item = stmts.getInventoryItemForUser.get(itemId, userAId);
    if (!item) throw new Error(`Trade validation failed for item ${itemId}`);
  }
  for (const itemId of userBItemIds) {
    const item = stmts.getInventoryItemForUser.get(itemId, userBId);
    if (!item) throw new Error(`Trade validation failed for item ${itemId}`);
  }

  for (const itemId of userAItemIds) {
    stmts.transferInventoryItem.run(userBId, itemId);
  }
  for (const itemId of userBItemIds) {
    stmts.transferInventoryItem.run(userAId, itemId);
  }
});

module.exports = {
  getUser(id) {
    return stmts.getUser.get(id);
  },

  upsertUser(id, username, avatar) {
    stmts.upsertUser.run(id, username, avatar);
    return stmts.getUser.get(id);
  },

  addCoins(userId, amount) {
    stmts.updateCoinsForSpin.run(amount, Math.max(0, amount), userId);
    return stmts.getUser.get(userId);
  },

  resetPowerCounter(userId) {
    stmts.resetPowerCounter.run(userId);
  },

  updateStreak(userId, streak) {
    stmts.updateStreak.run(streak, userId);
  },

  setCoins(userId, coins) {
    stmts.setCoins.run(coins, userId);
    return stmts.getUser.get(userId);
  },

  markFreeCaseOpened(userId) {
    stmts.setFreeCaseLastOpened.run(userId);
    return stmts.getUser.get(userId);
  },

  getUpgrades(userId) {
    const rows = stmts.getUpgrades.all(userId);
    const obj = {};
    rows.forEach((row) => {
      obj[row.upgrade_id] = row.level;
    });
    return obj;
  },

  setUpgrade(userId, upgradeId, level) {
    stmts.setUpgrade.run(userId, upgradeId, level);
  },

  getLeaderboard() {
    return stmts.getLeaderboard.all();
  },

  addInventoryItem(userId, item) {
    const info = stmts.addInventoryItem.run(
      userId,
      item.skin_id,
      item.skin_name,
      item.skin_image,
      item.rarity,
      item.sell_value,
      item.float_value,
      item.wear_name,
      item.wear_short
    );
    return Number(info.lastInsertRowid);
  },

  getInventory(userId) {
    return stmts.getInventory.all(userId);
  },

  getInventoryItem(itemId, userId) {
    if (userId) return stmts.getInventoryItemForUser.get(itemId, userId);
    return stmts.getInventoryItemById.get(itemId);
  },

  deleteInventoryItem(itemId, userId) {
    return stmts.deleteInventoryItem.run(itemId, userId);
  },

  getClaimedBattlepassTiers(userId) {
    return stmts.getClaimedBattlepassTiers.all(userId).map((row) => row.tier_id);
  },

  addBattlepassClaim(userId, tierId) {
    stmts.addBattlepassClaim.run(userId, tierId);
  },

  swapTradeItems(userAId, userAItemIds, userBId, userBItemIds) {
    swapTradeItemsTx(userAId, userAItemIds, userBId, userBItemIds);
  },

  close() {
    db.close();
  },
};
