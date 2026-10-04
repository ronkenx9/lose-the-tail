> STYLE V2: Supplied PNGs are the visual authority: voxel lettering, amber public routes, mint shielded routes, white guided shielding, rust case alerts. Death cards use the supplied dark pixel compositions; preserve their one-second holds. The supplied end card retains its city silhouette and five-second hold.

# VISIBLE-SCREEN VERSION — use this version for the supplied kit

Read START-HERE.md first. The listed PNG files are ready to upload. For all UI sequences, use the images in numeric order; they are separate states, never a collage. Dialogue timing: audio/manifest.json is authoritative.

# LOSE THE TAIL — Detailed AI video prompts

Matched to VOICEOVER-90S.md · Exactly 90 seconds on the edit timeline

## How to use this document

Generate each numbered shot separately. Upload the character reference files listed for that shot, then paste the COMMON PROMPT PREFIX followed by that shot's GENERATION PROMPT. The edit duration is the portion to retain, not a claim that every video model can generate that exact length. If your model outputs longer clips, trim the best section and keep a short handle at each end. Join the shots at the listed boundaries in an editor.

VOICE CUES refer to the separate voice document. Add those recorded files to the final edit. Do not ask the video model to invent dialogue, voices, subtitles or wallet text. Use the supplied screen references; overlay the original PNG in editing if text distorts. This separates character motion from readable information and avoids a different voice on every generation.

GENERATION PROMPT = footage to generate. EDITOR OVERLAY = precise graphics/text to add afterward. Black death cards and the end card are made in the editor, not generated as footage. Phone screens must show the corresponding supplied PNG from this kit; keep the graphics visible and avoid green glow on fingers. The editor places UI within the screen corners, below foreground fingers when necessary, with readable contrast and safe margins.

## Character reference files

All paths below are relative to this document. Add the corresponding original NFT PNG from references/originals/ whenever the tool supports a second reference. The original face wins over any accidental variation in generated reference sheets.

- NIKO: references/fullbody/9701-niko.png + references/originals/9701.png. Brown stepped head, charcoal eye band, tan/cream square eyes, brown body and dark joint bands.
- ZERO: references/fullbody/5838-zero.png + references/originals/5838.png. White/gray stepped body, black square eyes, floating feet and dissolving white cubes.
- TAILOR: references/fullbody/3583-tailor.png + references/originals/3583.png. Gray face with black square eyes, olive cap/gold badge, charcoal long coat, red pixels in dark trail.
- ROOK: references/fullbody/5703-rook.png. Voice only; do not generate him on screen in this cut.
- AUNTIE: references/fullbody/6306-auntie-node.png + references/originals/6306.png. Pink face, red/blue eye markings, white/blue cap, black body, cream apron.
- MIKA: references/fullbody/2304-mika.png + references/originals/2304.png. Rust/orange body, purple square eyes in charcoal eye band, diagonal dark strap.
- HEM: references/fullbody/1200-hem.png + references/originals/1200.png. Broad gray body, asymmetric red/blue eye markings, olive cap.
- NEEDLE: references/fullbody/320-needle.png + references/originals/320.png. Narrow orange/rust body, yellow face/red eyes, olive cap.

## COMMON PROMPT PREFIX — include with every generated shot

Cinematic 3D voxel noir, 16:9 landscape, 24 fps target for the final edit, consistent small cubic geometry, matte surfaces, restrained edge bevels, physically coherent lighting, deliberate camera movement. Match the uploaded original Zilkroad NFT identities and full-body reference proportions. Preserve exact head shape, square eye design, headwear, palette and dissolving cube trail. Do not add human hair, eyebrows, noses, lips or teeth. No facial morphing. Express emotion through head tilt, torso posture, hand position, timing and voice added later. Maintain the same body and outfit throughout all lives. Sparse dissolving cubes stay near the character's trailing side; do not disintegrate hands holding objects. Exactly two arms and two legs for humanoids. No extra fingers or duplicate phones. No real people, no realistic skin, no unprovided logos, watermarks, subtitles, invented UI lettering or automatic dialogue. Frame the stated action completely. Generate only the requested shot, not a montage or a cut to another scene. Keep props and lighting consistent with the continuity rules below.

## Continuity rules — locked for all shots

- Niko's phone: one matte-black rectangular smartphone, portrait orientation, glass screen displaying the supplied screen graphic, thin black frame. It is held in his RIGHT hand during street/café/arcade scenes. His LEFT index finger operates the screen. Keep that orientation; do not mirror him between shots.
- Auntie and Mika each have their own similar phone. Never transfer Niko's device to them.
- Bedroom: narrow apartment, rain-streaked window on frame left, low bed against rear wall, slate blanket, small wooden bedside table on frame right, empty dark cup and black phone on table. Blue dawn light through window, weak warm bedside lamp. Reuse this location for the rewind.
- Café: narrow noodle restaurant. Front door rear frame right; street window frame left; dark wood counter across foreground; Auntie behind counter; Niko on a stool on the customer side. Warm amber hanging lamp, blue-green rainy exterior, rising pot steam in background. Same dark ceramic bowl with a small pale rim chip; same pair of dark wooden chopsticks. Reuse camera angles, positions and bowl across lives.
- Exchange: street-service window with reflective glass and cool cyan practical light, no new speaking clerk. Niko outside the glass. Reflection supplies Hem's reveal.
- Void: absolute black environment, no floor pattern, Zero softly illuminating himself; Niko visible in gentle reflected white light. No wings, halo or religious props. One small floating white rewind cube.
- Arcade: one quiet counter, two softly blurred arcade cabinets behind it, indigo and amber light. Niko on frame left, Mika frame right. Screens contain no recognizable game content or logos.
- Payment amounts are illustrative SIMULATED ZEC. No working QR codes, real addresses, seed phrases or keys. The editor creates fake short address labels. “Confirmed” arrives after an edit indicating time has passed; never label settlement instantaneous.
- Nobody becomes physically invisible. Gang intelligence combines fictional public transaction observations and camera footage. A dotted “possible match” line is an inference, not a decrypted shielded transaction.

---

## S01 · 00:00–00:04 · Waking up

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/01-incoming-call.png`, `continuity/bedroom.png`.

REFERENCES: Niko.

GENERATION PROMPT: In the locked bedroom, begin with a low close shot of the black smartphone vibrating on the wooden bedside table beside the empty dark cup. The bed is visible behind it. Slowly slide the camera 20 cm toward the bed as Niko's brown RIGHT hand reaches out from under the slate blanket and grasps the phone. He lifts it toward his face while his head emerges from the blanket. His head movement is sluggish and sleepy; preserve his square eyes unchanged. Keep the cup upright. Only one phone. Use screens/01-incoming-call.png inside the phone display.

VOICE CUES: V01 begins at 00:00.8 as Rook speaks through the call. Niko is listening.
SOUND: rain, two short phone buzzes, blanket rustle.
EDITOR OVERLAY: none on phone yet. Lower-corner label “PRACTICE WALLET · SIMULATED ZEC” starts when the wallet first appears in S02 and stays through S03.

## S02 · 00:04–00:08 · Wallet setup on the PHONE

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/02-create-wallet.png`, `screens/03-secure-backup.png`, `screens/04-transparent-receive.png`, `screens/05-request-shared-rook.png`, `branding/practice-disclosure.png`, `continuity/bedroom.png`.

REFERENCES: Niko; reuse S01 bedroom as environment reference.

GENERATION PROMPT: Over Niko's LEFT shoulder, look down at the black smartphone held vertically in his RIGHT hand, roughly 30 cm from his chest. He is now seated upright on the edge of the same bed. Phone occupies at least 60 percent of frame and its entire rectangular screen is visible. His LEFT index finger makes two deliberate taps near the lower center of the screen with the supplied graphic, with one second between taps. Keep the phone steady and fingers out of the screen center between taps. Camera locked; warm bedside rim light on brown hands, blue window light on phone edges. Show the supplied screen states in order, preserving text and amounts.

VOICE CUES: V01 continues to 00:07.8.
EDITOR OVERLAY: Use supplied screens 02–05 in sequence. Screen state at 00:04: “Practice wallet” / button “Create wallet.” After first tap at about 00:05: “Secure backup” / “Keep recovery details private” / button “Backup saved.” NEVER display recovery words. After second tap at about 00:06.5: “Receive” / “Transparent address” / fictional label “t1Demo…NIKO” / “Share with Rook.” Simulate the share confirmation graphically; no extra finger action required. These are distinct editorial screen states, not an impossible single UI.

## S03 · 00:08–00:12 · Payment arrives

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/06-rook-payment-received.png`, `branding/practice-disclosure.png`, `continuity/bedroom.png`.

REFERENCES: Niko; S01/S02 bedroom.

GENERATION PROMPT: Start on Niko's phone in the same right-hand grip as the previous shot, then gently tilt up to his head and upper torso. Niko notices the phone, straightens his shoulders and tips his head toward it with pleased surprise. His left hand relaxes onto his knee. Keep face features fixed; show the smile through posture rather than creating a mouth. End on his relieved reaction, not a new location.

VOICE CUES: V02, 00:08.0–00:11.0.
EDITOR OVERLAY: Phone shows “Payment received” / “+5 ZEC” / “Transparent” / “Rook.” Use the cut from S02 as elapsed time. Keep the practice-wallet disclosure on screen. Soft confirmation sound at the opening of this shot.

## S04 · 00:12–00:17 · Auntie's greeting

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/6306-auntie-node.png`, `references/originals/6306.png`, `continuity/cafe.png`.

REFERENCES: Niko and Auntie.

GENERATION PROMPT: Medium two-shot inside the locked café from the customer side of the counter. Niko occupies left foreground in three-quarter profile, Auntie center-right behind the counter. Auntie holds a cloth beside the chipped dark ceramic bowl, looks up at Niko, then lightly tilts her head with affectionate teasing while continuing to wipe the counter. Niko settles onto the stool and looks at her. Warm amber lamp overhead; rain and cyan street reflections through left window. Keep front door visible in rear right. Camera makes a very slow push in. Do not add mouths or other characters.

VOICE CUES: V03, 00:12.3–00:16.7.
SOUND: doorbell at start, low kitchen sounds, quiet rain.
EDITOR OVERLAY: none.

## S05 · 00:17–00:20 · Niko pays at the counter

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/6306-auntie-node.png`, `references/originals/6306.png`, `screens/07-public-cafe-review.png`, `screens/08-public-cafe-submitted.png`, `continuity/cafe.png`.

REFERENCES: Niko and Auntie; S04 café.

GENERATION PROMPT: Close over Niko's left shoulder toward his portrait smartphone held in his right hand above the café counter. Auntie's pink hand and the bowl sit softly out of focus beyond the phone. Niko's left index finger taps once on the lower-middle screen, then withdraws. The screen is filled with the supplied screen graphic. Keep the phone large and steady with all four corners visible. No physical coins, no projected hologram, no phone changing hands.

VOICE CUES: V04 starts 00:17.0 and continues over S06 until 00:20.7.
EDITOR OVERLAY: “Pay Noodle Café” / “0.03 ZEC” / “Transparent recipient” / button “Confirm payment.” After tap, show “Payment submitted.” Receipt confirmation belongs to a later time-cut inset in S06. No QR scan is needed in this shortened cut; the payment request is already open on the phone.

## S06 · 00:20–00:22 · The gang's clue

SUPPLIED FILES: `references/fullbody/3583-tailor.png`, `references/originals/3583.png`, `monitors/01-public-clue.png`, `continuity/props.png`.

REFERENCES: Tailor; monitors/01-public-clue.png.

GENERATION PROMPT: Tight locked shot of a dark rectangular desk monitor in a dim room. The edge of the Tailor's charcoal glove rests on the desk without touching the display. Olive cap is only a blurred silhouette near frame edge. Screen is a clean display of monitors/01-public-clue.png. Cold screen spill and one narrow amber edge light, no flashy hacking effects.

VOICE CUES: V04 finishes over the beginning of this shot.
EDITOR OVERLAY: Two clearly separate panels: “PUBLIC PAYMENT” showing “NIKO demo address → NOODLE CAFÉ · 0.03 ZEC”; and “CAFÉ CAMERA” containing the supplied designed camera-observation panel identifying Niko at the café. A short line visually connects the record to the camera image. A tiny café receipt inset reads “Received” to establish the earlier payment completed after the cut. Keep only essential labels legible; no invented GPS field on the blockchain record.

## S07 · 00:22–00:27 · Needle finds Niko

SUPPLIED FILES: `references/fullbody/320-needle.png`, `references/originals/320.png`, `references/fullbody/1200-hem.png`, `references/originals/1200.png`, `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `continuity/cafe.png`.

REFERENCES: Needle, Hem, Niko. Use café reference S04.

GENERATION PROMPT: Low medium shot from Niko's seated eye position toward the café side aisle and front door at rear right. Needle, using the exact narrow orange/rust body, yellow face, red eyes and olive cap reference, advances two steps through the side aisle and stops beside Niko's table. Hem's broad gray body blocks the front door behind him. Needle angles his head slightly, raises one shoulder in a smug half-shrug, then gestures loosely toward Niko's noodle bowl as his sarcastic taunt plays. Convey the smirk through head angle and relaxed cocky posture; preserve the NFT face pixels and do not invent a mouth or teeth. Niko's brown shoulder is soft foreground left. The Tailor is not in the café. Warm light on Needle, cold blue doorway behind Hem. Camera retreats subtly 15 cm. No weapons or contact.

VOICE CUES: Needle V05 (revised taunt; recorded in voice preview V3), 00:22.1–00:28.02, continuing into S08.
SOUND: doorbell, two measured footsteps, kitchen noise fades slightly.

## S08 · 00:27–00:30 · Niko realizes

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/320-needle.png`, `references/originals/320.png`, `continuity/cafe.png`.

REFERENCES: Niko and Needle; café S04.

GENERATION PROMPT: Medium tracking shot from across the same café counter. Niko grips his black phone in his RIGHT hand, slides off his stool and takes two hurried steps toward the rear passage at frame left. Needle follows immediately from beside the table, then sidesteps into that passage, blocking Niko's route. Niko stops short, shoulders drawn in, and looks up at Needle as he asks how Needle knew. Keep the same yellow face, red eyes and olive cap on Needle. His cocky head tilt echoes the previous shot; no new facial pixels or mouth. Hem remains at the front door off-camera. End as Needle's shadow falls across Niko. No contact or injury. Preserve the café layout and continuous movement.

VOICE CUES: Recorded V05 ends 00:28.02; V06 runs 00:28.14–00:29.90. Keep the death card at 00:30.
CUT: hard cut directly to S09 before physical contact.

## S09 · 00:30–00:31 · Death card — EDITOR ONLY

SUPPLIED FILES: `cards/01-you-died.png`.

Solid black frame. Center white text “YOU DIED.” No character, camera move, glitches or background imagery. Near silence for the full second. Do not generate this card with the video model.

## S10 · 00:31–00:36 · Zero appears

SUPPLIED FILES: `references/fullbody/5838-zero.png`, `references/originals/5838.png`, `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `continuity/void.png`.

REFERENCES: Zero and Niko.

GENERATION PROMPT: Medium two-shot in the locked black void. Niko sits low at frame left with bent knees, looking up; Zero floats at frame right at Niko's seated eye height, feet about 20 cm above the invisible ground. Zero tilts his head slightly, then returns it level with quiet concern. Sparse white cubes drift slowly behind his trailing side, not across his eyes. Soft light from Zero illuminates the side of Niko's brown head. No halo, wings or floor grid. Camera almost still, very slow 10 cm push in.

VOICE CUES: V07 00:31.3–00:35.7; V08 begins 00:35.9.
SOUND: low airy room tone, no loud divine choir.

## S11 · 00:36–00:39 · Ask for another try

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/5838-zero.png`, `references/originals/5838.png`, `continuity/void.png`.

REFERENCES: Niko and Zero; S10 void.

GENERATION PROMPT: Closer angle on Niko in the same void, Zero's white torso partly visible at right. Niko looks down at his hands, then back toward Zero, and extends his LEFT palm. Zero's small white hand presents a single floating white cube just above that palm. The cube is solid and unmarked; keep it the same size, no multiplication. Niko's right hand rests on his knee with the phone. End with the cube hovering between them.

VOICE CUES: V08 ends 00:38.1; V09 begins 00:38.3.
EDITOR ACTION: At 00:39, hard match cut to a white phone-screen flash in S12; add a brief reversed phone vibration. No generated montage.

## S12 · 00:39–00:43 · Shield on the PHONE

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/09-shield-review.png`, `screens/10-shield-submitted.png`, `screens/11-shield-confirmed.png`, `continuity/bedroom.png`.

REFERENCES: Niko; reuse S02 phone and bedroom framing.

GENERATION PROMPT: Match the exact over-left-shoulder bedroom angle from S02. Niko sits on the same bed holding the portrait black smartphone in his RIGHT hand. He is more upright now. His LEFT index finger makes one clear tap near the lower-middle screen with the supplied graphic, then pulls away. Hold all screen corners steady for compositing. Camera fixed. No floating buttons or gestures in the air: the action is on the physical phone screen.

VOICE CUES: V09 ends 00:41.5.
EDITOR OVERLAY: At shot start: “Practice wallet” / “Transparent balance: 5 ZEC” / button “Shield funds.” Tap switches to “Shielding submitted”; use a short editorial dissolve to “Shielding confirmed” / “Shielded balance.” A restrained arrow reads “TRANSPARENT → SHIELDED.” Small caption: “Earlier public history remains.” Avoid exact post-fee balance arithmetic.

## S13 · 00:43–00:47 · Unshield mistake on the PHONE

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/12-unshield-warning.png`, `screens/13-unshield-submitted.png`, `continuity/exchange.png`.

REFERENCES: Niko; establish locked exchange window.

GENERATION PROMPT: Close shot over Niko's left shoulder while he stands outside a reflective exchange window. He holds his black phone vertically in his RIGHT hand at chest level; cyan window light outlines it. His LEFT index finger hesitates above the lower screen, then taps once. Niko's gray-black reflection and the window edges stay soft behind the phone. The phone screen remains filled with the supplied graphic. Camera stationary, screen large enough to read later. No clerk, hologram or physical token exchange.

VOICE CUES: V10 starts 00:43.2 and ends 00:46.5; V11 begins 00:46.7.
EDITOR OVERLAY: “Send from shielded balance” / “Transparent recipient: Demo Exchange” / “Amount: 4.90 ZEC” / bold warning “UNSHIELD: RECIPIENT + AMOUNT BECOME PUBLIC” / “Confirm.” Show the warning before the tap. After tap, display “Submitted”; completion is implied after the next cut. This is a different operation from S12 and must not use the Shield button.

## S14 · 00:47–00:50 · A possible match

SUPPLIED FILES: `references/fullbody/3583-tailor.png`, `references/originals/3583.png`, `monitors/02-possible-match.png`, `continuity/props.png`.

REFERENCES: Tailor; reuse S06 monitor plate.

GENERATION PROMPT: Tight close shot on the same dark desk monitor and Tailor's charcoal glove as S06. The glove rises slightly toward the display as though indicating a possible lead, then stops. Keep monitor a display of monitors/02-possible-match.png, same cold spill and amber edge light. No new location or camera whip.

VOICE CUES: V11 continues.
EDITOR OVERLAY: Public boundary observations: “SHIELDED ENTRY · about 5 ZEC” and “TRANSPARENT OUTPUT · 4.90 ZEC.” Small caption “Nearby times”; a DOTTED line joins them and is labeled “POSSIBLE MATCH.” The supplied monitor panel establishes the boundary correlation; the next physical exchange shot supplies the separate visual identification. Do not use “decrypted,” “proof,” “100% match” or show hidden shielded transaction history.

## S15 · 00:50–00:53 · Hem in the reflection

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/1200-hem.png`, `references/originals/1200.png`, `references/fullbody/320-needle.png`, `references/originals/320.png`, `continuity/exchange.png`.

REFERENCES: Niko, Hem and Needle; exchange S13.

GENERATION PROMPT: Medium profile shot of Niko outside the same exchange glass. He lowers his right-hand phone slightly and notices Hem's broad gray shape reflected in the glass ahead. Niko's shoulders lock, then he slowly begins turning his head toward the threat. Hem stands ahead along the pavement, visible in the window reflection and blocking Niko’s forward escape. Needle enters at the far left background behind Niko and takes two quick steps toward him, maintaining the pursuit. Keep their reflections physically coherent. No sudden teleportation, no attack. End just before Niko fully turns. Cold cyan lighting and street rain remain consistent.

VOICE CUES: V11 finishes at 00:52.2.
SOUND: one heavy footstep, then music stops at cut.

## S16 · 00:53–00:54 · Second death — EDITOR ONLY

SUPPLIED FILES: `cards/02-you-died-again.png`.

Solid black. White centered text “YOU DIED. AGAIN.” Full one-second hold. No speech. Short reversed phone buzz at the end carries into the third life. No AI footage needed.

## S17 · 00:54–00:58 · Third-life receiving request

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/14-shielded-request.png`, `screens/15-shielded-request-shared.png`, `continuity/bedroom.png`.

REFERENCES: Niko; same bedroom as S02.

GENERATION PROMPT: Same over-left-shoulder phone shot on the bed, now Niko calm and upright. Right hand holds the same portrait phone. His LEFT index finger makes one measured tap and withdraws. He waits instead of tapping repeatedly. No scene transition inside the clip. Screen shows the supplied graphic, locked camera, original blue/warm bedroom light.

VOICE CUES: V12 begins 00:54.3.
EDITOR OVERLAY: “Receive ZEC” / selected route “SHIELDED” / fictional request label “Niko · practice request” / button “Share with Mika.” Tap changes to “Request shared.” A persistent small “SIMULATED ZEC” badge prevents confusion with a real wallet. No QR code or real address.

## S18 · 00:58–01:01 · Mika sends on HER PHONE

SUPPLIED FILES: `references/fullbody/2304-mika.png`, `references/originals/2304.png`, `screens/16-mika-send-review.png`, `screens/17-mika-send-submitted.png`, `continuity/arcade.png`.

REFERENCES: Mika; locked arcade setting.

GENERATION PROMPT: Over Mika's LEFT shoulder at the quiet arcade counter. Mika holds HER OWN black smartphone vertically in her RIGHT hand. Purple eyes and rust-orange head edge appear softly at left of frame; her LEFT index finger taps once on the lower screen. Entire screen visible and filled with the supplied graphic. Background contains two blurred arcade cabinets in indigo/amber light. Niko's phone is not in this shot. Do not swap Mika's rust hands for Niko's brown hands.

VOICE CUES: V12 continues until 01:00.7.
EDITOR OVERLAY: “Send to Niko” / “0.02 ZEC” / “Shielded payment” / recipient review / button “Confirm.” After tap: “Submitted.” Use next cut for elapsed confirmation time.

## S19 · 01:01–01:04 · Mika asks

SUPPLIED FILES: `references/fullbody/2304-mika.png`, `references/originals/2304.png`, `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `continuity/arcade.png`.

REFERENCES: Mika and Niko; arcade S18.

GENERATION PROMPT: Medium two-shot at arcade counter. Mika on frame right lowers her own phone slightly and turns her head toward Niko on frame left. She opens her free LEFT hand in a small conversational question gesture. Niko looks down at his own phone in his RIGHT hand. Casual friendly posture, no frantic waving, no invented mouth animation. Locked camera with subtle handheld-like drift under 2 cm.

VOICE CUES: V13, 01:01.0–01:04.0.
EDITOR OVERLAY: none; this is the human reaction shot.

## S20 · 01:04–01:07 · Niko receives on HIS PHONE

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/18-niko-shielded-receipt.png`, `continuity/arcade.png`.

REFERENCES: Niko; arcade S19.

GENERATION PROMPT: Close on Niko's portrait phone in his RIGHT hand; his brown LEFT hand rests lightly on the counter beside it. Start with the screen with the supplied graphic square to camera, then gently tilt toward Niko's shoulders as they relax. Do not add another tap: receiving is a notification, not a button that creates funds. Preserve the same device and hand color.

VOICE CUES: V14, 01:04.3–01:06.2.
EDITOR OVERLAY: “Shielded payment received” / “+0.02 ZEC” / “From Mika” / “Confirmed.” Soft notification chime. This receipt follows an editorial time cut; do not display a false instant-settlement countdown.

## S21 · 01:07–01:10 · Pay Auntie privately on the PHONE

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `references/fullbody/6306-auntie-node.png`, `references/originals/6306.png`, `screens/19-private-cafe-review.png`, `screens/20-private-cafe-submitted.png`, `continuity/cafe.png`.

REFERENCES: Niko and Auntie; reuse café S05 camera.

GENERATION PROMPT: Recreate S05 over-left-shoulder phone framing in the same café. Niko's right hand holds his black portrait phone over the same counter, bowl and Auntie's pink hand visible beyond. He pauses to look at the screen, then taps once with his LEFT index finger and withdraws. The deliberate pause contrasts with the first life's quick tap. Screen filled with the supplied graphic. No wallet button hovering in midair.

VOICE CUES: none; leave room for the action.
EDITOR OVERLAY: “Pay Noodle Café” / “0.03 ZEC” / “SHIELDED PAYMENT” / “Recipient verified” / button “Confirm payment.” After tap, “Submitted.” Niko has the reset earned funds plus Mika's test amount; do not imply he is spending only the 0.02 received in S20.

## S22 · 01:10–01:14 · Auntie receives and serves

SUPPLIED FILES: `references/fullbody/6306-auntie-node.png`, `references/originals/6306.png`, `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `screens/21-auntie-receipt.png`, `continuity/cafe.png`.

REFERENCES: Auntie and Niko; café S04.

GENERATION PROMPT: Medium shot from the customer side. Auntie checks HER OWN small phone lying screen-up behind the counter, then slides the same chipped dark bowl toward Niko with both hands. His brown hands enter lower frame to receive it; his phone now rests on the counter on his right. Keep pink hands distinct from brown hands. Warm steam rises from bowl without obscuring heads. Camera still. No duplicated bowl, no coins.

VOICE CUES: V15, 01:10.2–01:13.7.
EDITOR OVERLAY: Brief tracked screen insert on Auntie's phone: “Payment received · 0.03 ZEC.” Cut from S21 supplies elapsed time before confirmation.

## S23 · 01:14–01:18 · Relief

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `continuity/cafe.png`.

REFERENCES: Niko; café S22.

GENERATION PROMPT: Medium close shot of Niko seated at the café counter. He looks down at the bowl, lets his shoulders drop, then tilts his head toward Auntie off-camera with grateful amusement. He picks up the chopsticks with his RIGHT hand while his LEFT steadies the bowl. His phone remains screen-up on the counter to his right. Keep his original flat NFT face unchanged: no mouth, lips or realistic smile. Show emotion in posture and a small relieved head movement. Slow push in, warm light.

VOICE CUES: V16, 01:14.0–01:18.5, its last word may carry into S24.
EDITOR NOTE: To imply the first bite, cut toward the bowl as he raises chopsticks; do not generate a new mouth on the NFT. Food steam and a contented exhale sell the moment.

## S24 · 01:18–01:20 · Tailor loses the payment lead

SUPPLIED FILES: `references/fullbody/3583-tailor.png`, `references/originals/3583.png`, `monitors/03-no-new-details.png`, `continuity/props.png`.

REFERENCES: Tailor; desk/monitor S06.

GENERATION PROMPT: Medium close shot of the Tailor at the same desk. He looks at the monitor displaying monitors/03-no-new-details.png, holds still for a beat, then turns it slightly away with one charcoal-gloved hand in restrained irritation. Olive cap and BLACK square eyes remain unchanged. No tantrum, no broken screen, no voice. Cold light, minimal movement.

VOICE CUES: V16 may finish until 01:18.5; then silence from characters.
EDITOR OVERLAY: Monitor shows existing case records with a new line “No new public payment details.” Keep old records visible. Do not animate evidence being erased or imply all surveillance is defeated.

## S25 · 01:20–01:25 · Dawn / title arrives

SUPPLIED FILES: `references/fullbody/9701-niko.png`, `references/originals/9701.png`, `branding/game-title-transparent.png`, `continuity/cafe.png`.

REFERENCES: Niko; café exterior matching S04 window/door.

GENERATION PROMPT: Wide rear three-quarter shot outside the café at dawn. Niko steps out of the right-side door onto wet pavement and walks slowly away from camera toward soft warm light. Same brown voxel body and head trail, no new clothes. Warm restaurant window at frame left reflects the now brighter blue-gray sky. Rain has eased. Camera stays behind him and rises only slightly. Keep upper center of frame simple for a title overlay. No other characters, no flying coins or magical invisibility.

VOICE CUES: V17, 01:20.2–01:24.8.
EDITOR OVERLAY: At 01:23 begin a gentle fade toward the final title. By 01:25, reach the static card in S26. Music warms, dialogue remains clear.

## S26 · 01:25–01:30 · End card — EDITOR ONLY

SUPPLIED FILES: `cards/03-end-card.png`.

Static near-black background. Center large title “LOSE THE TAIL.” Below: “Learn Zcash. One life at a time.” Lower center: “Play: lose-the-tail.vercel.app.” Small but legible footer: “Simulated funds. Real privacy lessons.” High contrast, generous spacing, no animated tiny text. Hold all text for the complete five seconds. No speech. Fade music gently; one café-bell ring closes the film.

---

## Final edit checks

- The 26 edit intervals are contiguous and total exactly 90 seconds. Death/end cards are editor graphics; the remaining 23 are footage shots or reused plates.
- Source shots S02/S12/S17 share bedroom composition; S05/S21 share café phone composition; S06/S14 share monitor plate. Reuse approved environment references and plates to reduce generation drift and cost.
- Check actual voice takes against the time windows before generating final action timing. If a take is long, shorten a silent handle or revise a whole phrase; never force unnatural one-word delivery.
- Visible phone operations are explicit: Niko sets up/receives/shields/unshields/shares request/pays; Mika sends from her phone; Auntie receives on hers. No tap in the air stands in for a wallet operation.
- Pair each shot with only the required character references to prevent mixed faces. Full-body side/back views are generated design interpretations; original NFT faces remain the authority.
- Confirm no real wallet data, no subtitle hallucinations, no extra hands, no changed NFT eye motifs, no wardrobe swaps, and no graphics claiming guaranteed anonymity.
