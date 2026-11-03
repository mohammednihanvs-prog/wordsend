# ⚡ WORDSEND - Real-Time Multiplayer Word Chain Game

A fast-paced, juicy, cartoonish real-time multiplayer word chain game that runs directly in the browser! Players take turns chaining words from a dynamic base word card, racing to reach the winning score first.

---

## 🎮 Game Concept & Rules

- **Rooms**: Up to 8 players join a room with a 4-letter room code.
- **Base Word**: The server gives a random starting word (e.g. `base`).
- **Turn System**: Players take turns. On your turn, submit a word that connects with the base word (e.g. `ball` ➔ `baseball`). Then `ball` becomes the new base word for the next player!
- **Word Chain Modes**:
  1. **Compound Word Chain** (Default): Submitted word must form a valid compound word with the base word (forward or backward, e.g. `base` + `ball` = `baseball`, `ball` + `room` = `ballroom`, `room` + `mate` = `roommate`).
  2. **First/Last Letter (Shiritori)**: Word must start with the last letter of the base word (e.g. `base` ➔ `elephant`).
  3. **Free Dictionary**: Any valid unused English word.
- **Scoring**:
  - **Correct Word**: `+1 point`. The word becomes the new base word and the turn passes.
  - **Incorrect Word**: `0 points`. Turn passes and base word stays the same for the next player.
  - **Skip / Timeout**: `-1 point`. Player presses Skip or the turn timer runs out. Turn passes and base word stays the same.
  - **Scores can go negative**.
- **Win Condition**: The first player to reach the **Winning Score** wins immediately!
- **Anti-Stall Rule**: If all players in 1 full cycle skip or answer wrongly, the server automatically picks a fresh random base word.
- **No Word Reuse**: No word can be repeated within the same game.
- **Word Validation**: Offline English dictionary validation using `an-array-of-english-words` (over 270,000 words, no external APIs).

---

## ⚙️ Configuration & Tunable Settings

All scoring values, timers, limits, and defaults are centralized in **[`config.js`](file:///c:/Projects/Wordsend/config.js)**:
- `DEFAULT_WINNING_SCORE`: `10` (customizable in lobby from `3` to `50`)
- `DEFAULT_TURN_TIMER`: `10s` (customizable in lobby from `5s` to `30s`)
- `SCORING.CORRECT`: `+1`
- `SCORING.INCORRECT`: `0`
- `SCORING.SKIP`: `-1`
- `MIN_PLAYERS`: `2`
- `MAX_PLAYERS`: `8`
- `RULES.ANTI_STALL_CYCLES`: `1`

---

## 🚀 Running Locally

### 1. Requirements
- Node.js (v18 or higher recommended)
- npm

### 2. Install & Start
```bash
npm install
npm start
```

### 3. Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

To test with multiple players locally, open 2 or 3 separate browser tabs or an Incognito window, enter different nicknames, create a room in Tab 1, and join using the 4-letter room code in the other tabs.

---

## 📶 How Friends on the Same Wi-Fi Can Join (LAN Play)

You can play with friends and family on phones, tablets, or laptops connected to the same home/office Wi-Fi network:

1. Start the game on your computer:
   ```bash
   npm start
   ```
2. The terminal displays your local network address, for example:
   ```
   ===============================================
    Wordsend Word Chain Game is running!
    Local:   http://localhost:3000
    Network: http://192.168.1.45:3000
   ===============================================
   ```
3. Have your friends connect their phones/laptops to the same Wi-Fi.
4. Have them open their mobile browser (Safari, Chrome) and type your network address:
   ```
   http://<YOUR-IP>:3000  (e.g. http://192.168.1.45:3000)
   ```
5. Enter nicknames and enter the room code to start playing together!

---

## 🌐 Deploying Free to the Web (e.g. Render)

To let anyone in the world play without running a local server, deploy it for free on **[Render](https://render.com/)**:

### Option A: Deploy via GitHub (Recommended)
1. Push this project to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Wordsend game"
   git branch -M main
   git remote add origin https://github.com/<your-username>/wordsend.git
   git push -u origin main
   ```
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** ➔ **Web Service**.
4. Select your `wordsend` repository.
5. Configure the service:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Click **Create Web Service**.
7. Once deployed, Render will provide a free live URL (e.g. `https://wordsend.onrender.com`). Share the link with friends to play anytime!

### Option B: Deploy to Railway / Fly.io / Glitch
- **Railway**: Click New Project ➔ Deploy from GitHub repo ➔ Railway automatically detects Node.js and starts `npm start`.
- **Glitch**: Import directly from GitHub or upload files to a new Node project.

---

## 🎨 UI & Features Highlights

- **Juicy & Clicky UI**: Chunky 3D buttons that physically squish down when clicked (`transform: translateY`).
- **Base Word Card**: 3D pop/flip animation whenever the base word updates.
- **Circular Countdown Timer**: SVG ring with real-time gradient color shifting (Green ➔ Yellow ➔ Red) and urgent pulsing in the final 3 seconds.
- **Score Feedback Animations**:
  - `+1 ✨`: Floating green sparkle toast.
  - `0 💨`: Grey shake toast with error explanation.
  - `-1 💔`: Red wobble toast on skip or timeout.
- **Web Audio API Sound Effects**: Crisp clicks, countdown clock ticks, major chord victory chimes, cartoon buzzers, and skip boops—**100% procedurally synthesized with zero audio asset files needed**. Includes a persistent mute toggle button.
- **Live Reordering Scoreboard**: Animated rows with colorful progress bars towards the winning score.
- **Quick Reactions**: Send live emojis (`🔥`, `😂`, `😱`, `👏`) with floating bubble animations across all players' screens.
- **Active Player Typing Indicator**: Real-time bouncing dot indicator when the active player is typing.
- **Celebratory Confetti**: 60fps canvas confetti cannon explosion when a player wins.
- **Graceful Disconnection Handling**: If an active player leaves, their turn is skipped with 0 penalty, host reassigns automatically, and empty rooms are cleaned up.

---

## 🧪 Testing

Run the automated multi-player end-to-end test suite:
```bash
npm test
```
This tests room creation, multi-client joining, host settings, turn rotation, correct words, incorrect words, skips, reused words, anti-stall reset, turn timeouts, and victory conditions.
