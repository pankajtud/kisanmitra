/**
 * Seed values, not enums. Everything here is reference data the household can
 * edit — potato values are the starting point, never a hardcoded assumption
 * (CLAUDE.md §1).
 */

/** Grade codes are for storage and the printed register only. The UI shows a photo + the Hindi word. */
export const SEED_GRADES = [
  { code: 'M', labelHi: 'मोटा', labelEn: 'Mota (large)', sortOrder: 0 },
  { code: 'G', labelHi: 'गुल्ला', labelEn: 'Gulla (small, round)', sortOrder: 1 },
  { code: 'H', labelHi: 'हरा', labelEn: 'Hara (green)', sortOrder: 2 },
  { code: 'K', labelHi: 'किर्री', labelEn: 'Kirri (undersized)', sortOrder: 3 },
  { code: 'B', labelHi: 'बम्पर', labelEn: 'Bumper', sortOrder: 4 },
] as const;

export const SEED_EXPENSE_CATEGORIES = [
  { key: 'seed', labelHi: 'बीज', labelEn: 'Seed', icon: 'seed', sortOrder: 0 },
  { key: 'fertiliser', labelHi: 'खाद', labelEn: 'Fertiliser', icon: 'fertiliser', sortOrder: 1 },
  { key: 'labour', labelHi: 'मजदूरी', labelEn: 'Labour', icon: 'labour', sortOrder: 2 },
  { key: 'diesel', labelHi: 'डीजल', labelEn: 'Diesel', icon: 'diesel', sortOrder: 3 },
  { key: 'transport', labelHi: 'भाड़ा', labelEn: 'Transport', icon: 'transport', sortOrder: 4 },
  { key: 'storage_rent', labelHi: 'कोल्ड स्टोर किराया', labelEn: 'Storage rent', icon: 'storage', sortOrder: 5 },
  { key: 'other', labelHi: 'अन्य', labelEn: 'Other', icon: 'other', sortOrder: 6 },
] as const;

/** Informal plot names from the register — not survey numbers. */
export const SEED_FIELDS = [
  'Jaynagar',
  'Bhagat',
  'GG',
  'Saudan',
  'Bijali',
  'Gadhi',
  '3 Bigha',
] as const;

export const SEED_COLD_STORE = 'G.L. Cold Storage, Chitaura';

/**
 * What the household grows. Potato is one component, not the whole business —
 * wheat and mustard are sold straight off the field and never see a cold store
 * (CLAUDE.md §1).
 *
 * Only potato is graded into lots; everything else sells by weight.
 */
export const SEED_CROPS = [
  { nameHi: 'आलू', nameEn: 'Potato', defaultUnit: 'बोरा', usesColdStorage: true, defaultDurationMonths: 5, sortOrder: 0 },
  { nameHi: 'गेहूं', nameEn: 'Wheat', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 6, sortOrder: 1 },
  { nameHi: 'सरसों', nameEn: 'Mustard', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 5, sortOrder: 2 },
  { nameHi: 'धान', nameEn: 'Paddy', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 5, sortOrder: 3 },
  { nameHi: 'मटर', nameEn: 'Peas', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 4, sortOrder: 4 },
  // Sugarcane sits in the ground about a year — the reason duration is a
  // per-crop default rather than one number for the farm.
  { nameHi: 'गन्ना', nameEn: 'Sugarcane', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 12, sortOrder: 5 },
] as const;

/**
 * Units offered as taps. Stored as plain text on the row, so a household can
 * type anything these do not cover — units are reference data, not an enum (§1).
 */
export const SEED_UNITS = ['बोरा', 'कुंतल', 'किलो', 'लीटर', 'बोरी', 'ट्रॉली', 'नग'] as const;
