#!/usr/bin/env bash
# Generates Hammerguy's Party's raw art with gpt-image-2 through the Codex CLI
# (codex-bridge plugin). Raw PNGs land in art/raw/; art/process.mjs turns them
# into the web textures in client/public/fx/.
#   art/gen.sh            # everything missing
#   art/gen.sh tex_grass  # just these
set -uo pipefail
ART="$(cd "$(dirname "$0")" && pwd)"
OUT="${ART_OUT:-$ART/raw}"
cd "$OUT" 2>/dev/null || { mkdir -p "$OUT"; cd "$OUT"; }
GEN="${CODEX_IMAGEGEN:-codex-imagegen}"


STYLE="Hand-painted texture in the style of Warcraft III (2002) by Blizzard: painterly, slightly exaggerated, rich but not neon colours, soft brush detail, readable from an overhead RTS camera. No text, no logos, no watermark, no border."
TILE="A seamless tileable square texture that wraps perfectly on all four edges, viewed straight down, flat even lighting, no perspective, no vignette, no large single features, no objects casting shadows."
BLACK="Centered on a pure black #000000 background with generous empty black margins; nothing touches the edges. Glowing and light parts only; the black stays perfectly black so it can be used with additive blending."
MASK="Pure white shapes on a pure black #000000 background, greyscale only, soft feathered edges, generous empty black margin, nothing touches the edges. It will be used as an alpha mask."

declare -A P
P[tex_grass]="$STYLE $TILE Lordaeron summer grass ground tile: lush short green grass with painted clumps, a few tiny clover leaves and small yellow flowers, subtle variation of warm and cool greens."
P[tex_dirt]="$STYLE $TILE Barrens-style rough dirt ground tile: warm ochre and reddish-brown packed earth with small pebbles, cracks and scuffs, for a sunken arena pit where catapult rocks land."
P[tex_nightgrass]="$STYLE $TILE Ashenvale night forest floor tile: dark blue-green moss and grass with a few fallen leaves and tiny glowing blue specks, moonlit cool palette."
P[tex_stone]="$STYLE $TILE Lordaeron paved stone tiles: worn square grey flagstones with mossy seams and chipped corners, human town square."
P[tex_snow]="$STYLE $TILE Northrend ice floe tile: pale blue-white packed snow over clear ice with faint cracks and frost patterns."
P[tex_boulder]="$STYLE $TILE Rough granite boulder rock surface: grey-brown stone with chisel facets, cracks and lichen specks, for wrapping onto catapult ammunition and rocks."
P[tex_wood]="$STYLE $TILE Orcish siege engine timber: rough dark brown wooden planks with iron bolts and red-brown stains, grain running left to right."
P[tex_sand]="$STYLE $TILE Barrens / Durotar desert sand ground tile: pale golden-tan sand with soft wind ripples, a few tiny scattered pebbles and faint darker sand patches, warm but not orange or red."
P[tex_ice]="$STYLE $TILE Icecrown Glacier dark ice ground tile: deep blue and teal translucent ice with white frost veins, fine cracks and a few patches of packed snow."
P[tex_rock]="$STYLE $TILE Lordaeron rough rocky ground tile: broken grey-brown bedrock and flat stone slabs with gravel and small tufts of dry grass in the cracks, mid-tone."
P[tex_marble]="$STYLE $TILE Ornate marble floor tiles from a human city or temple: large square cream and pale grey marble slabs with soft veining, thin dark grout lines and a subtle worn border pattern."
P[fx_explosion_sheet]="$STYLE A 4x4 grid sprite sheet of 16 animation frames of a fiery siege-rock explosion, read left to right then top to bottom: a white-hot flash, a swelling orange fireball with rolling flames, then breaking up into embers and dark red wisps that fade to nothing in the last frame. Each frame centred in its own equal square cell. $BLACK"
P[fx_fireball]="$STYLE A single burning demolisher boulder projectile seen from the side, flying left to right: a dark rock wrapped in bright orange flames with a short fiery tail streaming behind it to the left. $BLACK"
P[fx_purge]="$STYLE A single swirling magical purge effect seen from above: a spiral vortex of pale cyan and white arcane wind with small sparkles, like the Warcraft III shaman Purge spell. $BLACK"
P[fx_dust_mask]="A 2x2 grid of four different soft billowing dust cloud puffs, each centred in its own quarter, fluffy and irregular, for particle effects. $MASK"
P[fx_scorch_mask]="A single ground scorch mark decal seen from directly above: a ragged burnt circle with splatter streaks radiating outward and a darker centre, like the crater left by a catapult boulder. $MASK"
P[fx_debris]="$STYLE A 2x2 grid of four chunky broken rock and dirt fragments, each centred in its own quarter, grey-brown stone with sharp facets, lit from the top left. On a perfectly flat solid #FF00FF magenta background, one uniform colour, no shadows, no gradients, nothing magenta in the rocks."
P[fx_flames_sheet]="$STYLE A 4x4 grid sprite sheet of 16 animation frames of a single campfire flame, read left to right then top to bottom: tongues of orange and yellow fire licking upward from a narrow base, flickering and changing shape each frame, tips breaking off into wisps, like the burning-building fire in Warcraft III. Each frame centred low in its own equal square cell with the flame pointing straight up. $BLACK"
P[fx_shockwave]="$STYLE A single ring-shaped ground shockwave seen from directly above: a thin bright circle of dusty light with a soft inner falloff and faint radial streaks, perfectly round. $BLACK"
P[tex_fur]="$STYLE $TILE Shaggy brown bear fur pelt: thick painted tufts of warm brown and dark umber hair flowing in one direction, for an orc beastmaster's cloak."
P[tex_hide]="$STYLE $TILE Kodo beast hide: thick wrinkled grey-brown leathery skin with darker folds, scattered warts and faint scars, like the Warcraft III kodo beast."
P[tex_leather]="$STYLE $TILE Orcish leather and cloth: stitched dark red-brown leather panels with rough seams, rivets and a few scratches, for armour straps and saddles."
P[tex_plate]="$STYLE $TILE Human paladin plate armour metal: brushed silver steel with soft painted highlights, faint scratches and a few engraved gold filigree lines, used on armour."
P[tex_bark]="$STYLE $TILE Pine tree bark: deep vertical furrows of dark brown and grey bark plates with a hint of moss, for tree trunks."
P[tex_needles]="$STYLE $TILE Dense pine needle foliage seen close up: overlapping clumps of dark green and blue-green needles with lighter tips, painterly, for Lordaeron pine tree canopies."

want=("$@")
[ ${#want[@]} -eq 0 ] && want=("${!P[@]}")
run() {
  local k=$1
  if [ -f "$k.png" ]; then echo "skip $k"; return; fi
  echo "gen $k"
  "$GEN" "${P[$k]}" "$k.png" >"$k.log" 2>&1 && echo "done $k" || echo "FAIL $k"
}
n=0
for k in "${want[@]}"; do
  run "$k" &
  n=$((n + 1))
  if [ $((n % 3)) -eq 0 ]; then wait; fi
done
wait
