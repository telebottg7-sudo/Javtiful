import {
  CodesIndexFile,
  ActressesIndexFile,
  StudiosIndexFile,
  VideosIndexFile,
  ActressEntity,
  StudioEntity,
} from "./types";

/**
 * Normalizes an actress or studio name into a deterministic URL/file slug.
 * e.g., "Yua Mikami" -> "yua-mikami", "S1 NO.1 STYLE" -> "s1-no-1-style"
 */
export function normalizeSlug(name: string): string {
  if (!name) return "unnamed";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // replace symbols and whitespace with hyphens
    .replace(/^-+|-+$/g, "") // trim leading/trailing hyphens
    .substring(0, 100) || "unnamed";
}

/**
 * Returns the alphabetical shard directory letter ('a' through 'z', or '_' for symbols/numbers).
 */
export function getShardLetter(nameOrSlug: string): string {
  const clean = normalizeSlug(nameOrSlug);
  const firstChar = clean.charAt(0);
  if (firstChar >= "a" && firstChar <= "z") {
    return firstChar;
  }
  return "_";
}

/**
 * Computes the canonical relative storage path for an actress entity.
 * e.g. "yua-mikami" -> "pstar/y/yua-mikami.json"
 */
export function getActressPath(slugOrName: string): string {
  const slug = normalizeSlug(slugOrName);
  const letter = getShardLetter(slug);
  return `pstar/${letter}/${slug}.json`;
}

/**
 * Computes the canonical relative storage path for a studio entity.
 * e.g. "s1-no-1-style" -> "studio/s/s1-no-1-style.json"
 */
export function getStudioPath(slugOrName: string): string {
  const slug = normalizeSlug(slugOrName);
  const letter = getShardLetter(slug);
  return `studio/${letter}/${slug}.json`;
}

/**
 * Deterministically normalizes video release codes.
 * e.g. "ssis 001" -> "SSIS-001", "abp-123" -> "ABP-123", "IPX-054" -> "IPX-054"
 */
export function normalizeCode(rawCode: string): string | null {
  if (!rawCode) return null;
  const trimmed = rawCode.trim().toUpperCase();

  // Multi-segment formats like "10MUSUME-050515_01" or "CARIBBEANCOM-050515-001"
  const multiSegmentMatch = trimmed.match(/^([A-Z0-9]{3,15})[\s\-_]+([0-9]{6})[\s\-_]+([0-9]{2,4})$/);
  if (multiSegmentMatch) {
    return `${multiSegmentMatch[1]}-${multiSegmentMatch[2]}-${multiSegmentMatch[3]}`;
  }

  // Standard alphanumeric code format: 2-8 letters, optional space/hyphen/underscore, 2-7 digits
  const standardMatch = trimmed.match(/^([A-Z0-9]{2,8})[\s\-_]+([0-9]{2,7})$/);
  if (standardMatch) {
    const prefix = standardMatch[1];
    const num = standardMatch[2];
    return `${prefix}-${num}`;
  }

  // Codes without separators like "SSIS001"
  const compactMatch = trimmed.match(/^([A-Z]{2,6})([0-9]{3,5})$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}`;
  }

  // Clean fallback: replace spaces and underscores with hyphens
  const cleaned = trimmed.replace(/[\s_]+/g, "-");
  if (/^[A-Z0-9\-]{3,25}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Factory for a new, valid empty CodesIndexFile (database/index/codes.json)
 */
export function createInitialCodesIndex(): CodesIndexFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalCount: 0,
    codes: {},
  };
}

/**
 * Factory for a new, valid empty ActressesIndexFile (database/index/actresses.json)
 */
export function createInitialActressesIndex(): ActressesIndexFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalCount: 0,
    actresses: [],
  };
}

/**
 * Factory for a new, valid empty StudiosIndexFile (database/index/studios.json)
 */
export function createInitialStudiosIndex(): StudiosIndexFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalCount: 0,
    studios: [],
  };
}

/**
 * Factory for a new, valid empty VideosIndexFile (database/index/videos.json)
 */
export function createInitialVideosIndex(): VideosIndexFile {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    totalCount: 0,
    videos: [],
  };
}

/**
 * Factory for a new Actress entity record (database/pstar/{letter}/{slug}.json)
 */
export function createInitialActressEntity(
  name: string,
  aliases: string[] = [],
  thumbnail?: string
): ActressEntity {
  const slug = normalizeSlug(name);
  const letter = getShardLetter(slug);
  const now = new Date().toISOString();

  return {
    slug,
    name: name.trim(),
    letter,
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    thumbnail: thumbnail || "",
    videoCount: 0,
    videos: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Factory for a new Studio entity record (database/studio/{letter}/{slug}.json)
 */
export function createInitialStudioEntity(
  name: string,
  aliases: string[] = [],
  thumbnail?: string
): StudioEntity {
  const slug = normalizeSlug(name);
  const letter = getShardLetter(slug);
  const now = new Date().toISOString();

  return {
    slug,
    name: name.trim(),
    letter,
    aliases: aliases.map((a) => a.trim()).filter(Boolean),
    thumbnail: thumbnail || "",
    videoCount: 0,
    videos: [],
    createdAt: now,
    updatedAt: now,
  };
}
