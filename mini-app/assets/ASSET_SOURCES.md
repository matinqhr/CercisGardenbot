# Cercis Garden — Asset Source Plan v1

## Visual roles

We are deliberately using one visual language, not one single asset pack.

### A. Environment
Target: cozy 16-bit pixel art, 3/4 isometric, readable natural forms.
Needed first:
- grass
- dirt
- path
- water
- tree
- bush
- flower
- rock

### B. Signature objects
Target: slightly richer pixel-art sprites, still consistent with the environment.
Needed first:
- bench
- lamp
- vintage radio
- small industrial crate

### C. Cercis identity
Target: old industrial + garden.
- weathered metal
- wood
- restrained purple/blue accents
- no glossy sci-fi

## Candidate sources checked

### SmashyStashy — Peaceful Pond and Meadow Isometric Pixel Tileset
URL: https://smashystashy.itch.io/grassy-pond-isometric-tileset
License: free / pay-what-you-want; page does not state a restrictive attribution requirement.
Contains 48 isometric pixel-art tiles including grass, edges, flowers, logs, stones, bushes, tall grass, trees, mud, dirt paths and water.
Use: strong candidate for an environment prototype, subject to verifying the downloaded asset dimensions and exact license text before committing files.

### OpenGameArt — Pixel Art Isometric Terrain Tiles
URL: https://opengameart.org/content/pixel-art-isometric-terrain-tiles
License: CC0.
Contains 32x32 isometric terrain PNG assets.
Use: useful as a clean CC0 terrain reference/candidate for the 32px world grid.

### Kenney — Isometric Tiles Landscape
URL: https://kenney.nl/assets/isometric-tiles-landscape
License: CC0.
Contains 128 isometric landscape files.
Use: technical/prototyping reference; visual style is less pixel-art-specific than the Cercis target, so it should not define the final art direction.

### Mini Meadow — 16x16 Pixel-Art Tileset
URL: https://myobln.itch.io/game-assets
License: CC0.
Contains grass, dirt, sand, stone, animated water, path/edge tiles, flowers, mushrooms, rocks, pebbles, grass, bush, log and stump.
Use: excellent source/reference for small natural details, but it is top-down rather than the required 3/4 isometric perspective, so it should not be mixed directly into the final Garden without a deliberate style decision.

## Rule for final selection

Do not commit a large mixed asset collection yet.

First make a tiny visual test containing:
1. one grass tile
2. one dirt/path tile
3. one tree
4. one bush
5. one flower
6. one rock
7. one bench
8. one radio

The test is successful only if these eight assets look like they belong to the same game when placed together.

## Important

The Pinterest images supplied during the design discussion are treated as visual references, not as source assets to copy into the repository. Final repository assets should have a clear license or be created specifically for the project.
