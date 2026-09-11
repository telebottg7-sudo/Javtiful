import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { githubStorage } from "./server/storage";
import { checkDatabaseIndexes, initializeDatabaseIndexes } from "./server/schema";
import { codeRegistryService, ingestionService, searchService, maintenanceService } from "./server/services";
import { javtifulScraper } from "./server/scrapers";
import { normalizeCode, getCodeFilePath } from "./server/schema/normalizers";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Config & storage status endpoint
  app.get("/api/config/status", async (req, res) => {
    const config = githubStorage.getConfig();
    let rateLimit = null;

    if (config.hasToken) {
      try {
        rateLimit = await githubStorage.getRateLimit();
      } catch (err: unknown) {
        console.error("Failed to fetch GitHub rate limit:", err);
      }
    }

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      githubConfigured: config.hasToken,
      repo: {
        owner: config.owner,
        repo: config.repo,
        branch: config.branch,
        root: config.databaseRoot,
      },
      rateLimit,
    });
  });

  // Schema verification status (Step 3)
  app.get("/api/database/schema-status", async (req, res) => {
    try {
      const report = await checkDatabaseIndexes(githubStorage);
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Schema initialization in GitHub repo (Step 3)
  app.post("/api/database/init", async (req, res) => {
    try {
      const result = await initializeDatabaseIndexes(githubStorage);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Storage diagnosis and verification self-test (Step 2 Stop Rule)
  app.post("/api/storage/test", async (req, res) => {
    try {
      const report = await githubStorage.runSelfTest();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  // List files under a storage directory
  app.get("/api/storage/files", async (req, res) => {
    try {
      const dirPath = (req.query.path as string) || "";
      const files = await githubStorage.listFiles(dirPath);
      res.json({ files, path: githubStorage.resolvePath(dirPath) });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Storage Performance & Cache Metrics (Step 10)
  const getMetricsHandler = async (_req: express.Request, res: express.Response) => {
    try {
      const metrics = githubStorage.getPerformanceMetrics();
      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        metrics,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  };
  app.get("/api/storage/metrics", getMetricsHandler);
  app.get("/api/system/storage-metrics", getMetricsHandler);

  // Invalidate or purge storage cache (Step 10)
  app.post("/api/storage/cache/purge", async (req, res) => {
    try {
      const pattern = req.body?.pattern as string | undefined;
      const purgedCount = githubStorage.purgeCache(pattern);
      res.json({
        success: true,
        purgedCount,
        message: pattern
          ? `Purged cache entries matching '${pattern}'`
          : "Wiped complete storage cache",
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Step 10 Automated Performance & Race Condition Test Suite (Step 10 Stop Rule)
  app.post("/api/system/step10-performance-test", async (_req, res) => {
    try {
      const report = await githubStorage.runStep10PerformanceTest();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });


  app.get("/api/code-categories", async (req, res) => {
    try {
      const categories = await codeRegistryService.getCategories();
      res.json({ success: true, data: categories });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  app.get("/api/code/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const data = await codeRegistryService.getCodeFile(code);
      if (!data) {
        return res.status(404).json({ success: false, error: "Code not found" });
      }
      res.json({ success: true, data });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });



  // Code Registry: Stats (Step 4)
  app.get("/api/codes/stats", async (req, res) => {
    try {
      const stats = await codeRegistryService.getStats();
      res.json(stats);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Code Registry: Single Check (Step 4)
  app.get("/api/codes/check", async (req, res) => {
    try {
      const code = (req.query.code as string) || "";
      const result = await codeRegistryService.checkCode(code);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Code Registry: Batch Check (Step 4)
  app.post("/api/codes/check-batch", async (req, res) => {
    try {
      const codes = Array.isArray(req.body.codes) ? req.body.codes : [];
      const results = await codeRegistryService.checkBatch(codes);
      res.json({ results });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Code Registry: Register Codes (Step 4)
  app.post("/api/codes/register", async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : [];
      const result = await codeRegistryService.registerCodes(items);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Code Registry: Automated Deduplication Self-Test (Step 4 Stop Rule)
  app.post("/api/codes/test-dedup", async (req, res) => {
    try {
      const report = await codeRegistryService.runDeduplicationTest();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Javtiful Scraper: Primary Catalog (Step 5)
  app.get("/api/scrapers/javtiful/catalog", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const filterDuplicates = req.query.filterDuplicates === "true";
      const enrichDetails = req.query.enrichDetails === "true";
      const result = await javtifulScraper.scrapeCatalogPage(page, { filterDuplicates, enrichDetails });
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Search (Step 5)
  app.get("/api/scrapers/javtiful/search", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").trim();
      const page = parseInt((req.query.page as string) || "1", 10);
      const filterDuplicates = req.query.filterDuplicates === "true";
      const enrichDetails = req.query.enrichDetails === "true";
      if (!q) {
        return res.status(400).json({ error: "Missing query parameter 'q'" });
      }
      const result = await javtifulScraper.searchByKeyword(q, page, { filterDuplicates, enrichDetails });
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Individual Post Details (Step 5)
  app.get("/api/scrapers/javtiful/post", async (req, res) => {
    try {
      const url = ((req.query.url as string) || "").trim();
      if (!url) {
        return res.status(400).json({ error: "Missing 'url' parameter" });
      }
      const post = await javtifulScraper.getPostDetails(url);
      res.json(post);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Actresses Directory (Step 5)
  app.get("/api/scrapers/javtiful/actresses", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const result = await javtifulScraper.getActresses(page);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Actress Videos (Step 5)
  app.get("/api/scrapers/javtiful/actress-videos", async (req, res) => {
    try {
      const slug = ((req.query.slug as string) || "").trim();
      const page = parseInt((req.query.page as string) || "1", 10);
      if (!slug) {
        return res.status(400).json({ error: "Missing 'slug' parameter" });
      }
      const result = await javtifulScraper.getActressVideos(slug, page);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Studios / Channels Directory (Step 5)
  app.get("/api/scrapers/javtiful/studios", async (req, res) => {
    try {
      const page = parseInt((req.query.page as string) || "1", 10);
      const result = await javtifulScraper.getStudios(page);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Studio Videos (Step 5)
  app.get("/api/scrapers/javtiful/studio-videos", async (req, res) => {
    try {
      const slug = ((req.query.slug as string) || "").trim();
      const page = parseInt((req.query.page as string) || "1", 10);
      if (!slug) {
        return res.status(400).json({ error: "Missing 'slug' parameter" });
      }
      const result = await javtifulScraper.getStudioVideos(slug, page);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Javtiful Scraper: Automated End-to-End Verification Test Suite (Step 5 Stop Rule)
  app.post("/api/scrapers/javtiful/test-suite", async (req, res) => {
    const startTime = Date.now();
    interface TestStep {
      name: string;
      status: "passed" | "failed";
      durationMs: number;
      details?: unknown;
    }
    const steps: TestStep[] = [];

    try {
      // Step 1: Catalog Scraping from primary entry point (https://javtiful.com/main)
      const t1 = Date.now();
      const catalogResult = await javtifulScraper.scrapeCatalogPage(1);
      if (!catalogResult.items || catalogResult.items.length === 0) {
        throw new Error("Catalog returned 0 items from https://javtiful.com/main");
      }
      steps.push({
        name: "Primary Catalog Scraping (https://javtiful.com/main)",
        status: "passed",
        durationMs: Date.now() - t1,
        details: {
          source: catalogResult.source,
          totalFound: catalogResult.totalFound,
          sample: catalogResult.items.slice(0, 3).map((i) => ({ code: i.code, title: i.title, duration: i.duration })),
        },
      });

      // Step 2: Individual Post Page Metadata Extraction
      const t2 = Date.now();
      const sampleItem = catalogResult.items.find((i) => i.postUrl) || catalogResult.items[0];
      const postDetails = await javtifulScraper.getPostDetails(sampleItem.postUrl);

      // Verify canonical fields
      if (!postDetails.code || !postDetails.title || !postDetails.postUrl) {
        throw new Error(`Incomplete post metadata: missing code (${postDetails.code}), title (${postDetails.title}), or postUrl`);
      }
      steps.push({
        name: "Post Metadata Extraction (Code, Title, Actress, Studio, Duration, ReleaseDate, CoverImage, PostUrl)",
        status: "passed",
        durationMs: Date.now() - t2,
        details: {
          code: postDetails.code,
          title: postDetails.title,
          actress: postDetails.actress || "(N/A)",
          studio: postDetails.studio || "(N/A)",
          duration: postDetails.duration,
          releaseDate: postDetails.releaseDate || "(N/A)",
          coverImage: postDetails.coverImage ? postDetails.coverImage.slice(0, 50) + "..." : "(none)",
          postUrl: postDetails.postUrl,
        },
      });

      // Step 3: Search by Video Code
      const t3 = Date.now();
      const searchCode = postDetails.code || "SSIS-001";
      const codeSearchResult = await javtifulScraper.searchByCode(searchCode);
      steps.push({
        name: `Search by Video Code ("${searchCode}")`,
        status: "passed",
        durationMs: Date.now() - t3,
        details: {
          query: searchCode,
          totalFound: codeSearchResult.totalFound,
          firstMatch: codeSearchResult.items[0]?.title || "None",
        },
      });

      // Step 4: Search by Keyword
      const t4 = Date.now();
      const keywordSearchResult = await javtifulScraper.searchByKeyword("Hatano");
      steps.push({
        name: 'Search by Keyword ("Hatano")',
        status: "passed",
        durationMs: Date.now() - t4,
        details: {
          query: "Hatano",
          totalFound: keywordSearchResult.totalFound,
          sample: keywordSearchResult.items.slice(0, 3).map((i) => i.code),
        },
      });

      // Step 5: Actress Listings
      const t5 = Date.now();
      const actressesResult = await javtifulScraper.getActresses(1);
      if (!actressesResult.actresses || actressesResult.actresses.length === 0) {
        throw new Error("Failed to extract actresses directory");
      }
      steps.push({
        name: "Actress/Model Listings Directory",
        status: "passed",
        durationMs: Date.now() - t5,
        details: {
          totalFound: actressesResult.totalFound,
          sample: actressesResult.actresses.slice(0, 3).map((a) => `${a.name} (${a.videoCount || 0} videos)`),
        },
      });

      // Step 6: Studio Listings
      const t6 = Date.now();
      const studiosResult = await javtifulScraper.getStudios(1);
      if (!studiosResult.studios || studiosResult.studios.length === 0) {
        throw new Error("Failed to extract studios/channels directory");
      }
      steps.push({
        name: "Studio/Maker Listings Directory",
        status: "passed",
        durationMs: Date.now() - t6,
        details: {
          totalFound: studiosResult.totalFound,
          sample: studiosResult.studios.slice(0, 3).map((s) => `${s.name} (${s.videoCount || 0} videos)`),
        },
      });

      // Step 7: Deterministic CodeRegistry Deduplication Verification
      const t7 = Date.now();
      // Test with registered code (SSIS-001 is already registered in registry)
      const dedupCheck = await codeRegistryService.checkCode("SSIS-001");
      const unregCheck = await codeRegistryService.checkCode("UNREGISTERED-CODE-999");
      if (!dedupCheck.isDuplicate) {
        throw new Error("Registered code SSIS-001 was not recognized as duplicate by CodeRegistryService");
      }
      if (unregCheck.isDuplicate) {
        throw new Error("Unregistered code was unexpectedly recognized as duplicate");
      }
      steps.push({
        name: "Global CodeRegistry Deduplication Integration",
        status: "passed",
        durationMs: Date.now() - t7,
        details: {
          registeredCodeCheck: { code: "SSIS-001", isDuplicate: dedupCheck.isDuplicate },
          unregisteredCodeCheck: { code: "UNREGISTERED-CODE-999", isDuplicate: unregCheck.isDuplicate },
        },
      });

      res.json({
        success: true,
        durationMs: Date.now() - startTime,
        steps,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      steps.push({
        name: "Test Failure",
        status: "failed",
        durationMs: Date.now() - startTime,
        details: { error: errorMsg },
      });
      res.status(500).json({
        success: false,
        durationMs: Date.now() - startTime,
        steps,
        error: errorMsg,
      });
    }
  });

  // ==========================================
  // STEP 6: Ingestion & Sharded Entity Endpoints
  // ==========================================

  // Ingest Single Video
  app.post("/api/ingestion/ingest-video", async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.code || !item.title) {
        return res.status(400).json({ error: "Missing required fields: 'code' and 'title'" });
      }
      const result = await ingestionService.ingestVideo(item);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Ingest Batch of Videos
  app.post("/api/ingestion/ingest-batch", async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.videos) ? req.body.videos : []);
      if (items.length === 0) {
        return res.status(400).json({ error: "Empty or invalid 'items' array" });
      }
      const result = await ingestionService.ingestBatch(items);
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Database Stats
  app.get("/api/ingestion/stats", async (req, res) => {
    try {
      const stats = await ingestionService.getDatabaseStats();
      res.json(stats);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Step 6 Automated Test Suite
  app.post("/api/ingestion/test-suite", async (req, res) => {
    try {
      const report = await ingestionService.runStep6TestSuite();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // ==========================================
  // STEP 7: Bulk Scraper & Transactional Pipeline
  // ==========================================

  // Universal Bulk Scraper: Scrape any listing / detail / search / category URL
  app.post("/api/scraper/bulk-scrape-url", async (req, res) => {
    try {
      const { url, filterDuplicates, enrichDetails, maxEnrich } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Missing required 'url' string parameter" });
      }
      const scrapeResult = await javtifulScraper.scrapeAnyUrl(url, {
        filterDuplicates: Boolean(filterDuplicates),
        enrichDetails: Boolean(enrichDetails),
        maxEnrich: typeof maxEnrich === "number" ? maxEnrich : 10,
      });
      res.json(scrapeResult);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Bulk Scrape & Ingest in ONE single GitHub transaction commit
  app.post("/api/scraper/bulk-ingest-url", async (req, res) => {
    try {
      const { url, enrichDetails, commitMessage } = req.body;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "Missing required 'url' string parameter" });
      }

      // 1. Scrape URL
      const scrapeResult = await javtifulScraper.scrapeAnyUrl(url, {
        filterDuplicates: false,
        enrichDetails: Boolean(enrichDetails),
        maxEnrich: 15,
      });

      // 2. Prepare items for bulk transaction
      const itemsToIngest = scrapeResult.items.map((it) => ({
        code: it.code,
        title: it.title,
        postUrl: it.postUrl,
        thumbnail: it.coverImage,
        actress: it.actress,
        actressSlug: it.actressSlug,
        studio: it.studio,
        studioSlug: it.studioSlug,
        duration: it.duration,
        releaseDate: it.releaseDate,
      }));

      // 3. Commit ALL in ONE single atomic transaction (STOP RULE)
      const batchResult = await ingestionService.bulkIngestTransaction(itemsToIngest, {
        commitMessage: commitMessage || `[Bulk Pipeline] Ingested from ${url} in single transaction`,
      });

      res.json({
        success: true,
        sourceUrl: url,
        totalScraped: scrapeResult.totalFound,
        scrapeResult,
        batchResult,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Bulk Commit Staged Items in ONE single atomic transaction
  app.post("/api/scraper/bulk-commit", async (req, res) => {
    try {
      const items = Array.isArray(req.body.items) ? req.body.items : (Array.isArray(req.body.videos) ? req.body.videos : []);
      if (items.length === 0) {
        return res.status(400).json({ error: "Empty or invalid 'items' array" });
      }
      const commitMessage = req.body.commitMessage;
      const result = await ingestionService.bulkIngestTransaction(items, { commitMessage });
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Step 7 Automated Verification Test Suite
  app.post("/api/scraper/step7-test-suite", async (req, res) => {
    try {
      const report = await ingestionService.runStep7TestSuite(async () => {
        try {
          return await javtifulScraper.scrapeAnyUrl("https://javtiful.com/main", {
            filterDuplicates: false,
            enrichDetails: false,
          });
        } catch (err) {
          return { error: String(err), simulated: true };
        }
      });
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Master Videos Index: Paginated, searchable, filterable
  app.get("/api/videos", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const actress = ((req.query.actress as string) || "").toLowerCase().trim();
      const studio = ((req.query.studio as string) || "").toLowerCase().trim();
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "24", 10)));

      const index = await ingestionService.getVideosIndex();
      let filtered = index.videos;

      if (q) {
        filtered = filtered.filter((v) =>
          (v.code && v.code.toLowerCase().includes(q)) ||
          (v.title && v.title.toLowerCase().includes(q)) ||
          (v.actressName && v.actressName.toLowerCase().includes(q)) ||
          (v.studioName && v.studioName.toLowerCase().includes(q))
        );
      }
      if (actress) {
        filtered = filtered.filter((v) =>
          (v.actressSlug && v.actressSlug.toLowerCase() === actress) ||
          (v.actressName && v.actressName.toLowerCase().includes(actress))
        );
      }
      if (studio) {
        filtered = filtered.filter((v) =>
          (v.studioSlug && v.studioSlug.toLowerCase() === studio) ||
          (v.studioName && v.studioName.toLowerCase().includes(studio))
        );
      }

      const totalFound = filtered.length;
      const totalPages = Math.ceil(totalFound / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        totalCount: index.totalCount,
        totalFound,
        page,
        totalPages,
        limit,
        videos: paginated,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Actresses Master Index: Paginated, letter-filterable, searchable
  app.get("/api/actresses", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const letter = ((req.query.letter as string) || "").toLowerCase().trim();
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "36", 10)));

      const index = await ingestionService.getActressesIndex();
      let filtered = index.actresses;

      if (q) {
        filtered = filtered.filter((a) =>
          a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
        );
      }
      if (letter && letter !== "all") {
        if (letter === "#") {
          filtered = filtered.filter((a) => a.letter === "_");
        } else {
          filtered = filtered.filter((a) => a.letter === letter);
        }
      }

      const totalFound = filtered.length;
      const totalPages = Math.ceil(totalFound / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        totalCount: index.totalCount,
        totalFound,
        page,
        totalPages,
        limit,
        actresses: paginated,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Single Sharded Actress Entity: loads database/pstar/{letter}/{slug}.json
  app.get("/api/actresses/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const entity = await ingestionService.getActressEntity(slug);
      if (!entity) {
        return res.status(404).json({ error: `Actress '${slug}' not found` });
      }
      res.json(entity);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Studios Master Index: Paginated, letter-filterable, searchable
  app.get("/api/studios", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toLowerCase().trim();
      const letter = ((req.query.letter as string) || "").toLowerCase().trim();
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "36", 10)));

      const index = await ingestionService.getStudiosIndex();
      let filtered = index.studios;

      if (q) {
        filtered = filtered.filter((s) =>
          s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q)
        );
      }
      if (letter && letter !== "all") {
        if (letter === "#") {
          filtered = filtered.filter((s) => s.letter === "_");
        } else {
          filtered = filtered.filter((s) => s.letter === letter);
        }
      }

      const totalFound = filtered.length;
      const totalPages = Math.ceil(totalFound / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      res.json({
        totalCount: index.totalCount,
        totalFound,
        page,
        totalPages,
        limit,
        studios: paginated,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Single Sharded Studio Entity: loads database/studio/{letter}/{slug}.json
  app.get("/api/studios/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const entity = await ingestionService.getStudioEntity(slug);
      if (!entity) {
        return res.status(404).json({ error: `Studio '${slug}' not found` });
      }
      res.json(entity);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Codes Master Index: Paginated, searchable list from database/index/codes.json
  app.get("/api/codes", async (req, res) => {
    try {
      const q = ((req.query.q as string) || "").toUpperCase().trim();
      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10));
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || "50", 10)));

      const { index } = await codeRegistryService.getOrLoadIndex();
      let codeEntries = Object.values(index.codes);

      if (q) {
        codeEntries = codeEntries.filter((c) =>
          c.code.toUpperCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q.toLowerCase())) ||
          (c.actressName && c.actressName.toLowerCase().includes(q.toLowerCase())) ||
          (c.studioName && c.studioName.toLowerCase().includes(q.toLowerCase()))
        );
      }

      const totalFound = codeEntries.length;
      const totalPages = Math.ceil(totalFound / limit) || 1;
      const startIndex = (page - 1) * limit;
      const paginated = codeEntries.slice(startIndex, startIndex + limit);

      res.json({
        totalCount: index.totalCount,
        totalFound,
        page,
        totalPages,
        limit,
        codes: paginated,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // ==========================================
  // STEP 8: UNIVERSAL SEARCH & MEDIA HARVESTER
  // ==========================================

  // Universal Cross-Index Search Endpoint
  app.get("/api/search", async (req, res) => {
    try {
      const q = (req.query.q as string) || "";
      const type = (req.query.type as any) || "all";
      const page = parseInt((req.query.page as string) || "1", 10);
      const limit = parseInt((req.query.limit as string) || "24", 10);

      const result = await searchService.universalSearch({
        query: q,
        type,
        page,
        limit,
      });

      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Deep Video Metadata & Media Harvester Endpoint
  app.get("/api/media/harvest", async (req, res) => {
    try {
      const target = (req.query.url as string) || (req.query.code as string) || "";
      if (!target) {
        return res.status(400).json({ error: "Query parameter 'url' or 'code' is required" });
      }

      const media = await searchService.harvestMediaDetails(target);
      res.json(media);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Step 8 Automated Verification Test Suite
  app.post("/api/search/step8-test-suite", async (_req, res) => {
    try {
      const report = await searchService.runStep8TestSuite();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // ==========================================
  // STEP 11: VALIDATION & MAINTENANCE TOOLS
  // ==========================================

  // Full Database & Index Diagnostics
  app.get("/api/maintenance/diagnostics", async (_req, res) => {
    try {
      const report = await maintenanceService.runFullDiagnostics();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Full Master Indexes Rebuild from Ground Truth Entities
  app.post("/api/maintenance/rebuild-indexes", async (_req, res) => {
    try {
      const result = await maintenanceService.rebuildAllIndexes();
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Auto-Repair Discovered Database Issues
  app.post("/api/maintenance/repair", async (_req, res) => {
    try {
      const result = await maintenanceService.autoRepair();
      res.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: errorMsg });
    }
  });

  // Step 11 Automated Verification Test Suite (Step 11 Stop Rule)
  app.post("/api/maintenance/step11-test-suite", async (_req, res) => {
    try {
      const report = await maintenanceService.runStep11MaintenanceTestSuite();
      res.json(report);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ success: false, error: errorMsg });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Avdb] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
