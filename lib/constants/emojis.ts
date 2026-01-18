/**
 * Animal Emoji Library
 *
 * Centralized emoji constants for the ShiftAware application.
 * Using named constants instead of inline unicode for maintainability.
 */

// ============================================================================
// RESERVED EMOJIS - Not available for team member selection
// ============================================================================

/** Admin role indicator emoji */
export const EMOJI_ADMIN = "🐻" as const;

/** Default/unassigned user emoji */
export const EMOJI_DEFAULT_USER = "🦥" as const;

/** App logo/branding emoji */
export const EMOJI_APP_LOGO = "🐙" as const;

/** All reserved emojis that cannot be used for team members */
export const RESERVED_EMOJIS = [
  EMOJI_ADMIN,
  EMOJI_DEFAULT_USER,
  EMOJI_APP_LOGO,
] as const;

// ============================================================================
// ANIMAL EMOJI CATEGORIES
// ============================================================================

/** Mammals - Land animals */
export const MAMMALS = {
  // Common pets & farm
  dog: "🐕",
  cat: "🐈",
  rabbit: "🐇",
  mouse: "🐁",
  hamster: "🐹",
  guineaPig: "🐹",
  horse: "🐴",
  cow: "🐄",
  pig: "🐷",
  sheep: "🐑",
  goat: "🐐",

  // Wild - Forest
  fox: "🦊",
  wolf: "🐺",
  bear: "🐻", // Reserved for admin
  deer: "🦌",
  moose: "🫎",
  boar: "🐗",
  badger: "🦡",
  raccoon: "🦝",
  skunk: "🦨",
  hedgehog: "🦔",
  squirrel: "🐿️",
  chipmunk: "🐿️",
  beaver: "🦫",
  otter: "🦦",

  // Wild - Jungle/Safari
  lion: "🦁",
  tiger: "🐯",
  leopard: "🐆",
  elephant: "🐘",
  rhinoceros: "🦏",
  hippopotamus: "🦛",
  giraffe: "🦒",
  zebra: "🦓",
  gorilla: "🦍",
  orangutan: "🦧",
  monkey: "🐒",

  // Wild - Other
  kangaroo: "🦘",
  koala: "🐨",
  panda: "🐼",
  sloth: "🦥", // Reserved for default user
  camel: "🐪",
  llama: "🦙",

  // Marine mammals
  whale: "🐋",
  dolphin: "🐬",
  seal: "🦭",

  // Small mammals
  bat: "🦇",
  rat: "🐀",
} as const;

/** Birds */
export const BIRDS = {
  // Common birds
  chicken: "🐔",
  rooster: "🐓",
  chick: "🐤",
  duck: "🦆",
  swan: "🦢",
  goose: "🪿",
  turkey: "🦃",
  peacock: "🦚",
  parrot: "🦜",
  flamingo: "🦩",

  // Wild birds
  eagle: "🦅",
  owl: "🦉",
  penguin: "🐧",
  dodo: "🦤",

  // Generic
  bird: "🐦",
  bluebird: "🐦‍⬛",
} as const;

/** Reptiles & Amphibians */
export const REPTILES = {
  crocodile: "🐊",
  turtle: "🐢",
  snake: "🐍",
  lizard: "🦎",
  dragon: "🐉",
  dinosaur: "🦕",
  trex: "🦖",
  frog: "🐸",
} as const;

/** Sea Creatures */
export const SEA_CREATURES = {
  fish: "🐟",
  tropicalFish: "🐠",
  blowfish: "🐡",
  shark: "🦈",
  octopus: "🐙",
  squid: "🦑",
  shrimp: "🦐",
  lobster: "🦞",
  crab: "🦀",
  jellyfish: "🪼",
  coral: "🪸",
} as const;

/** Insects & Bugs */
export const INSECTS = {
  butterfly: "🦋",
  bee: "🐝",
  ladybug: "🐞",
  beetle: "🪲",
  cricket: "🦗",
  cockroach: "🪳",
  ant: "🐜",
  mosquito: "🦟",
  fly: "🪰",
  worm: "🪱",
  caterpillar: "🐛",
  snail: "🐌",
  spider: "🕷️",
  scorpion: "🦂",
} as const;

/** Mythical Creatures */
export const MYTHICAL = {
  unicorn: "🦄",
  dragon: "🐲",
  phoenix: "🐦‍🔥",
} as const;

// ============================================================================
// COMBINED LISTS FOR UI
// ============================================================================

/** All animal emojis organized by category for the picker UI */
export const ANIMAL_EMOJI_CATEGORIES = {
  "🐾 Mammals": Object.entries(MAMMALS).map(([key, emoji]) => ({
    id: `mammals.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: RESERVED_EMOJIS.includes(
      emoji as (typeof RESERVED_EMOJIS)[number],
    ),
  })),
  "🐦 Birds": Object.entries(BIRDS).map(([key, emoji]) => ({
    id: `birds.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: false,
  })),
  "🦎 Reptiles": Object.entries(REPTILES).map(([key, emoji]) => ({
    id: `reptiles.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: false,
  })),
  "🐠 Sea Life": Object.entries(SEA_CREATURES).map(([key, emoji]) => ({
    id: `sea.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: false,
  })),
  "🦋 Insects": Object.entries(INSECTS).map(([key, emoji]) => ({
    id: `insects.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: false,
  })),
  "🦄 Mythical": Object.entries(MYTHICAL).map(([key, emoji]) => ({
    id: `mythical.${key}`,
    emoji,
    name: key.replace(/([A-Z])/g, " $1").trim(),
    reserved: false,
  })),
} as const;

/** Flat list of all available (non-reserved) emojis for validation */
export const ALL_ANIMAL_EMOJIS = [
  ...Object.values(MAMMALS),
  ...Object.values(BIRDS),
  ...Object.values(REPTILES),
  ...Object.values(SEA_CREATURES),
  ...Object.values(INSECTS),
  ...Object.values(MYTHICAL),
] as const;

/** Flat list of selectable emojis (excluding reserved) */
export const SELECTABLE_EMOJIS = ALL_ANIMAL_EMOJIS.filter(
  (emoji) =>
    !RESERVED_EMOJIS.includes(emoji as (typeof RESERVED_EMOJIS)[number]),
);

/** Type for any animal emoji */
export type AnimalEmoji = (typeof ALL_ANIMAL_EMOJIS)[number];

/** Type for selectable (non-reserved) emoji */
export type SelectableEmoji = (typeof SELECTABLE_EMOJIS)[number];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if an emoji is reserved (cannot be used for team members)
 */
export function isReservedEmoji(emoji: string): boolean {
  return RESERVED_EMOJIS.includes(emoji as (typeof RESERVED_EMOJIS)[number]);
}

/**
 * Check if an emoji is a valid animal emoji
 */
export function isValidAnimalEmoji(emoji: string): boolean {
  return ALL_ANIMAL_EMOJIS.includes(emoji as AnimalEmoji);
}

/**
 * Get emoji by category and key (e.g., "mammals.fox")
 */
export function getEmojiByKey(key: string): string | undefined {
  const [category, name] = key.split(".");
  switch (category) {
    case "mammals":
      return MAMMALS[name as keyof typeof MAMMALS];
    case "birds":
      return BIRDS[name as keyof typeof BIRDS];
    case "reptiles":
      return REPTILES[name as keyof typeof REPTILES];
    case "sea":
      return SEA_CREATURES[name as keyof typeof SEA_CREATURES];
    case "insects":
      return INSECTS[name as keyof typeof INSECTS];
    case "mythical":
      return MYTHICAL[name as keyof typeof MYTHICAL];
    default:
      return undefined;
  }
}
