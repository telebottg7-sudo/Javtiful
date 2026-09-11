import { GitHubStorage } from "../storage/githubStorage";
import {
  CodesIndexFile,
  CodeIndexSummary,
} from "../schema/types";
import {
  normalizeCode,
  createInitialCodesIndex,
} from "../schema/normalizers";
import { validateCodesIndex } from "../schema/validators";

export interface CodeCheckResult {
  rawCode: string;
  normalizedCode: string | null;
  isValidFormat: boolean;
  isDuplicate: boolean;
  entry?: CodeIndexSummary;
}

export interface RegisterCodeItem {
  code: string;
  title?: string;
  postUrl?: string;
  actressSlug?: string;
  actressName?: string;
  studioSlug?: string;
  studioName?: string;
}

export interface RegisterCodesResult {
  success: boolean;
  registered: string[];
  duplicates: string[];
  invalid: string[];
  totalCount: number;
  commitSha?: string;
}

export class CodeRegistryService {
  private storage: GitHubStorage;
  private readonly indexPath = "index/codes.json";
  private cachedIndex: CodesIndexFile | null = null;
  private cachedSha: string | null = null;
  private lastFetchedAt = 0;
  private readonly cacheTtlMs = 60 * 1000; // 1 minute cache TTL

  constructor(storage: GitHubStorage) {
    this.storage = storage;
  }

  /**
   * Ensures the index is loaded in memory for fast O(1) checks.
   */
  async getOrLoadIndex(forceRefresh = false): Promise<{ index: CodesIndexFile; sha: string | null }> {
    const now = Date.now();
    if (!forceRefresh && this.cachedIndex && now - this.lastFetchedAt < this.cacheTtlMs) {
      return { index: this.cachedIndex, sha: this.cachedSha };
    }

    const file = await this.storage.readFile<CodesIndexFile>(this.indexPath);
    if (!file) {
      // If the file doesn't exist yet, initialize an empty index in memory
      const initial = createInitialCodesIndex();
      this.cachedIndex = initial;
      this.cachedSha = null;
      this.lastFetchedAt = now;
      return { index: initial, sha: null };
    }

    const validation = validateCodesIndex(file.data);
    if (!validation.valid) {
      console.warn("Codes index failed validation, fallback to clean format:", validation.errors);
      const safeIndex: CodesIndexFile = {
        version: file.data?.version ?? 1,
        updatedAt: file.data?.updatedAt ?? new Date().toISOString(),
        totalCount: Object.keys(file.data?.codes ?? {}).length,
        codes: file.data?.codes ?? {},
      };
      this.cachedIndex = safeIndex;
      this.cachedSha = file.sha;
      this.lastFetchedAt = now;
      return { index: safeIndex, sha: file.sha };
    }

    this.cachedIndex = file.data;
    this.cachedSha = file.sha;
    this.lastFetchedAt = now;
    return { index: file.data, sha: file.sha };
  }

  /**
   * Fast O(1) check for a single video code.
   */
  async checkCode(rawCode: string): Promise<CodeCheckResult> {
    const normalized = normalizeCode(rawCode);
    if (!normalized) {
      return {
        rawCode,
        normalizedCode: null,
        isValidFormat: false,
        isDuplicate: false,
      };
    }

    const { index } = await this.getOrLoadIndex();
    const entry = index.codes[normalized];

    return {
      rawCode,
      normalizedCode: normalized,
      isValidFormat: true,
      isDuplicate: Boolean(entry),
      entry,
    };
  }

  /**
   * Batch checks a list of candidate codes in O(1) per item against the in-memory cache.
   */
  async checkBatch(rawCodes: string[]): Promise<CodeCheckResult[]> {
    const { index } = await this.getOrLoadIndex();
    return rawCodes.map((raw) => {
      const normalized = normalizeCode(raw);
      if (!normalized) {
        return {
          rawCode: raw,
          normalizedCode: null,
          isValidFormat: false,
          isDuplicate: false,
        };
      }
      const entry = index.codes[normalized];
      return {
        rawCode: raw,
        normalizedCode: normalized,
        isValidFormat: true,
        isDuplicate: Boolean(entry),
        entry,
      };
    });
  }

  /**
   * Atomically registers new codes into the master codes.json file on GitHub.
   * Pulls the latest SHA first to prevent race conditions.
   */
  async registerCodes(items: RegisterCodeItem[]): Promise<RegisterCodesResult> {
    // Always force refresh to get latest state and SHA for atomic write
    const { index: currentIndex, sha: currentSha } = await this.getOrLoadIndex(true);

    const registered: string[] = [];
    const duplicates: string[] = [];
    const invalid: string[] = [];

    const now = new Date().toISOString();
    const updatedCodes: Record<string, CodeIndexSummary> = { ...currentIndex.codes };

    for (const item of items) {
      const normalized = normalizeCode(item.code);
      if (!normalized) {
        invalid.push(item.code);
        continue;
      }

      if (updatedCodes[normalized]) {
        duplicates.push(normalized);
        continue;
      }

      // Add to index
      updatedCodes[normalized] = {
        code: normalized,
        title: item.title,
        postUrl: item.postUrl,
        actressSlug: item.actressSlug,
        actressName: item.actressName,
        studioSlug: item.studioSlug,
        studioName: item.studioName,
        addedAt: now,
      };
      registered.push(normalized);
    }

    // If no new codes were registered, return early without touching GitHub
    if (registered.length === 0) {
      return {
        success: true,
        registered: [],
        duplicates,
        invalid,
        totalCount: Object.keys(updatedCodes).length,
      };
    }

    const updatedIndexFile: CodesIndexFile = {
      version: currentIndex.version || 1,
      updatedAt: now,
      totalCount: Object.keys(updatedCodes).length,
      codes: updatedCodes,
    };

    const commitMessage = `[Code Registry] Register ${registered.length} code(s): ${registered.slice(0, 3).join(", ")}${registered.length > 3 ? "..." : ""}`;

    const writeResult = await this.storage.writeFile(
      this.indexPath,
      updatedIndexFile,
      commitMessage,
      currentSha || undefined
    );

    // Update local cache
    this.cachedIndex = updatedIndexFile;
    this.cachedSha = writeResult.sha;
    this.lastFetchedAt = Date.now();

    return {
      success: true,
      registered,
      duplicates,
      invalid,
      totalCount: updatedIndexFile.totalCount,
      commitSha: writeResult.sha,
    };
  }

  /**
   * Safely unregisters/removes a code (useful for test rollbacks or corrections).
   */
  async unregisterCode(code: string): Promise<boolean> {
    const normalized = normalizeCode(code);
    if (!normalized) return false;

    const { index: currentIndex, sha: currentSha } = await this.getOrLoadIndex(true);
    if (!currentIndex.codes[normalized]) return false;

    const updatedCodes = { ...currentIndex.codes };
    delete updatedCodes[normalized];

    const updatedIndexFile: CodesIndexFile = {
      version: currentIndex.version || 1,
      updatedAt: new Date().toISOString(),
      totalCount: Object.keys(updatedCodes).length,
      codes: updatedCodes,
    };

    const writeResult = await this.storage.writeFile(
      this.indexPath,
      updatedIndexFile,
      `[Code Registry] Unregister code: ${normalized}`,
      currentSha || undefined
    );

    this.cachedIndex = updatedIndexFile;
    this.cachedSha = writeResult.sha;
    this.lastFetchedAt = Date.now();

    return true;
  }

  /**
   * Retrieves summary statistics for the codes registry.
   */
  async getStats(): Promise<{
    totalCount: number;
    updatedAt: string;
    cacheAgeMs: number;
    sampleCodes: string[];
  }> {
    const { index } = await this.getOrLoadIndex();
    const codesList = Object.keys(index.codes);
    return {
      totalCount: index.totalCount || codesList.length,
      updatedAt: index.updatedAt,
      cacheAgeMs: Date.now() - this.lastFetchedAt,
      sampleCodes: codesList.slice(0, 10),
    };
  }

  /**
   * Automated verification test runner for Step 4 stop rule.
   */
  async runDeduplicationTest(): Promise<{
    success: boolean;
    durationMs: number;
    steps: Array<{ name: string; status: "passed" | "failed"; durationMs: number; details?: unknown }>;
  }> {
    const start = Date.now();
    const steps: Array<{ name: string; status: "passed" | "failed"; durationMs: number; details?: unknown }> = [];
    const testCode = `TEST-${Math.floor(10000 + Math.random() * 89999)}`;

    try {
      // Step 1: Check non-existent code
      const step1Start = Date.now();
      const check1 = await this.checkCode(testCode);
      if (check1.isDuplicate) {
        throw new Error(`Test code ${testCode} unexpectedly reported as duplicate`);
      }
      steps.push({
        name: "Check Non-Existent Code (Negative Check)",
        status: "passed",
        durationMs: Date.now() - step1Start,
        details: check1,
      });

      // Step 2: Register test code
      const step2Start = Date.now();
      const regResult = await this.registerCodes([
        {
          code: testCode,
          title: "Automated Deduplication Verification Item",
          postUrl: "https://example.com/test-dedup",
          actressName: "Test Actress",
          studioName: "Test Studio",
        },
      ]);
      if (!regResult.registered.includes(testCode)) {
        throw new Error(`Failed to register test code ${testCode}`);
      }
      steps.push({
        name: "Register Unique Code (Atomic Write)",
        status: "passed",
        durationMs: Date.now() - step2Start,
        details: { registered: regResult.registered, commitSha: regResult.commitSha },
      });

      // Step 3: Check registered code immediately (O(1) Positive Check)
      const step3Start = Date.now();
      const check2 = await this.checkCode(testCode);
      if (!check2.isDuplicate || !check2.entry) {
        throw new Error(`Registered code ${testCode} was not found in duplicate index check`);
      }
      steps.push({
        name: "Positive O(1) Deduplication Check",
        status: "passed",
        durationMs: Date.now() - step3Start,
        details: check2,
      });

      // Step 4: Attempt duplicate re-registration
      const step4Start = Date.now();
      const reRegResult = await this.registerCodes([
        {
          code: testCode,
          title: "Attempt Duplicate Registration",
        },
      ]);
      if (reRegResult.registered.length > 0 || !reRegResult.duplicates.includes(testCode)) {
        throw new Error(`Duplicate re-registration was not correctly prevented: ${JSON.stringify(reRegResult)}`);
      }
      steps.push({
        name: "Prevent Duplicate Re-Registration (Guard Validation)",
        status: "passed",
        durationMs: Date.now() - step4Start,
        details: reRegResult,
      });

      // Step 5: Clean rollback of test code
      const step5Start = Date.now();
      const unregSuccess = await this.unregisterCode(testCode);
      steps.push({
        name: "Rollback & Cleanup Test Code",
        status: unregSuccess ? "passed" : "failed",
        durationMs: Date.now() - step5Start,
        details: { unregisterSuccess: unregSuccess },
      });

      return {
        success: steps.every((s) => s.status === "passed"),
        durationMs: Date.now() - start,
        steps,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({
        name: "Test Failure",
        status: "failed",
        durationMs: Date.now() - start,
        details: { error: msg },
      });
      return {
        success: false,
        durationMs: Date.now() - start,
        steps,
      };
    }
  }
}
