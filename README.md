# 🎰 ChiboubRoll

A Cookie Clicker-style RNG wheel game where you spin to earn **Chiboub Coins** and buy upgrades!

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | Express.js, Node.js |
| Database | SQLite (better-sqlite3) |
| Auth | Discord OAuth2 + JWT |

## ⚡ Quick Start

### 1. Setup Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a **New Application** → name it `ChiboubRoll`
3. Go to **OAuth2** → copy `CLIENT ID` and `CLIENT SECRET`
4. Add redirect URL: `http://localhost:3001/auth/discord/callback`

### 2. Configure Environment

```bash
# At project root, copy .env.example to .env
copy .env.example .env
```

Edit `.env` with your Discord credentials:
```
DISCORD_CLIENT_ID=your_client_id
DISCORD_CLIENT_SECRET=your_client_secret
JWT_SECRET=a-random-secret-string
```

### 3. Install & Run Server

```bash
cd server
npm install
npm run dev
```

Server starts on `http://localhost:3001`

### 4. Install & Run Client

```bash
cd client
npm install
npm run dev
```

Client starts on `http://localhost:5173`

### 5. Play!

Open `http://localhost:5173` → Login with Discord → Spin! 🎰

## 🎮 Features

- 🎡 **Spinning Wheel** — Canvas-based animated wheel
- 🪙 **Chiboub Coins** — Earn coins with each spin
- 🛒 **Shop** — 8 upgrades including:
  - Extra wheels (up to 4 simultaneous)
  - Coin multipliers (up to x32)
  - Auto-spin
  - Golden wheel (x3 values)
  - Lucky odds, Turbo spin, Mega segments, Coin magnet
- 🔐 **Discord Login** — Save progress with your Discord account
- 🏆 **Leaderboard** — Compete with other players
- 💾 **Persistent** — All data saved in SQLite

## 📁 Project Structure

```
ChiboubRoll/
├── server/
│   ├── server.js           # Express + OAuth2 + API
│   ├── db.js               # SQLite setup + helpers
│   ├── middleware/auth.js   # JWT middleware
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # Auth context
│   │   └── lib/            # API client
│   ├── vite.config.js
│   └── tailwind.config.js
├── .env.example
└── README.md
```
