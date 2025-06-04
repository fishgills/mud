/**
 * Settlement and landmark generation for the MUD world system.
 * Handles placement of cities, villages, hamlets, and various landmarks.
 */

export interface Settlement {
  id: number;
  name: string;
  type: SettlementType;
  x: number;
  y: number;
  size: SettlementSize;
  population: number;
  description: string;
}

export interface Landmark {
  id: number;
  name: string;
  type: LandmarkType;
  x: number;
  y: number;
  description: string;
}

export enum SettlementType {
  CITY = 'city',
  TOWN = 'town',
  VILLAGE = 'village',
  HAMLET = 'hamlet',
}

export enum SettlementSize {
  LARGE = 'large',
  MEDIUM = 'medium',
  SMALL = 'small',
  TINY = 'tiny',
}

export enum LandmarkType {
  RUINS = 'ruins',
  TOWER = 'tower',
  SHRINE = 'shrine',
  BRIDGE = 'bridge',
  CAVE = 'cave',
  STANDING_STONES = 'standing_stones',
  ANCIENT_TREE = 'ancient_tree',
  ABANDONED_MINE = 'abandoned_mine',
  OLD_BATTLEFIELD = 'old_battlefield',
  FORGOTTEN_TEMPLE = 'forgotten_temple',
  WATCHTOWER = 'watchtower',
  STONE_CIRCLE = 'stone_circle',
}

// Settlement configuration
export const SETTLEMENT_CONFIG = {
  // Minimum distance between settlements of same type
  minDistances: {
    [SettlementType.CITY]: 150,
    [SettlementType.TOWN]: 80,
    [SettlementType.VILLAGE]: 40,
    [SettlementType.HAMLET]: 20,
  },
  // Population ranges for each settlement type
  populationRanges: {
    [SettlementType.CITY]: [5000, 15000],
    [SettlementType.TOWN]: [1000, 4999],
    [SettlementType.VILLAGE]: [200, 999],
    [SettlementType.HAMLET]: [50, 199],
  },
  // Density per 1000x1000 area
  density: {
    [SettlementType.CITY]: 2, // 2 cities per 1M tiles
    [SettlementType.TOWN]: 5, // 5 towns per 1M tiles
    [SettlementType.VILLAGE]: 15, // 15 villages per 1M tiles
    [SettlementType.HAMLET]: 30, // 30 hamlets per 1M tiles
  },
  // Preferred biomes for settlements (biome name -> preference weight)
  biomePreferences: {
    plains: 10,
    hills: 8,
    forest: 6,
    savanna: 5,
    beach: 4,
    taiga: 3,
    lake: 2, // Near water is good
    desert: 1,
    // Settlements avoid: ocean, mountains, tundra, swamp, jungle, rainforest
  },
};

// Landmark configuration
export const LANDMARK_CONFIG = {
  // Density per 1000x1000 area
  density: 50, // 50 landmarks per 1M tiles
  // Minimum distance between landmarks
  minDistance: 25,
  // Landmark type distributions (weight-based)
  typeWeights: {
    [LandmarkType.RUINS]: 15,
    [LandmarkType.TOWER]: 10,
    [LandmarkType.SHRINE]: 8,
    [LandmarkType.CAVE]: 12,
    [LandmarkType.STANDING_STONES]: 6,
    [LandmarkType.ANCIENT_TREE]: 8,
    [LandmarkType.ABANDONED_MINE]: 7,
    [LandmarkType.OLD_BATTLEFIELD]: 5,
    [LandmarkType.FORGOTTEN_TEMPLE]: 4,
    [LandmarkType.WATCHTOWER]: 9,
    [LandmarkType.STONE_CIRCLE]: 6,
    [LandmarkType.BRIDGE]: 10,
  },
  // Biome preferences for different landmark types
  biomePreferences: {
    [LandmarkType.RUINS]: ['plains', 'hills', 'forest', 'desert'],
    [LandmarkType.TOWER]: ['hills', 'plains', 'mountains'],
    [LandmarkType.SHRINE]: ['forest', 'mountains', 'hills'],
    [LandmarkType.CAVE]: ['mountains', 'hills'],
    [LandmarkType.STANDING_STONES]: ['plains', 'hills', 'tundra'],
    [LandmarkType.ANCIENT_TREE]: ['forest', 'jungle', 'rainforest'],
    [LandmarkType.ABANDONED_MINE]: ['mountains', 'hills'],
    [LandmarkType.OLD_BATTLEFIELD]: ['plains', 'hills'],
    [LandmarkType.FORGOTTEN_TEMPLE]: ['jungle', 'rainforest', 'forest'],
    [LandmarkType.WATCHTOWER]: ['hills', 'mountains'],
    [LandmarkType.STONE_CIRCLE]: ['plains', 'hills'],
    [LandmarkType.BRIDGE]: ['lake', 'beach'], // Near water
  },
};

// Name generators
export const SETTLEMENT_NAMES = {
  prefixes: [
    'North',
    'South',
    'East',
    'West',
    'Upper',
    'Lower',
    'Old',
    'New',
    'Great',
    'Little',
    'High',
    'Deep',
    'White',
    'Red',
    'Green',
    'Blue',
    'Stone',
    'Iron',
    'Gold',
    'Silver',
    'Dark',
    'Bright',
    'Fair',
    'Grim',
  ],
  roots: [
    'haven',
    'ford',
    'bridge',
    'gate',
    'brook',
    'hill',
    'vale',
    'dale',
    'wood',
    'field',
    'marsh',
    'moor',
    'ridge',
    'peak',
    'bay',
    'port',
    'mill',
    'well',
    'spring',
    'fall',
    'glen',
    'hollow',
    'bend',
    'cross',
    'fort',
    'burg',
    'wick',
    'ton',
    'ham',
    'stead',
    'thorpe',
    'by',
  ],
  suffixes: [
    'ton',
    'ham',
    'burg',
    'wick',
    'ford',
    'haven',
    'shire',
    'land',
    'field',
    'wood',
    'hill',
    'vale',
    'dale',
    'moor',
    'ridge',
    'bay',
  ],
};

export const LANDMARK_NAMES = {
  ruins: [
    'Ancient Ruins',
    'Crumbling Keep',
    'Fallen Tower',
    'Lost City',
    'Broken Walls',
    'Ruined Palace',
    'Forgotten Fortress',
    'Collapsed Temple',
    'Old Battlements',
  ],
  tower: [
    'Lonely Tower',
    'Watch Tower',
    "Wizard's Tower",
    'Bell Tower',
    'Signal Tower',
    'Tall Spire',
    'Ancient Lighthouse',
    "Crow's Perch",
    'Sky Needle',
  ],
  shrine: [
    'Forgotten Shrine',
    'Roadside Shrine',
    'Ancient Altar',
    'Sacred Grove',
    'Holy Spring',
    "Pilgrim's Rest",
    'Divine Marker',
    'Blessed Stone',
  ],
  cave: [
    'Deep Cave',
    'Hidden Grotto',
    'Echo Chamber',
    'Crystal Cave',
    "Bear's Den",
    'Shadowy Depths',
    'Whispering Cave',
    'Secret Hollow',
    'Dark Passage',
  ],
  standing_stones: [
    'Standing Stones',
    'Ancient Monoliths',
    'Stone Sentinels',
    'Weathered Pillars',
    'Sacred Stones',
    'Mystic Markers',
    'Old Guardians',
    'Silent Watchers',
  ],
  ancient_tree: [
    'Ancient Oak',
    'Elder Tree',
    'Great Willow',
    'Sacred Grove',
    'Wise Old Tree',
    'Giant Redwood',
    'Millennium Pine',
    'Mother Tree',
    'World Tree',
  ],
  abandoned_mine: [
    'Old Mine',
    'Abandoned Shaft',
    'Dark Pit',
    'Forgotten Dig',
    'Lost Mine',
    'Deep Quarry',
    'Empty Tunnels',
    'Worked-out Mine',
    'Ghost Mine',
  ],
  old_battlefield: [
    'Old Battlefield',
    'Blood Plain',
    'War Memorial',
    "Fallen Heroes' Field",
    'Last Stand',
    'Battle Scars',
    'Bone Field',
    'Victory Plain',
    'Mourning Ground',
  ],
  forgotten_temple: [
    'Forgotten Temple',
    'Lost Sanctuary',
    'Overgrown Temple',
    'Ruined Cathedral',
    'Ancient Chapel',
    'Sacred Ruins',
    'Divine Remnants',
    'Holy Wreckage',
  ],
  watchtower: [
    'Old Watchtower',
    'Border Post',
    'Guard Tower',
    'Sentinel Point',
    'Watch Keep',
    'Signal Post',
    'Sentry Tower',
    'Lookout Point',
  ],
  stone_circle: [
    'Stone Circle',
    'Druid Ring',
    'Ancient Circle',
    'Sacred Ring',
    'Mystic Circle',
    'Ritual Stones',
    'Moon Circle',
    'Star Ring',
    'Elder Circle',
  ],
  bridge: [
    'Old Bridge',
    'Stone Bridge',
    'Wooden Bridge',
    'Rope Bridge',
    'Ancient Crossing',
    'Forgotten Span',
    'Moss-covered Bridge',
    'Crumbling Arch',
    'Lost Passage',
  ],
};
