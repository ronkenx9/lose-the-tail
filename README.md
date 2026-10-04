# Lose the Tail

A 6-minute first-person voxel game that takes someone from zero to understanding their first shielded Zcash transaction, then hands them off to do it for real.

**Play:** https://lose-the-tail.vercel.app · ZECATHON Wildcard (onboarding) entry

You wake up in your apartment to your phone buzzing: you just got paid 5 ZEC to a public address. A crew called the Tailors watches the public ledger and saw it.

**Night one** you know nothing. You spend it at the noodle kiosk, the Tailor steps out of his storefront and gives the order over the radio, and his crew comes for you on foot. You can run. They catch you anyway. Everything goes black, and you wake on a floating island in the dark, surrounded by the pages of the file they built on you. **Zero**, a white ghost, is waiting.

**Night two** Zero is in your room when you wake. Same night, same rain, same crew. This time you set up a real wallet, shield the money while the crew is heading for your door, and live the rest of the night privately: every shop is a building you walk into and every person talks to you face to face.

| In the game | Real Zcash concept |
|---|---|
| Create a wallet, back up 24 words, pick three back | Wallet setup, seed safety |
| Payday lands in your transparent pocket; your face hits the billboard, the crew is dispatched and runs you down | Transparent addresses are public: address, amount, time |
| Hold **Shield** while they close in: hood goes up, they lose your signal and search an empty street | Shielding moves funds into the shielded pool |
| Pay the café with a private note | Shielded send + encrypted memo |
| Show Mika your address (she refuses the public one) | Receiving to a shielded (u1…) address |
| Courier kiosk swap | Getting ZEC by swapping another coin (Zodl Swap / NEAR Intents) |
| Pay rent at Cobalt Exchange; cash out everything right away and the crew is on you again | Unshielding; amount + timing correlation de-anonymizes people |
| Ledger billboard: live Zcash mainnet | Real transactions right now: public ones show everything, shielded ones show nothing |
| Ending: steps for Zodl | A real first shielded transaction |

## What is real and what is practice
- **Practice:** the wallet, balances, addresses and every in-game payment are simulated. Nothing touches real funds, and the game never asks for keys or seed words.
- **Real:** the "ZCASH MAINNET · LIVE" billboard pulls the latest mainnet transactions from the public Blockchair API in the browser and classifies them as public, shielding (into the pool), unshielding (out of the pool) or fully shielded. If the API is unreachable it falls back to a committed snapshot and labels it "last snapshot".
- The Tailor's matching rule (`src/game/state.ts → tailorMatch`) is a teaching simplification of amount/timing correlation, not a real chain-analysis model.

## Characters
Every character is a real **zkSNARKs** identity (zksnarks.net / zilkroad.com). The 26×26 portraits are pulled from `zilkroad.com/api/art/{id}` (`scripts/pull_heads.py`) and the 3D voxel bodies are generated from each portrait's own palette: hood, skin, hat, eyes or visor, and pixel-trail colours. Art credit belongs to the zkSNARKs project.

## Tech
Vite + TypeScript + three.js, no framework, no backend.
- Voxel city with walk-in interiors (apartment, Tailor HQ, café, arcade, exchange, kiosk) built from blocks plus small-voxel furniture; Minecraft-style coloured block light with AO; glass that light passes through; planar wet-street reflections; roof-aware rain.
- First person with tap-to-walk (A*) or WASD, drag-look, sprint with stamina, an on-screen RUN button on touch.
- People who chase you are real agents on the same walk grid; the void is its own walkable voxel scene.
- Dialogue is spoken from where the speaker stands: positional WebAudio voice (ElevenLabs lines) and speech bubbles that pause if you walk away.
- Adaptive synth score and footsteps, postprocessing (bloom, scanlines, chromatic aberration), adaptive quality governor.
- `scripts/e2e.mjs` plays the whole game headless (`--trap`, `--catch` for the failure paths); `scripts/tour.mjs` captures screenshots of key moments.

```
npm install
npm run dev        # http://localhost:5173
npm run build
node scripts/e2e.mjs http://localhost:5173/
```
Dev shortcuts: `?debug=void|loop2|payday|errands|dawn&at=cafe|arcade|exchange|home`, `?start=payday`, `#sheet` (character lineup).

## License
Code: MIT. Character art belongs to the zkSNARKs project and is not covered by the MIT license.
