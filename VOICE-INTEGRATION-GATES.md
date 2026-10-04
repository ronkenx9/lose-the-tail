# In-game character voices
- [x] G1: Each spoken game line has a matching character-specific v4 recording, including both conditional branches; approved trailer clips reused where text matches.
  CHECK: node scripts/verify-voices.mjs
  EXPECT: VOICES_VERIFIED
  EVIDENCE: automatic-evidence=v1; definition-sha256=7b8ab748681818b863cfdf055e17ff839726e594b6874137f4d67289d756c46a; exit=0; EXPECT=matched; output-sha256=886d1d1b7502af92bec1933e3231274d2098ac9e6c13c7a8213371af2c6b125b; output-bytes=46; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/lose-the-tail; path=a42dff3919ac/31 entries
- [x] G2: Voice routing handles speaker identity, playback failures and immediate mute; tests and production build pass.
  CHECK: npm run test -- --run && npm run build
  EXPECT: built in
  EVIDENCE: automatic-evidence=v1; definition-sha256=e82d60cc57249625a7c8202dd78a719504613d803a9a7d67ac899166cd58dd3d; exit=0; EXPECT=matched; output-sha256=b74c71c4e50bcb3e72dcf9a382f266ec93dd967e789400f111f10b5c935b475c; output-bytes=1089; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/lose-the-tail; path=a42dff3919ac/31 entries
- [x] G3: Integration checked against game progression and portrait roles; no secret included in browser assets.
  EVIDENCE: Full browser playthrough passed through ending (73 seconds). Separate voice smoke test confirmed real Rook playback and immediate mute. Portrait roles match Needle #320 and Auntie #6306. Scanned public and dist for the local API credential: absent.
