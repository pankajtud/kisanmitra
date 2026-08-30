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
