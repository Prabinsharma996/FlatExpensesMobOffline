# FlatSplit (Offline-First & Local Wi-Fi P2P Sync)

A fast, private, offline-first shared flat-expense tracker & chore manager. **No external database or cloud backend required.** All data is stored locally on each roommate's phone and synchronizes peer-to-peer over the local Wi-Fi network (or hotspot) when connected.

## Key Features

- 📱 **100% Offline-First**: Works anywhere without internet or backend servers. All data (flats, books, expenses, balances, chores, tasks, shopping lists, house polls, budgets) persists directly on the device.
- 📶 **Wi-Fi Peer-to-Peer Sync**: When roommates connect to the same Wi-Fi (or mobile hotspot), devices can discover each other on the local network subnet and synchronize all changes in real time.
- ⚡ **Instant Sync Codes & QR Sharing**: 1-tap copy/paste sync payload or share backup files via WhatsApp, AirDrop, Telegram, or Nearby Share.
- 🧮 **Exact Math & Debt Simplification**: Built-in greedy min-cash-flow algorithm reduces debts to the absolute minimum transactions (e.g. "A pays C ₹250" instead of everyone paying everyone). Supports Equal, Exact Amount, and Percentage-based splits with paise/cents precision.
- 🧹 **Chores & Fair Duty Roster**: Auto-rotating chore schedule, fair task assignment based on past workloads, and wheel-of-fate task randomizer.
- 🛒 **Shared Shopping List & Polls**: Collective grocery checklist and house voting.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- Expo CLI (`npm install -g expo-cli` or `npx expo`)

### Running the Mobile App

1. Navigate to the `mobile` folder:
   ```bash
   cd mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```
4. Scan the QR code using the **Expo Go** app on your Android/iOS phone or press `a` for Android Emulator / `w` for Web.

---

## How Local Wi-Fi Sync Works

1. **Local Storage**: Each device writes to its own persistent local database.
2. **Wi-Fi Subnet Discovery**: Open **Wi-Fi Sync** on your phone (from the Flats screen or Flat Features tab) to scan the local Wi-Fi subnet for roommates.
3. **Direct Peer Sync**:
   - Tap **"Auto-Find Roommates on Wi-Fi"** or enter your roommate's local Wi-Fi IP.
   - Or tap **"Copy Instant Sync Code"** / **"Share Backup File"** to send the flat data directly over messaging apps without any server.
4. **Smart Conflict Resolution**: Updates are merged using Last-Write-Wins timestamps and set-union merging so no expense or task is lost.
