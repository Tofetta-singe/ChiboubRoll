# ChiboubRoll Phase 3: Trade, Floats, Global Feed, Economy

## 1. Economy, Rate Limits, & Golden Wheel Removal
- **Backend ([server.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/server.js), [db.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/db.js)) & Frontend ([WheelGame.jsx](file:///c:/Users/RedDi/Desktop/ChiboubRoll/client/src/components/WheelGame.jsx), [Shop.jsx](file:///c:/Users/RedDi/Desktop/ChiboubRoll/client/src/components/Shop.jsx))**:
  - Remove all references to `golden_wheel`.
  - Boost base wheel array to `[5, 5, 5, 10, 5, 5, 15, 5, 5, 10, 5, 25]` to increase early game earnings.
  - **Exploit Fix**: Add a strict `last_spin_time` timestamp to `users` or a memory map in [server.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/server.js) (`POST /api/wheel/spin`). If the difference is < `1.5s` (or appropriate wheel animation time limit), reject the spin request to prevent auto-clicker spamming.

## 2. Float Values (Wear)
- **Database ([db.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/db.js))**: Add `float_value` (REAL) to `inventory` table. Use an `ALTER TABLE` try-catch to update existing DBs.
- **Backend ([server.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/server.js))**: 
  - When rolling a skin, generate a random float `0.00 - 1.00`.
  - Apply value multipliers based on wear:
    - Factory New (`0.00-0.07`): x2.5
    - Minimal Wear (`0.07-0.15`): x1.5
    - Field-Tested (`0.15-0.38`): x1.0
    - Well-Worn (`0.38-0.45`): x0.8
    - Battle-Scarred (`0.45-1.00`): x0.5
  - Store float in DB and return to client.
- **Frontend**: Show float value and wear condition label (FN, MW, FT, WW, BS) on inventory cards and result screens.

## 3. Battlespass & Free Case
- **Free Case**: A new case `Caisse Gratuite` priced at 0 CC. Rate limited to 1 per 20 seconds. Store `free_case_last_opened` on the user DB to enforce.
- **Battlepass System**: 
  - Tracks `total_spins` to unlock tiers. 
  - Store claimed tiers in a new table `battlepass_claims` or an array string on `users`.
  - Frontend (`Battlepass.jsx`): A timeline of rewards (CC + specific rarity skins) unlocked every X spins.

## 4. More Cases, Multi-Opening, and Better Profitability
- **Backend ([server.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/server.js))**:
  - Tweak all existing drop rates to be slightly more profitable (shift 5-10% from lowest tier to higher tiers).
  - Add ~5-10 more cases to `CASES` array with varied prices and drop rates. (Hide the % chances in the UI descriptions per user request).
  - Update `POST /api/cases/open` to accept an `amount` parameter (up to 5). It deducts `price * amount` and returns an array of results with generated strips.
- **Frontend ([CaseOpening.jsx](file:///c:/Users/RedDi/Desktop/ChiboubRoll/client/src/components/CaseOpening.jsx))**:
  - Enlarge the UI to fill the screen (similar to CaseBattle).
  - Add quantity buttons (1x, 2x, 3x, 4x, 5x).
  - Render multiple strips stacking vertically when doing a multi-unbox.

## 5. Global Live Drop Feed
- **Backend ([server.js](file:///c:/Users/RedDi/Desktop/ChiboubRoll/server/server.js))**: Whenever a user unboxes a rare skin (Case Opening, Battlepass, or Battle), `io.emit('global:drop', { username, avatar, skin, rarity, caseName })`.
- **Frontend (`LiveDropFeed.jsx`)**: A fixed component on the left side of the screen displaying a rolling feed of recent unboxings. 

## 6. Player-to-Player Trading (Socket.IO)
This is a complex real-time feature.
- **Lobby/Feed Integration**: Click a user's name in Live Feed -> "Invite to Trade".
- **Backend Socket Events**:
  - `trade:invite(userId)`
  - `trade:invite_received` -> Client shows popup.
  - `trade:accept(userId)` -> Server creates a Trade Room.
  - `trade:add_item(inventoryId)`, `trade:remove_item(inventoryId)` -> validates ownership, emits to room.
  - `trade:ready` -> When both ready, `trade:confirm`.
  - Server executes swap in DB (`UPDATE inventory SET user_id = ?`) and emits `trade:complete`.
- **Frontend (`TradePanel.jsx`)**:
  - UI showing "My Offer" vs "Their Offer".
  - Mini inventory selector to add skins to trade.
  - Logic to ready up and confirm.
