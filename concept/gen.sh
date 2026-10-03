#!/bin/zsh
# usage: gen.sh name "prompt"
cd ~/Documents/vibecoding/lose-the-tail
STYLE="Style: Minecraft-style voxel art, cyberpunk night, rain, neon. Palette: black, mint green #c8ffdc, Zcash gold #F4B728, warning red #ff2b3b. No watermark, no logos of real companies."
codex exec -m gpt-5.5 --skip-git-repo-check --sandbox workspace-write -C ~/Documents/vibecoding/lose-the-tail "Use your image generation tool to create ONE image, then copy the generated file to concept/$1.png. Do not create or edit any other files.

$2

$STYLE" < /dev/null > concept/$1.log 2>&1
