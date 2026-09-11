import * as cheerio from "cheerio";
import { CodeRegistryService } from "../services/codeRegistry";
import { normalizeCode } from "../schema/normalizers";

export interface JavtifulVideoItem {
  code: string;
  rawCode: string;
  title: string;
  actress?: string;
  actressSlug?: string;
  studio?: string;
  studioSlug?: string;
  duration?: string;
  durationSeconds?: number;
  releaseDate?: string;
  coverImage?: string;
  postUrl: string;
  isDuplicate?: boolean;
  duplicateEntry?: unknown;
}

export interface JavtifulActressItem {
  name: string;
  slug: string;
  videoCount?: number;
  url: string;
  thumbnail?: string;
}

export interface JavtifulStudioItem {
  name: string;
  slug: string;
  videoCount?: number;
  url: string;
  thumbnail?: string;
}

export interface JavtifulScrapeResult {
  source: string;
  page: number;
  totalFound: number;
  uniqueCount: number;
  duplicateCount: number;
  items: JavtifulVideoItem[];
}

export class JavtifulScraper {
  private readonly baseUrl = "https://javtiful.com";
  private readonly primaryCatalogUrl = "https://javtiful.com/main";
  private codeRegistry: CodeRegistryService;

  constructor(codeRegistry: CodeRegistryService) {
    this.codeRegistry = codeRegistry;
  }

  private get headers(): Record<string, string> {
    return {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
    };
  }

  /**
   * Helper to build absolute URLs
   */
  private makeAbsoluteUrl(pathOrUrl: string): string {
    if (!pathOrUrl) return "";
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith("/")) {
      return `${this.baseUrl}${pathOrUrl}`;
    }
    return `${this.baseUrl}/${pathOrUrl}`;
  }

  /**
   * Converts ISO-8601 duration (e.g. PT2H15M45S) or text (e.g. 02:15:45) into standard HH:MM:SS
   */
  private parseDuration(raw: string): { formatted: string; seconds: number } {
    if (!raw) return { formatted: "", seconds: 0 };

    // Check ISO 8601 (e.g. PT2H49M29S or PT45M10S)
    const isoMatch = raw.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
      const hours = parseInt(isoMatch[1] || "0", 10);
      const minutes = parseInt(isoMatch[2] || "0", 10);
      const seconds = parseInt(isoMatch[3] || "0", 10);
      const totalSec = hours * 3600 + minutes * 60 + seconds;
      const formatted = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      return { formatted, seconds: totalSec };
    }

    // Check HH:MM:SS or MM:SS
    const parts = raw.split(":").map((p) => parseInt(p.trim(), 10));
    if (parts.length === 3 && !parts.some(isNaN)) {
      const totalSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      return {
        formatted: `${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}:${String(parts[2]).padStart(2, "0")}`,
        seconds: totalSec,
      };
    }
    if (parts.length === 2 && !parts.some(isNaN)) {
      const totalSec = parts[0] * 60 + parts[1];
      return {
        formatted: `00:${String(parts[0]).padStart(2, "0")}:${String(parts[1]).padStart(2, "0")}`,
        seconds: totalSec,
      };
    }

    return { formatted: raw.trim(), seconds: 0 };
  }

  /**
   * Extracts canonical code from text (e.g. "DASS-374 ...") or path (e.g. "/video/56557/dass-374")
   */
  private extractCode(title: string, postUrl: string): { code: string; rawCode: string } {
    // 1. Try URL slug first as it is cleanest: "/video/48920/gvh-607", "/video/95190/10musume-091026_01"
    const slugMatch = postUrl.match(/\/video\/\d+\/([a-zA-Z0-9]+[\-_][a-zA-Z0-9]+(?:[\-_][a-zA-Z0-9]+)?)/i);
    if (slugMatch) {
      const raw = slugMatch[1].trim();
      const normalized = normalizeCode(raw);
      if (normalized) return { code: normalized, rawCode: raw };
    }

    // 2. Try leading pattern from title: e.g. "GVH-607 Continuous..."
    const titleLeadingMatch = title.match(/^([a-zA-Z0-9]+[\s\-_]+[a-zA-Z0-9]+(?:[\s\-_]+[a-zA-Z0-9]+)?|[a-zA-Z]{2,6}\s*\d{3,6})/i);
    if (titleLeadingMatch) {
      const raw = titleLeadingMatch[1].trim();
      const normalized = normalizeCode(raw);
      if (normalized) return { code: normalized, rawCode: raw };
    }

    // 3. Any standard code inside title
    const anyCodeMatch = title.match(/\b([A-Z]{2,6}[-_ ]?\d{2,6})\b/i);
    if (anyCodeMatch) {
      const raw = anyCodeMatch[1].trim();
      const normalized = normalizeCode(raw);
      if (normalized) return { code: normalized, rawCode: raw };
    }

    return { code: "", rawCode: "" };
  }

  /**
   * Scrapes the primary catalog entry point (https://javtiful.com/main) or paginated page
   */
  async scrapeCatalogPage(page = 1, options?: { filterDuplicates?: boolean; enrichDetails?: boolean }): Promise<JavtifulScrapeResult> {
    const url = page > 1 ? `${this.primaryCatalogUrl}?page=${page}` : this.primaryCatalogUrl;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch Javtiful catalog: HTTP ${res.status} from ${url}`);
    }

    const html = await res.text();
    const items = this.parseCardsFromHtml(html);

    // Apply deduplication against CodeRegistryService
    const codes = items.map((i) => i.code).filter(Boolean);
    const dedupResults = await this.codeRegistry.checkBatch(codes);
    const dedupMap = new Map(dedupResults.map((r) => [r.normalizedCode || r.rawCode, r]));

    for (const item of items) {
      if (item.code) {
        const check = dedupMap.get(item.code);
        if (check) {
          item.isDuplicate = check.isDuplicate;
          item.duplicateEntry = check.entry;
        }
      }
    }

    // If detail enrichment requested and item is not duplicate
    if (options?.enrichDetails) {
      const enrichmentTasks = items.map(async (item) => {
        if (!item.isDuplicate && item.postUrl) {
          try {
            const details = await this.getPostDetails(item.postUrl);
            item.actress = details.actress || item.actress;
            item.actressSlug = details.actressSlug || item.actressSlug;
            item.studio = details.studio || item.studio;
            item.studioSlug = details.studioSlug || item.studioSlug;
            item.releaseDate = details.releaseDate || item.releaseDate;
            if (details.coverImage && (!item.coverImage || item.coverImage.includes("placeholder"))) {
              item.coverImage = details.coverImage;
            }
          } catch (err) {
            console.warn(`Failed to enrich details for ${item.code}:`, err);
          }
        }
      });
      // Run enrichment in parallel batches to speed up
      const batchSize = 6;
      for (let i = 0; i < enrichmentTasks.length; i += batchSize) {
        await Promise.all(enrichmentTasks.slice(i, i + batchSize));
      }
    }

    const filteredItems = options?.filterDuplicates ? items.filter((i) => !i.isDuplicate) : items;

    return {
      source: url,
      page,
      totalFound: items.length,
      uniqueCount: items.filter((i) => !i.isDuplicate).length,
      duplicateCount: items.filter((i) => i.isDuplicate).length,
      items: filteredItems,
    };
  }

  /**
   * Search by video code (e.g. "SSIS-001")
   */
  async searchByCode(code: string): Promise<JavtifulScrapeResult> {
    const normalized = normalizeCode(code) || code.trim();
    return this.searchByKeyword(normalized);
  }

  /**
   * Search by keyword (actress name, release code, series title)
   */
  async searchByKeyword(keyword: string, page = 1, options?: { filterDuplicates?: boolean; enrichDetails?: boolean }): Promise<JavtifulScrapeResult> {
    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(keyword.trim())}${page > 1 ? `&page=${page}` : ""}`;
    const res = await fetch(searchUrl, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to search Javtiful: HTTP ${res.status} for query "${keyword}"`);
    }

    const html = await res.text();
    const items = this.parseCardsFromHtml(html);

    // Apply deduplication against CodeRegistryService
    const codes = items.map((i) => i.code).filter(Boolean);
    const dedupResults = await this.codeRegistry.checkBatch(codes);
    const dedupMap = new Map(dedupResults.map((r) => [r.normalizedCode || r.rawCode, r]));

    for (const item of items) {
      if (item.code) {
        const check = dedupMap.get(item.code);
        if (check) {
          item.isDuplicate = check.isDuplicate;
          item.duplicateEntry = check.entry;
        }
      }
    }

    // If detail enrichment requested and item is not duplicate
    if (options?.enrichDetails) {
      const enrichmentTasks = items.map(async (item) => {
        if (!item.isDuplicate && item.postUrl) {
          try {
            const details = await this.getPostDetails(item.postUrl);
            item.actress = details.actress || item.actress;
            item.actressSlug = details.actressSlug || item.actressSlug;
            item.studio = details.studio || item.studio;
            item.studioSlug = details.studioSlug || item.studioSlug;
            item.releaseDate = details.releaseDate || item.releaseDate;
            if (details.coverImage && (!item.coverImage || item.coverImage.includes("placeholder"))) {
              item.coverImage = details.coverImage;
            }
          } catch (err) {
            console.warn(`Failed to enrich details for ${item.code}:`, err);
          }
        }
      });
      const batchSize = 6;
      for (let i = 0; i < enrichmentTasks.length; i += batchSize) {
        await Promise.all(enrichmentTasks.slice(i, i + batchSize));
      }
    }

    const filteredItems = options?.filterDuplicates ? items.filter((i) => !i.isDuplicate) : items;

    return {
      source: searchUrl,
      page,
      totalFound: items.length,
      uniqueCount: items.filter((i) => !i.isDuplicate).length,
      duplicateCount: items.filter((i) => i.isDuplicate).length,
      items: filteredItems,
    };
  }

  /**
   * Fetches full metadata for an individual post page
   */
  async getPostDetails(urlOrPath: string): Promise<JavtifulVideoItem> {
    const postUrl = this.makeAbsoluteUrl(urlOrPath);
    const res = await fetch(postUrl, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch post page: HTTP ${res.status} from ${postUrl}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // 1. JSON-LD structured VideoObject
    interface SchemaVideoObject {
      "@type"?: string;
      name?: string;
      description?: string;
      thumbnailUrl?: string[];
      uploadDate?: string;
      duration?: string;
      url?: string;
    }
    let jsonLd: SchemaVideoObject = {};
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || "{}");
        if (parsed["@type"] === "VideoObject") {
          jsonLd = parsed;
        }
      } catch {}
    });

    const pageH1 = $("h1").first().text().trim();
    const title = pageH1 || jsonLd.name || $("meta[property='og:title']").attr("content") || "";

    const { code, rawCode } = this.extractCode(title, postUrl);

    // Actresses
    const actresses: Array<{ name: string; slug: string }> = [];
    $('a[href*="/actress/"]').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr("href") || "";
      const slug = href.replace(/^.*\/actress\//, "").replace(/\/$/, "");
      if (name && slug && slug !== "actresses" && !actresses.some((a) => a.slug === slug)) {
        actresses.push({ name, slug });
      }
    });

    // Studio / Channel
    let studioName = "";
    let studioSlug = "";
    $('a[href*="/channel/"]').each((_, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr("href") || "";
      const slug = href.replace(/^.*\/channel\//, "").replace(/\/$/, "");
      if (name && slug && slug !== "channels" && !studioName) {
        studioName = name;
        studioSlug = slug;
      }
    });

    // Release Date / Upload Date
    let releaseDate = "";
    if (jsonLd.uploadDate) {
      releaseDate = jsonLd.uploadDate.split("T")[0];
    } else {
      $(".front-watch-detail").each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes("Added on:")) {
          const dateStr = text.replace("Added on:", "").trim();
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            releaseDate = parsed.toISOString().split("T")[0];
          } else {
            releaseDate = dateStr;
          }
        }
      });
    }

    // Duration
    let durationFormatted = "";
    let durationSec = 0;
    if (jsonLd.duration) {
      const d = this.parseDuration(jsonLd.duration);
      durationFormatted = d.formatted;
      durationSec = d.seconds;
    } else {
      const tagDuration = $(".front-duration-tag").first().text().trim();
      if (tagDuration) {
        const d = this.parseDuration(tagDuration);
        durationFormatted = d.formatted;
        durationSec = d.seconds;
      }
    }

    // Cover image
    let coverImage = "";
    if (jsonLd.thumbnailUrl && jsonLd.thumbnailUrl.length > 0) {
      coverImage = jsonLd.thumbnailUrl[0];
    } else {
      coverImage =
        $("meta[property='og:image']").attr("content") ||
        $("img.front-video-cover").attr("src") ||
        "";
    }
    coverImage = this.makeAbsoluteUrl(coverImage);

    // Deduplication check via CodeRegistryService
    let isDuplicate = false;
    let duplicateEntry: unknown = undefined;
    if (code) {
      const check = await this.codeRegistry.checkCode(code);
      isDuplicate = check.isDuplicate;
      duplicateEntry = check.entry;
    }

    return {
      code: code || rawCode,
      rawCode,
      title,
      actress: actresses[0]?.name,
      actressSlug: actresses[0]?.slug,
      studio: studioName || undefined,
      studioSlug: studioSlug || undefined,
      duration: durationFormatted,
      durationSeconds: durationSec,
      releaseDate,
      coverImage,
      postUrl,
      isDuplicate,
      duplicateEntry,
    };
  }

  /**
   * Scrapes actress directory listing from https://javtiful.com/actresses
   */
  async getActresses(page = 1): Promise<{ actresses: JavtifulActressItem[]; totalFound: number }> {
    const url = page > 1 ? `${this.baseUrl}/actresses?page=${page}` : `${this.baseUrl}/actresses`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch actresses: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const actresses: JavtifulActressItem[] = [];

    $('a[href*="/actress/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim().replace(/\s+/g, " ");
      const slug = href.replace(/^.*\/actress\//, "").replace(/\/$/, "");

      if (slug && slug !== "actresses" && !actresses.some((a) => a.slug === slug)) {
        // Extract count if format is "Hatano Yui 688 Videos"
        const countMatch = text.match(/(\d+)\s+Videos?/i);
        const count = countMatch ? parseInt(countMatch[1], 10) : undefined;
        const name = text.replace(/\d+\s+Videos?/i, "").trim();

        const imgEl = $(el).find("img");
        const thumbnail =
          imgEl.attr("data-front-lazy-src") ||
          imgEl.attr("src") ||
          "";

        actresses.push({
          name: name || slug,
          slug,
          videoCount: count,
          url: this.makeAbsoluteUrl(href),
          thumbnail: thumbnail ? this.makeAbsoluteUrl(thumbnail) : undefined,
        });
      }
    });

    return { actresses, totalFound: actresses.length };
  }

  /**
   * Scrapes videos for a specific actress
   */
  async getActressVideos(actressSlug: string, page = 1): Promise<JavtifulScrapeResult> {
    const url = page > 1
      ? `${this.baseUrl}/actress/${actressSlug}?page=${page}`
      : `${this.baseUrl}/actress/${actressSlug}`;

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch actress videos: HTTP ${res.status} from ${url}`);
    }

    const html = await res.text();
    const items = this.parseCardsFromHtml(html);

    // Apply deduplication
    const codes = items.map((i) => i.code).filter(Boolean);
    const dedupResults = await this.codeRegistry.checkBatch(codes);
    const dedupMap = new Map(dedupResults.map((r) => [r.normalizedCode || r.rawCode, r]));

    for (const item of items) {
      item.actressSlug = actressSlug;
      if (item.code) {
        const check = dedupMap.get(item.code);
        if (check) {
          item.isDuplicate = check.isDuplicate;
          item.duplicateEntry = check.entry;
        }
      }
    }

    return {
      source: url,
      page,
      totalFound: items.length,
      uniqueCount: items.filter((i) => !i.isDuplicate).length,
      duplicateCount: items.filter((i) => i.isDuplicate).length,
      items,
    };
  }

  /**
   * Scrapes studio/channels directory listing from https://javtiful.com/channels
   */
  async getStudios(page = 1): Promise<{ studios: JavtifulStudioItem[]; totalFound: number }> {
    const url = page > 1 ? `${this.baseUrl}/channels?page=${page}` : `${this.baseUrl}/channels`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch studios/channels: HTTP ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const studios: JavtifulStudioItem[] = [];

    $('a[href*="/channel/"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim().replace(/\s+/g, " ");
      const slug = href.replace(/^.*\/channel\//, "").replace(/\/$/, "");

      if (slug && slug !== "channels" && !studios.some((s) => s.slug === slug)) {
        // Extract count e.g. "FC2PPV 5609 Videos"
        const countMatch = text.match(/(\d+)\s+Videos?/i);
        const count = countMatch ? parseInt(countMatch[1], 10) : undefined;
        const name = text.replace(/\d+\s+Videos?/i, "").trim();

        const imgEl = $(el).find("img");
        const thumbnail =
          imgEl.attr("data-front-lazy-src") ||
          imgEl.attr("src") ||
          "";

        studios.push({
          name: name || slug,
          slug,
          videoCount: count,
          url: this.makeAbsoluteUrl(href),
          thumbnail: thumbnail ? this.makeAbsoluteUrl(thumbnail) : undefined,
        });
      }
    });

    return { studios, totalFound: studios.length };
  }

  /**
   * Scrapes videos for a specific studio/channel
   */
  async getStudioVideos(studioSlug: string, page = 1): Promise<JavtifulScrapeResult> {
    const url = page > 1
      ? `${this.baseUrl}/channel/${studioSlug}?page=${page}`
      : `${this.baseUrl}/channel/${studioSlug}`;

    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch studio videos: HTTP ${res.status} from ${url}`);
    }

    const html = await res.text();
    const items = this.parseCardsFromHtml(html);

    // Apply deduplication
    const codes = items.map((i) => i.code).filter(Boolean);
    const dedupResults = await this.codeRegistry.checkBatch(codes);
    const dedupMap = new Map(dedupResults.map((r) => [r.normalizedCode || r.rawCode, r]));

    for (const item of items) {
      item.studioSlug = studioSlug;
      if (item.code) {
        const check = dedupMap.get(item.code);
        if (check) {
          item.isDuplicate = check.isDuplicate;
          item.duplicateEntry = check.entry;
        }
      }
    }

    return {
      source: url,
      page,
      totalFound: items.length,
      uniqueCount: items.filter((i) => !i.isDuplicate).length,
      duplicateCount: items.filter((i) => i.isDuplicate).length,
      items,
    };
  }

  /**
   * Internal parser extracting video cards from listing pages (.front-video-card)
   */
  private parseCardsFromHtml(html: string): JavtifulVideoItem[] {
    const $ = cheerio.load(html);
    const items: JavtifulVideoItem[] = [];
    const seenUrls = new Set<string>();

    $(".front-video-card, .video-card, .video-item").each((_, el) => {
      const card = $(el);
      const titleLink = card.find(".front-video-title, .video-title, h2 a, h3 a, h4 a").first();
      const thumbLink = card.find(".front-video-thumb, .thumb, a").first();

      const title = titleLink.text().trim() || thumbLink.attr("title") || card.find("img").attr("alt") || "";
      const rawHref = titleLink.attr("href") || thumbLink.attr("href") || "";
      const postUrl = this.makeAbsoluteUrl(rawHref);

      if (!postUrl || seenUrls.has(postUrl) || !postUrl.includes("/video/")) return;
      seenUrls.add(postUrl);

      // Extract image URL
      const imgEl = card.find("img").first();
      const coverImage =
        imgEl.attr("data-front-lazy-src") ||
        imgEl.attr("data-src") ||
        imgEl.attr("src") ||
        "";

      // Extract duration
      const rawDuration = card.find(".front-duration-tag, .duration, .time").first().text().trim();
      const { formatted: durationFormatted, seconds: durationSec } = this.parseDuration(rawDuration);

      // Extract direct actress/channel if present on card
      const actressEl = card.find('a[href*="/actress/"]').first();
      const actressName = actressEl.text().trim();
      const actressHref = actressEl.attr("href") || "";
      const actressSlug = actressHref.replace(/^.*\/actress\//, "").replace(/\/$/, "");

      const studioEl = card.find('a[href*="/channel/"]').first();
      const studioName = studioEl.text().trim();
      const studioHref = studioEl.attr("href") || "";
      const studioSlug = studioHref.replace(/^.*\/channel\//, "").replace(/\/$/, "");

      // Extract code
      const { code, rawCode } = this.extractCode(title, postUrl);

      items.push({
        code: code || rawCode,
        rawCode,
        title,
        actress: actressName || undefined,
        actressSlug: (actressSlug && actressSlug !== "actresses") ? actressSlug : undefined,
        studio: studioName || undefined,
        studioSlug: (studioSlug && studioSlug !== "channels") ? studioSlug : undefined,
        duration: durationFormatted,
        durationSeconds: durationSec,
        coverImage: coverImage ? this.makeAbsoluteUrl(coverImage) : undefined,
        postUrl,
      });
    });

    // Fallback: If no cards found by standard selectors, inspect all video anchors
    if (items.length === 0) {
      $('a[href*="/video/"]').each((_, el) => {
        const anchor = $(el);
        const href = anchor.attr("href") || "";
        const postUrl = this.makeAbsoluteUrl(href);
        if (!postUrl || seenUrls.has(postUrl)) return;

        const title = anchor.text().trim() || anchor.attr("title") || "";
        if (title.length < 5) return; // Skip tiny or icon links
        seenUrls.add(postUrl);

        const imgEl = anchor.find("img");
        const coverImage = imgEl.attr("data-front-lazy-src") || imgEl.attr("src") || "";
        const { code, rawCode } = this.extractCode(title, postUrl);

        items.push({
          code: code || rawCode,
          rawCode,
          title,
          coverImage: coverImage ? this.makeAbsoluteUrl(coverImage) : undefined,
          postUrl,
        });
      });
    }

    return items;
  }

  /**
   * Universal Scraper: Accepts any page URL (catalog, actress, channel, search, or category),
   * fetches the page, detects all posts, extracts metadata, enriches details if requested,
   * and runs global deduplication check against the Code Registry.
   */
  async scrapeAnyUrl(
    pageUrl: string,
    options?: { filterDuplicates?: boolean; enrichDetails?: boolean; maxEnrich?: number }
  ): Promise<JavtifulScrapeResult> {
    const targetUrl = this.makeAbsoluteUrl(pageUrl);
    const res = await fetch(targetUrl, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch page: HTTP ${res.status} from ${targetUrl}`);
    }

    const html = await res.text();
    const items = this.parseCardsFromHtml(html);

    // Apply deduplication against CodeRegistryService
    const codes = items.map((i) => i.code).filter(Boolean);
    const dedupResults = await this.codeRegistry.checkBatch(codes);
    const dedupMap = new Map(dedupResults.map((r) => [r.normalizedCode || r.rawCode, r]));

    for (const item of items) {
      if (item.code) {
        const check = dedupMap.get(item.code);
        if (check) {
          item.isDuplicate = check.isDuplicate;
          item.duplicateEntry = check.entry;
        }
      }
    }

    // If enrichDetails is requested, enrich non-duplicate items
    if (options?.enrichDetails) {
      const enrichable = items.filter((i) => !i.isDuplicate && i.postUrl);
      const toEnrich = options.maxEnrich ? enrichable.slice(0, options.maxEnrich) : enrichable;

      // Enrich in chunks of 3 concurrent requests
      const chunkSize = 3;
      for (let i = 0; i < toEnrich.length; i += chunkSize) {
        const chunk = toEnrich.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (item) => {
            try {
              const details = await this.getPostDetails(item.postUrl);
              item.actress = details.actress || item.actress;
              item.actressSlug = details.actressSlug || item.actressSlug;
              item.studio = details.studio || item.studio;
              item.studioSlug = details.studioSlug || item.studioSlug;
              item.releaseDate = details.releaseDate || item.releaseDate;
              if (details.coverImage && (!item.coverImage || item.coverImage.includes("placeholder"))) {
                item.coverImage = details.coverImage;
              }
              if (details.duration && !item.duration) {
                item.duration = details.duration;
                item.durationSeconds = details.durationSeconds;
              }
            } catch (err) {
              console.warn(`[BulkScraper] Failed to enrich details for ${item.code}:`, err);
            }
          })
        );
      }
    }

    const filteredItems = options?.filterDuplicates ? items.filter((i) => !i.isDuplicate) : items;

    return {
      source: targetUrl,
      page: 1,
      totalFound: items.length,
      uniqueCount: items.filter((i) => !i.isDuplicate).length,
      duplicateCount: items.filter((i) => i.isDuplicate).length,
      items: filteredItems,
    };
  }
}
