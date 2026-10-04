# Gates: Expressive cast audio
OWNS: trailer-workshop/audio/**
Scope: Generate the authorized 17-cue cast dialogue with v4.
- [x] G1: Model and cast availability and allowance inspected without revealing credentials.
  EVIDENCE: Official model documentation identifies eleven_v4; all 17 authenticated TTS requests succeeded. Six voice IDs selected from account catalog. Subscription snapshot saved without secrets.
- [x] G2: All cues decode, use six consistent voices and have verified durations; complete preview and ZIP exist.
  CHECK: python3 audio/verify.py
  EXPECT: AUDIO_VERIFIED
  EVIDENCE: automatic-evidence=v1; definition-sha256=d8caaba4b499d3bbc0476b91f06cb6b54b1c7f61dc40dcdf32b26d8ed0cb7307; exit=0; EXPECT=matched; output-sha256=d560c22f98f0c3259fd32251e2a5ca0e9d214c50158f9feb2c2c7d08fac7b4c2; output-bytes=92; shell=/bin/sh; cwd=/Users/gadgetplug/Documents/vibecoding/lose-the-tail/trailer-workshop; path=a42dff3919ac/31 entries
- [x] G3: Timing report documents casting, expressive direction and limitations.
  EVIDENCE: audio/TIMING-AND-CAST.md and manifest.json preserve original text, tagged text, cast, timing and model. Human listening review remains explicitly identified; preview contains dialogue only.
