# Lose the Tail

A 5-minute first-person voxel game that takes someone from zero to understanding their first shielded Zcash transaction, then hands them off to do it for real.

**Play:** https://lose-the-tail.vercel.app · ZECATHON Wildcard (onboarding) entry

You just got paid 5 ZEC to a public address. A crew called the Tailors watches the public ledger and saw it. Survive one night in Ledger City using a practice wallet on the phone in your hand.

| In the game | Real Zcash concept |
|---|---|
| Create a wallet, back up 24 words, pick three back | Wallet setup, seed safety |
| Payday lands in your transparent pocket; your face hits the billboard, drones lock on, trace countdown | Transparent addresses are public: address, amount, time |
| Hold **Shield**: hood goes up, the drones lose you | Shielding moves funds into the shielded pool |
| Pay the café with a private note | Shielded send + encrypted memo |
| Show Mika your address (she refuses the public one) | Receiving to a shielded (u1…) address |
| Courier kiosk swap | Getting ZEC by swapping another coin (Zodl Swap / NEAR Intents) |
| Pay rent at Cobalt Exchange; cash out everything right away and get caught | Unshielding; amount + timing correlation de-anonymizes people |
| Ledger billboard: live Zcash mainnet | Real transactions right now: public ones show everything, shielded ones show nothing |
| Ending: steps for Zodl | A real first shielded transaction |

## What is real and what is practice
- **Practice:** the wallet, balances, addresses and every in-game payment are simulated. Nothing touches real funds, and the game never asks for keys or seed words.
- **Real:** the "ZCASH MAINNET · LIVE" billboard pulls the latest mainnet transactions from the public Blockchair API in the browser and classifies them as public, shielding (into the pool), unshielding (out of the pool) or fully shielded. If the API is unreachable it falls back to a committed snapshot and labels it "last snapshot".
- The Tailor's matching rule (`src/game/state.ts → tailorMatch`) is a teaching simplification of amount/timing correlation, not a real chain-analysis model.

## Characters
Every character is a real **zkSNARKs** identity (zksnarks.net / zilkroad.com). The 26×26 portraits are pulled from `zilkroad.com/api/art/{id}` (`scripts/pull_heads.py`) and the 3D voxel bodies are generated from each portrait's own palette: hood, skin, hat, eyes or visor, and pixel-trail colours. Art credit belongs to the zkSNARKs project.

## Tech
Vite + TypeScript + three.js, no framework. Custom voxel city with Minecraft-style coloured block light and AO, postprocessing (bloom, scanlines, chromatic aberration), instanced pixel trails, A* tap-to-walk, WebAudio synth sound. No backend.

```
npm install
npm run dev        # http://localhost:5173
npm run build
```
Dev shortcuts: `?debug=payday|errands|dawn&at=cafe|arcade|exchange|home`, `#sheet` (character lineup).

## License
Code: MIT. Character art belongs to the zkSNARKs project and is not covered by the MIT license.
