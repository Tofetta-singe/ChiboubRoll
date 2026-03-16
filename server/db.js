const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chiboubroll.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ===== CREATE TABLES =====
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL,
    avatar        TEXT,
    coins         INTEGER DEFAULT 100,
    total_earned  INTEGER DEFAULT 0,
    total_spins   INTEGER DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS upgrades (
    user_id       TEXT NOT NULL,
    upgrade_id    TEXT NOT NULL,
    level         INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, upgrade_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ===== PREPARED STATEMENTS =====
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

  updateCoins: db.prepare(`
    UPDATE users
    SET coins = coins + ?, total_earned = total_earned + ?, total_spins = total_spins + 1, updated_at = datetime('now')
    WHERE id = ?
  `),

  setCoins: db.prepare(`
    UPDATE users SET coins = ?, updated_at = datetime('now') WHERE id = ?
  `),

  getUpgrades: db.prepare('SELECT upgrade_id, level FROM upgrades WHERE user_id = ?'),

  setUpgrade: db.prepare(`
    INSERT INTO upgrades (user_id, upgrade_id, level)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, upgrade_id) DO UPDATE SET level = excluded.level
  `),

  getLeaderboard: db.prepare(`
    SELECT id, username, avatar, coins, total_earned, total_spins
    FROM users ORDER BY total_earned DESC LIMIT 10
  `),
};

// ===== EXPORTED HELPERS =====
module.exports = {
  getUser(id) {
    return stmts.getUser.get(id);
  },

  upsertUser(id, username, avatar) {
    stmts.upsertUser.run(id, username, avatar);
    return stmts.getUser.get(id);
  },

  addCoins(userId, amount) {
    stmts.updateCoins.run(amount, Math.max(0, amount), userId);
    return stmts.getUser.get(userId);
  },

  setCoins(userId, coins) {
    stmts.setCoins.run(coins, userId);
    return stmts.getUser.get(userId);
  },

  getUpgrades(userId) {
    const rows = stmts.getUpgrades.all(userId);
    const obj = {};
    rows.forEach(r => { obj[r.upgrade_id] = r.level; });
    return obj;
  },

  setUpgrade(userId, upgradeId, level) {
    stmts.setUpgrade.run(userId, upgradeId, level);
  },

  getLeaderboard() {
    return stmts.getLeaderboard.all();
  },

  close() {
    db.close();
  }
};
