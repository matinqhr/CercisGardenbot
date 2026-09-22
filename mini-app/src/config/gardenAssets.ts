export const GARDEN_ASSETS = {
  terrain: {
    grass: 'assets/tiles/grass.png',
    dirt: 'assets/tiles/dirt.png',
    path: 'assets/tiles/path.png',
    water: 'assets/tiles/water.png',
  },
  nature: {
    treeDeciduous: 'assets/nature/tree-deciduous.png',
    treeEvergreen: 'assets/nature/tree-evergreen.png',
    bush: 'assets/nature/bush.png',
    flowers: 'assets/nature/flowers.png',
    rock: 'assets/nature/rock.png',
    mushroom: 'assets/nature/mushroom.png',
  },
  furniture: {
    bench: 'assets/furniture/bench.png',
    lamp: 'assets/furniture/lamp.png',
  },
  identity: {
    radio: 'assets/identity/radio.png',
    crate: 'assets/identity/crate.png',
  },
} as const;

export type GardenAssetPath =
  typeof GARDEN_ASSETS[keyof typeof GARDEN_ASSETS][keyof typeof GARDEN_ASSETS[keyof typeof GARDEN_ASSETS]];
