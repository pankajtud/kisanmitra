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
 * What this household grows. Potato is one component, not the whole business —
 * everything else is sold straight off the field and never sees a cold store
 * (CLAUDE.md §1).
 *
 * Durations are ASSUMPTIONS about how long each crop holds the ground; they only
 * prefill a khata's intended length and are editable per khata. Correct them
 * against what is actually planted — see docs/open-questions.md Q22.
 */
export const SEED_CROPS = [
  { nameHi: 'देशी मिर्च', nameEn: 'Deshi Mirch', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 6, sortOrder: 0 },
  { nameHi: 'शिमला मिर्च', nameEn: 'Shimla Mirch', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 5, sortOrder: 1 },
  { nameHi: 'खीरा', nameEn: 'Kheera', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 3, sortOrder: 2 },
  { nameHi: 'गोभी', nameEn: 'Gobhi', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 4, sortOrder: 3 },
  { nameHi: 'खरबूजा', nameEn: 'Kharbooja', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 3, sortOrder: 4 },
  { nameHi: 'तरबूज', nameEn: 'Tarbooj', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 3, sortOrder: 5 },
  { nameHi: 'अरबी', nameEn: 'Arabi', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 6, sortOrder: 6 },
  { nameHi: 'कशीफल', nameEn: 'Kashifal', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 4, sortOrder: 7 },
  { nameHi: 'पेठा', nameEn: 'Petha', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 5, sortOrder: 8 },
  // The only one that goes into cold storage as graded lots.
  { nameHi: 'आलू', nameEn: 'Aloo', defaultUnit: 'बोरा', usesColdStorage: true, defaultDurationMonths: 5, sortOrder: 9 },
  { nameHi: 'बाजरा', nameEn: 'Bajra', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 4, sortOrder: 10 },
  { nameHi: 'गेहूँ', nameEn: 'Gehoon', defaultUnit: 'कुंतल', usesColdStorage: false, defaultDurationMonths: 6, sortOrder: 11 },
] as const;

/**
 * Units offered as taps. Stored as plain text on the row, so a household can
 * type anything these do not cover — units are reference data, not an enum (§1).
 */
export const SEED_UNITS = ['बोरा', 'कुंतल', 'किलो', 'लीटर', 'बोरी', 'ट्रॉली', 'नग'] as const;
