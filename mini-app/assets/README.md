# Cercis Garden — Asset Specification v1

## Visual Direction

- Style: cozy 16-bit pixel art
- Perspective: 3/4 top-down / isometric
- World: tile-based
- Base logical unit: 32 px
- Object footprint: aligned to the 32 px world grid
- Pixel rendering: nearest-neighbor / no smoothing
- Lighting: one consistent light direction across the whole garden
- Palette: natural greens, earthy browns and stone grays, with restrained Cercis purple accents
- Mood: quiet, warm, slightly nostalgic, with subtle old-industrial details
- Silhouette: readable at mobile scale
- Detail: medium; important interactive objects may have more detail than background tiles

## Visual Hierarchy

### Garden
Natural, calm, readable.

### Industrial / Cercis elements
Weathered metal, wood, cables, tanks, old machinery. These should feel old rather than futuristic.

### Home identity
Small recurring purple/blue accents can connect the garden to the Cercis brand without turning the whole scene purple.

## Asset Categories

- terrain
- paths
- trees
- bushes
- flowers
- rocks
- water
- fences
- furniture
- structures
- interactive objects
- decorative objects
- special Cercis objects

## First MVP Asset Set

Terrain:
- grass tile
- dirt tile
- path tile
- water tile

Nature:
- deciduous tree
- evergreen tree
- small bush
- flower cluster
- rock
- mushroom

Furniture:
- bench
- lamp

Identity:
- vintage radio
- small industrial crate

## Rules

1. Do not mix unrelated pixel-art packs without checking perspective, pixel density, palette and lighting.
2. Do not use glossy 3D-looking assets.
3. Do not use smooth vector/HD illustrations inside the garden.
4. The radio is an important interactive object and should remain visually distinctive.
5. Cercis itself does not appear as a walking character in the Garden.
6. Every placeable object should have a defined grid footprint and interaction state.
7. Asset selection comes before final object placement and decoration.

## Implementation Notes

The current Garden uses procedural placeholder shapes. Those remain temporary.
The next implementation step is to replace placeholders with real sprite assets while keeping the existing large-world camera, panning and object-sorting architecture.
