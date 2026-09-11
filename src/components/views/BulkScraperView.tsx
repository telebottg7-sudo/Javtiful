import React, { useState, useEffect } from "react";
import {
  Globe,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Play,
  Film,
  User,
  Building,
  Calendar,
  Layers,
  ChevronRight,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  JavtifulVideoItem,
  JavtifulScrapeResult,
  JavtifulTestSuiteReport,
  JavtifulActressItem,
  JavtifulStudioItem,
  NavView,
} from "../../types";

interface BulkScraperViewProps {
  onNavigate?: (view: NavView) => void;
}

export const BulkScraperView: React.FC<BulkScraperViewProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<"bulk" | "catalog" | "search" | "actresses" | "studios" | "test">("bulk");

  // Step 7 Universal Bulk Scraper State
  const [bulkUrl, setBulkUrl] = useState<string>("https://javtiful.com/main");
  const [bulkEnrichDetails, setBulkEnrichDetails] = useState<boolean>(true);
  const [bulkFilterDuplicates, setBulkFilterDuplicates] = useState<boolean>(false);
  const [bulkScraping, setBulkScraping] = useState<boolean>(false);
  const [bulkScrapeResult, setBulkScrapeResult] = useState<JavtifulScrapeResult | null>(null);
  const [bulkScrapeError, setBulkScrapeError] = useState<string | null>(null);
  const [bulkBatchCommitting, setBulkBatchCommitting] = useState<boolean>(false);

  // Step 7 Transaction Receipt State
  const [commitReceipt, setCommitReceipt] = useState<{
    commitSha: string;
    commitUrl?: string;
    modifiedFiles: string[];
    ingestedCount: number;
    duplicateCount: number;
    isSingleCommit: boolean;
  } | null>(null);

  // Step 7 Test Suite State

  // Catalog State
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const [filterDuplicates, setFilterDuplicates] = useState<boolean>(false);
  const [enrichDetails, setEnrichDetails] = useState<boolean>(true);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(false);
  const [catalogResult, setCatalogResult] = useState<JavtifulScrapeResult | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("SSIS-001");
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<JavtifulScrapeResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Inspector Modal / Details State
  const [selectedVideo, setSelectedVideo] = useState<JavtifulVideoItem | null>(null);
  const [inspectLoading, setInspectLoading] = useState<boolean>(false);

  // Actresses State
  const [actresses, setActresses] = useState<JavtifulActressItem[]>([]);
  const [actressesLoading, setActressesLoading] = useState<boolean>(false);
  const [selectedActress, setSelectedActress] = useState<string | null>(null);
  const [actressVideos, setActressVideos] = useState<JavtifulVideoItem[]>([]);

  // Studios State
  const [studios, setStudios] = useState<JavtifulStudioItem[]>([]);
  const [studiosLoading, setStudiosLoading] = useState<boolean>(false);
  const [selectedStudio, setSelectedStudio] = useState<string | null>(null);
  const [studioVideos, setStudioVideos] = useState<JavtifulVideoItem[]>([]);

  // Test Suite State

  // Batch Registration & Ingestion State (Step 6)
  const [registeringCode, setRegisteringCode] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState<string | null>(null);
  const [ingestingCode, setIngestingCode] = useState<string | null>(null);
  const [batchIngesting, setBatchIngesting] = useState<boolean>(false);
  const [ingestionBanner, setIngestionBanner] = useState<{
    type: "success" | "info" | "error";
    message: string;
    details?: string;
  } | null>(null);

  // Step 6 Ingestion Test Suite State

  // Initial load: fetch page 1 of catalog
  useEffect(() => {
    fetchCatalog(1);
  }, []);

  const fetchCatalog = async (page: number) => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const res = await fetch(
        `/api/scrapers/javtiful/catalog?page=${page}&filterDuplicates=${filterDuplicates}&enrichDetails=${enrichDetails}`
      );
      if (!res.ok) {
        throw new Error(`Failed to load catalog: HTTP ${res.status}`);
      }
      const data: JavtifulScrapeResult = await res.json();
      setCatalogResult(data);
      setCatalogPage(page);
    } catch (err: unknown) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/scrapers/javtiful/search?q=${encodeURIComponent(searchQuery.trim())}&filterDuplicates=${filterDuplicates}&enrichDetails=${enrichDetails}`);
      if (!res.ok) {
        throw new Error(`Search failed: HTTP ${res.status}`);
      }
      const data: JavtifulScrapeResult = await res.json();
      setSearchResult(data);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setSearchLoading(false);
    }
  };

  const inspectPostDetails = async (video: JavtifulVideoItem) => {
    setSelectedVideo(video);
    setInspectLoading(true);
    try {
      const res = await fetch(`/api/scrapers/javtiful/post?url=${encodeURIComponent(video.postUrl)}`);
      if (res.ok) {
        const enriched: JavtifulVideoItem = await res.json();
        setSelectedVideo(enriched);
      }
    } catch (err) {
      console.error("Failed to fetch full post details:", err);
    } finally {
      setInspectLoading(false);
    }
  };

  const loadActresses = async () => {
    if (actresses.length > 0) return;
    setActressesLoading(true);
    try {
      const res = await fetch("/api/scrapers/javtiful/actresses");
      const data = await res.json();
      setActresses(data.actresses || []);
    } catch (err) {
      console.error("Failed to load actresses:", err);
    } finally {
      setActressesLoading(false);
    }
  };

  const loadStudios = async () => {
    if (studios.length > 0) return;
    setStudiosLoading(true);
    try {
      const res = await fetch("/api/scrapers/javtiful/studios");
      const data = await res.json();
      setStudios(data.studios || []);
    } catch (err) {
      console.error("Failed to load studios:", err);
    } finally {
      setStudiosLoading(false);
    }
  };

  const viewActressVideos = async (slug: string) => {
    setSelectedActress(slug);
    try {
      const res = await fetch(`/api/scrapers/javtiful/actress-videos?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setActressVideos(data.items || []);
    } catch (err) {
      console.error("Failed to fetch actress videos:", err);
    }
  };

  const viewStudioVideos = async (slug: string) => {
    setSelectedStudio(slug);
    try {
      const res = await fetch(`/api/scrapers/javtiful/studio-videos?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setStudioVideos(data.items || []);
    } catch (err) {
      console.error("Failed to fetch studio videos:", err);
    }
  };


  const registerItemInRegistry = async (item: JavtifulVideoItem) => {
    if (!item.code) return;
    setRegisteringCode(item.code);
    setRegisterSuccess(null);
    try {
      const res = await fetch("/api/codes/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              code: item.code,
              title: item.title,
              postUrl: item.postUrl,
              actressName: item.actress,
              studioName: item.studio,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.registeredCount > 0 || data.duplicatesCount > 0) {
        setRegisterSuccess(`Registered ${item.code} in CodeRegistryService`);
        // Update local item duplicate status
        item.isDuplicate = true;
        if (selectedVideo && selectedVideo.code === item.code) {
          setSelectedVideo({ ...selectedVideo, isDuplicate: true });
        }
      }
    } catch (err) {
      console.error("Failed to register code:", err);
    } finally {
      setRegisteringCode(null);
    }
  };

  // Step 6: Ingest video through IngestionService (master index + sharded actress + sharded studio + code registry)
  const ingestVideo = async (item: JavtifulVideoItem) => {
    if (!item.code) return;
    setIngestingCode(item.code);
    setIngestionBanner(null);
    try {
      const res = await fetch("/api/ingestion/ingest-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.code,
          title: item.title,
          actressName: item.actress,
          studioName: item.studio,
          duration: item.duration,
          releaseDate: item.releaseDate,
          thumbnail: item.coverImage,
          postUrl: item.postUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIngestionBanner({
          type: "success",
          message: `Ingested ${item.code} into sharded database`,
          details: `Commit ${data.commitSha?.slice(0, 7)} — modified ${data.modifiedFiles?.length || 0} index and sharded files.`,
        });
        item.isDuplicate = true;
        if (selectedVideo && selectedVideo.code === item.code) {
          setSelectedVideo({ ...selectedVideo, isDuplicate: true });
        }
      } else {
        setIngestionBanner({
          type: "error",
          message: `Ingestion failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err: unknown) {
      setIngestionBanner({
        type: "error",
        message: `Ingestion error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIngestingCode(null);
    }
  };

  // Ingest all unregistered videos on current page
  const ingestAllUnregistered = async () => {
    if (!catalogResult?.items) return;
    const unregistered = catalogResult.items.filter((it) => !it.isDuplicate);
    if (unregistered.length === 0) return;

    setBatchIngesting(true);
    setIngestionBanner(null);
    try {
      const payload = unregistered.map((item) => ({
        code: item.code,
        title: item.title,
        actressName: item.actress,
        studioName: item.studio,
        duration: item.duration,
        releaseDate: item.releaseDate,
        thumbnail: item.coverImage,
        postUrl: item.postUrl,
      }));

      const res = await fetch("/api/ingestion/ingest-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videos: payload }),
      });
      const data = await res.json();

      if (data.success) {
        setIngestionBanner({
          type: "success",
          message: `Batch Ingestion: ${data.ingestedCount} new videos ingested (${data.duplicateCount} duplicates skipped).`,
          details: `Atomic Commit ${data.commitSha?.slice(0, 7)} — updated ${data.modifiedFiles?.length || 0} files.`,
        });
        catalogResult.items.forEach((it) => {
          it.isDuplicate = true;
        });
        catalogResult.duplicateCount += data.ingestedCount;
        catalogResult.uniqueCount = Math.max(0, catalogResult.uniqueCount - data.ingestedCount);
      } else {
        setIngestionBanner({
          type: "error",
          message: `Batch ingestion failed: ${data.error || "Unknown error"}`,
        });
      }
    } catch (err: unknown) {
      setIngestionBanner({
        type: "error",
        message: `Batch ingestion error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setBatchIngesting(false);
    }
  };

  // Run Step 6 test suite

  // Step 7: Universal URL Scraper
  const handleBulkScrapeUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bulkUrl.trim()) return;

    setBulkScraping(true);
    setBulkScrapeError(null);
    setCommitReceipt(null);
    try {
      const res = await fetch("/api/scraper/bulk-scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: bulkUrl.trim(),
          filterDuplicates: bulkFilterDuplicates,
          enrichDetails: bulkEnrichDetails,
          maxEnrich: 15,
        }),
      });
      if (!res.ok) {
        throw new Error(`Failed to scrape URL: HTTP ${res.status}`);
      }
      const data: JavtifulScrapeResult = await res.json();
      setBulkScrapeResult(data);
    } catch (err: unknown) {
      setBulkScrapeError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkScraping(false);
    }
  };

  // Step 7: Commit All in ONE Single Atomic Batch Transaction (Stop Rule Enforcement)
  const handleCommitAllBulk = async () => {
    if (!bulkScrapeResult?.items) return;
    const unregistered = bulkScrapeResult.items.filter((it) => !it.isDuplicate);
    if (unregistered.length === 0) return;

    setBulkBatchCommitting(true);
    setCommitReceipt(null);
    try {
      const payload = unregistered.map((item) => ({
        code: item.code,
        title: item.title,
        actress: item.actress,
        actressSlug: item.actressSlug,
        studio: item.studio,
        studioSlug: item.studioSlug,
        duration: item.duration,
        releaseDate: item.releaseDate,
        thumbnail: item.coverImage,
        postUrl: item.postUrl,
      }));

      const res = await fetch("/api/scraper/bulk-commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: payload,
          commitMessage: `[Step 7 Bulk Ingestion] Batch ingested ${payload.length} videos from ${bulkUrl} in single transaction`,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setCommitReceipt({
          commitSha: data.commitSha || "N/A",
          commitUrl: data.commitUrl,
          modifiedFiles: data.modifiedFiles || [],
          ingestedCount: data.ingestedCount,
          duplicateCount: data.duplicateCount,
          isSingleCommit: data.isSingleCommit ?? true,
        });

        // Mark all items as duplicate/registered
        bulkScrapeResult.items.forEach((it) => {
          it.isDuplicate = true;
        });
        bulkScrapeResult.duplicateCount += data.ingestedCount;
        bulkScrapeResult.uniqueCount = Math.max(0, bulkScrapeResult.uniqueCount - data.ingestedCount);
      } else {
        setBulkScrapeError(data.error || "Bulk commit transaction failed");
      }
    } catch (err: unknown) {
      setBulkScrapeError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBatchCommitting(false);
    }
  };


  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              STEP 7
            </span>
            <h1 className="text-lg font-semibold text-neutral-900">Bulk Scraper & Transactional Commit Pipeline</h1>
          </div>
          <p className="text-xs text-neutral-500">
            Universal scraper pipeline supporting any Javtiful page (catalog, actress, channel, or search) with in-memory tree batching and strictly <strong>1 atomic GitHub commit</strong> per bulk operation (Stop Rule).
          </p>
        </div>


      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-neutral-200 flex items-center gap-2 overflow-x-auto text-xs font-medium pb-px">
        <button
          onClick={() => setActiveTab("bulk")}
          className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "bulk"
              ? "border-neutral-900 text-neutral-900 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Bulk Scraper (URL Pipeline)</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
            Step 7
          </span>
        </button>

        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "catalog"
              ? "border-neutral-900 text-neutral-900 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Catalog (javtiful.com/main)</span>
        </button>

        <button
          onClick={() => setActiveTab("search")}
          className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "search"
              ? "border-neutral-900 text-neutral-900 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search (Code / Keyword)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("actresses");
            loadActresses();
          }}
          className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "actresses"
              ? "border-neutral-900 text-neutral-900 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Actresses Directory</span>
        </button>

        <button
          onClick={() => {
            setActiveTab("studios");
            loadStudios();
          }}
          className={`px-3 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "studios"
              ? "border-neutral-900 text-neutral-900 font-semibold"
              : "border-transparent text-neutral-500 hover:text-neutral-800"
          }`}
        >
          <Building className="w-3.5 h-3.5" />
          <span>Studios Directory</span>
        </button>


      </div>

      {registerSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{registerSuccess}</span>
          </div>
          <button
            onClick={() => setRegisterSuccess(null)}
            className="text-neutral-400 hover:text-neutral-600 text-xs ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 0: STEP 7 BULK SCRAPER & TRANSACTIONAL PIPELINE */}
      {activeTab === "bulk" && (
        <div className="space-y-6">
          {/* Universal URL Scraper Form */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                  <span>Universal URL Scraper & Transactional Pipeline</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                    Atomic Git Batch Commit
                  </span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Accepts any page URL (catalog, actress, channel, or search), detects all posts, extracts metadata, checks global deduplication, and commits changes in <strong>1 single atomic transaction</strong>.
                </p>
              </div>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-neutral-500 text-[11px] font-medium">Quick Presets:</span>
              <button
                type="button"
                onClick={() => setBulkUrl("https://javtiful.com/main")}
                className="px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-mono text-[11px] transition-colors border border-neutral-200"
              >
                /main (Catalog)
              </button>
              <button
                type="button"
                onClick={() => setBulkUrl("https://javtiful.com/actress/hatano-yui")}
                className="px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-mono text-[11px] transition-colors border border-neutral-200"
              >
                /actress/hatano-yui
              </button>
              <button
                type="button"
                onClick={() => setBulkUrl("https://javtiful.com/channel/s1")}
                className="px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-mono text-[11px] transition-colors border border-neutral-200"
              >
                /channel/s1
              </button>
              <button
                type="button"
                onClick={() => setBulkUrl("https://javtiful.com/search?q=STARS")}
                className="px-2.5 py-1 rounded bg-neutral-100 text-neutral-700 hover:bg-neutral-200 font-mono text-[11px] transition-colors border border-neutral-200"
              >
                /search?q=STARS
              </button>
            </div>

            <form onSubmit={handleBulkScrapeUrl} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={bulkUrl}
                    onChange={(e) => setBulkUrl(e.target.value)}
                    placeholder="https://javtiful.com/main or /actress/slug or /channel/slug"
                    className="w-full pl-9 pr-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 font-mono"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={bulkScraping || !bulkUrl.trim()}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium transition-colors shadow-xs shrink-0 disabled:opacity-60"
                >
                  {bulkScraping ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-neutral-300" />
                      <span>Scraping & Detecting...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      <span>Scrape Page & Posts</span>
                    </>
                  )}
                </button>
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700 select-none">
                    <input
                      type="checkbox"
                      checked={bulkEnrichDetails}
                      onChange={(e) => setBulkEnrichDetails(e.target.checked)}
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    <span>Enrich post details (Fetch post page for actress, studio & date)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-neutral-700 select-none">
                    <input
                      type="checkbox"
                      checked={bulkFilterDuplicates}
                      onChange={(e) => setBulkFilterDuplicates(e.target.checked)}
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    <span>Hide registered duplicates</span>
                  </label>
                </div>

                {bulkScrapeResult && bulkScrapeResult.uniqueCount > 0 && (
                  <button
                    type="button"
                    onClick={handleCommitAllBulk}
                    disabled={bulkBatchCommitting}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-60"
                  >
                    {bulkBatchCommitting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Committing Transaction...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Commit All Unregistered ({bulkScrapeResult.uniqueCount}) in 1 Commit</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>

            {bulkScrapeError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{bulkScrapeError}</span>
              </div>
            )}
          </div>

          {/* STEP 7 STOP RULE COMPLIANT COMMIT RECEIPT */}
          {commitReceipt && (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                      Single Atomic GitHub Commit Transaction Complete
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Step 7 Stop Rule strictly enforced: Committed all index updates and sharded records together in 1 commit.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-200/80 text-emerald-900 border border-emerald-300">
                    1 Commit (Zero Per-Video Commits)
                  </span>
                  {commitReceipt.commitUrl && (
                    <a
                      href={commitReceipt.commitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-800 hover:text-emerald-950 underline font-semibold"
                    >
                      <span>{commitReceipt.commitSha.slice(0, 7)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase block">Ingested Videos</span>
                  <span className="text-base font-bold text-emerald-950 font-mono">{commitReceipt.ingestedCount}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase block">Duplicates Skipped</span>
                  <span className="text-base font-bold text-emerald-950 font-mono">{commitReceipt.duplicateCount}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase block">Files Modified</span>
                  <span className="text-base font-bold text-emerald-950 font-mono">{commitReceipt.modifiedFiles.length}</span>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-semibold uppercase block">Transaction Mode</span>
                  <span className="text-xs font-bold text-emerald-950 font-mono">Atomic Tree</span>
                </div>
              </div>

              {commitReceipt.modifiedFiles.length > 0 && (
                <div className="text-[11px] space-y-1 pt-1">
                  <span className="text-emerald-800 font-semibold block">Modified Repository Files:</span>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                    {commitReceipt.modifiedFiles.map((file, i) => (
                      <span key={i} className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-emerald-900">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Grid */}
          {bulkScrapeResult && (
            <div className="space-y-4">
              {/* Scrape Stats Bar */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-neutral-500 font-medium">Results for:</span>
                  <span className="font-mono text-neutral-800 font-semibold truncate max-w-md">
                    {bulkScrapeResult.source}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-neutral-500">
                    Total Detected: <strong className="text-neutral-900 font-mono">{bulkScrapeResult.totalFound}</strong>
                  </span>
                  <span className="text-emerald-700">
                    Unique to Ingest: <strong className="font-mono">{bulkScrapeResult.uniqueCount}</strong>
                  </span>
                  <span className="text-amber-700">
                    Already in DB: <strong className="font-mono">{bulkScrapeResult.duplicateCount}</strong>
                  </span>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {bulkScrapeResult.items.map((item, idx) => (
                  <div
                    key={`${item.code || item.postUrl}-${idx}`}
                    className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      {/* Image container */}
                      <div className="relative aspect-video bg-neutral-100 overflow-hidden">
                        {item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-400">
                            <Film className="w-8 h-8" />
                          </div>
                        )}

                        {/* Duration Badge */}
                        {item.duration && (
                          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-[10px] flex items-center gap-1 backdrop-blur-xs">
                            <Clock className="w-3 h-3" />
                            <span>{item.duration}</span>
                          </div>
                        )}

                        {/* Duplicate / Unique Badge */}
                        <div className="absolute top-2 left-2">
                          {item.isDuplicate ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500 text-white shadow-xs">
                              In Database
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500 text-white shadow-xs">
                              New
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200 truncate">
                            {item.code || "NO-CODE"}
                          </span>
                          {item.releaseDate && (
                            <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 shrink-0">
                              <Calendar className="w-3 h-3" />
                              <span>{item.releaseDate}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-xs font-medium text-neutral-800 line-clamp-2 leading-relaxed title={item.title}">
                          {item.title}
                        </h3>

                        {(item.actress || item.studio) && (
                          <div className="flex flex-wrap gap-1 text-[10px] pt-1">
                            {item.actress && (
                              <span className="px-1.5 py-0.5 rounded bg-pink-50 text-pink-700 border border-pink-200 flex items-center gap-0.5 font-medium">
                                <User className="w-2.5 h-2.5" />
                                <span>{item.actress}</span>
                              </span>
                            )}
                            {item.studio && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-0.5 font-medium">
                                <Building className="w-2.5 h-2.5" />
                                <span>{item.studio}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-3 pt-0 border-t border-neutral-100 flex items-center justify-between gap-2 mt-2">
                      <button
                        onClick={() => inspectPostDetails(item)}
                        className="text-[11px] text-neutral-600 hover:text-neutral-900 font-medium flex items-center gap-1 transition-colors"
                      >
                        <Info className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>

                      {!item.isDuplicate ? (
                        <button
                          onClick={() => ingestVideo(item)}
                          disabled={ingestingCode === item.code}
                          className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-medium hover:bg-neutral-800 transition-colors disabled:opacity-60"
                        >
                          {ingestingCode === item.code ? "Ingesting..." : "Ingest"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-neutral-400 font-mono">Deduplicated</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: CATALOG */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={filterDuplicates}
                  onChange={(e) => {
                    setFilterDuplicates(e.target.checked);
                  }}
                  className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span>Filter out existing duplicates</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={enrichDetails}
                  onChange={(e) => {
                    setEnrichDetails(e.target.checked);
                  }}
                  className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                />
                <span>Auto-enrich full post details (actress & studio)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchCatalog(catalogPage)}
                disabled={catalogLoading}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${catalogLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>

              {catalogResult && catalogResult.uniqueCount > 0 && (
                <button
                  onClick={ingestAllUnregistered}
                  disabled={batchIngesting}
                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Layers className={`w-3.5 h-3.5 ${batchIngesting ? "animate-spin" : ""}`} />
                  <span>{batchIngesting ? "Ingesting Batch..." : `Ingest All New (${catalogResult.uniqueCount})`}</span>
                </button>
              )}

              <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                <button
                  disabled={catalogPage <= 1 || catalogLoading}
                  onClick={() => fetchCatalog(catalogPage - 1)}
                  className="px-2.5 py-1.5 bg-white hover:bg-neutral-50 disabled:opacity-40 text-neutral-700 border-r border-neutral-200"
                >
                  Prev
                </button>
                <span className="px-3 py-1.5 bg-neutral-50 font-mono text-[11px] text-neutral-600">
                  Page {catalogPage}
                </span>
                <button
                  disabled={catalogLoading}
                  onClick={() => fetchCatalog(catalogPage + 1)}
                  className="px-2.5 py-1.5 bg-white hover:bg-neutral-50 disabled:opacity-40 text-neutral-700"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Ingestion Notification Banner */}
          {ingestionBanner && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                ingestionBanner.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : ingestionBanner.type === "error"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
              }`}
            >
              <div className="space-y-0.5">
                <div className="font-semibold flex items-center gap-1.5">
                  {ingestionBanner.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{ingestionBanner.message}</span>
                </div>
                {ingestionBanner.details && (
                  <p className="text-[11px] opacity-80 font-mono pl-5.5">
                    {ingestionBanner.details}
                  </p>
                )}
              </div>
              <button
                onClick={() => setIngestionBanner(null)}
                className="opacity-60 hover:opacity-100 shrink-0"
              >
                &times;
              </button>
            </div>
          )}

          {/* Stats Bar */}
          {catalogResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-white border border-neutral-200 rounded-lg">
                <div className="text-neutral-500">Source Endpoint</div>
                <div className="font-mono text-neutral-800 truncate font-medium mt-0.5">
                  {catalogResult.source}
                </div>
              </div>
              <div className="p-3 bg-white border border-neutral-200 rounded-lg">
                <div className="text-neutral-500">Total Extracted</div>
                <div className="font-semibold text-neutral-900 mt-0.5">
                  {catalogResult.totalFound} videos
                </div>
              </div>
              <div className="p-3 bg-white border border-neutral-200 rounded-lg">
                <div className="text-neutral-500">Unique (New)</div>
                <div className="font-semibold text-emerald-600 mt-0.5">
                  {catalogResult.uniqueCount} items
                </div>
              </div>
              <div className="p-3 bg-white border border-neutral-200 rounded-lg">
                <div className="text-neutral-500">Duplicate in Registry</div>
                <div className="font-semibold text-amber-600 mt-0.5">
                  {catalogResult.duplicateCount} items
                </div>
              </div>
            </div>
          )}

          {catalogError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {catalogError}
            </div>
          )}

          {/* Cards Grid */}
          {catalogLoading && !catalogResult ? (
            <div className="py-16 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
              <span>Fetching and parsing Javtiful catalog from https://javtiful.com/main...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {catalogResult?.items.map((item, idx) => (
                <div
                  key={`${item.code}-${idx}`}
                  className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs hover:border-neutral-300 transition-all flex flex-col group"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-neutral-100 overflow-hidden">
                    {item.coverImage ? (
                      <img
                        src={item.coverImage}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-400">
                        <Film className="w-8 h-8 opacity-40" />
                      </div>
                    )}

                    {/* Overlay tags */}
                    <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
                      {item.duration && (
                        <span className="px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] tracking-tight">
                          {item.duration}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 left-2">
                      {item.isDuplicate ? (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/90 text-white text-[10px] font-semibold tracking-wider flex items-center gap-1 backdrop-blur-xs shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          IN REGISTRY
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-semibold tracking-wider flex items-center gap-1 backdrop-blur-xs shadow-xs">
                          <ShieldCheck className="w-3 h-3" />
                          NEW UNIQUE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200">
                          {item.code || "NO CODE"}
                        </span>
                        {item.releaseDate && (
                          <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.releaseDate}
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs text-neutral-800 font-medium line-clamp-2 leading-snug"
                        title={item.title}
                      >
                        {item.title}
                      </p>
                    </div>

                    {/* Metadata indicators */}
                    <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                      <div className="truncate max-w-[150px]">
                        {item.actress ? (
                          <span className="text-neutral-700">{item.actress}</span>
                        ) : (
                          <span className="text-neutral-400 italic">No actress listed</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => inspectPostDetails(item)}
                          className="px-2 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-medium"
                        >
                          Inspect
                        </button>
                        {!item.isDuplicate ? (
                          <button
                            onClick={() => ingestVideo(item)}
                            disabled={ingestingCode === item.code}
                            className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-medium transition-colors"
                          >
                            {ingestingCode === item.code ? "Ingesting..." : "+ Ingest"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-400 font-mono px-1">In DB</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SEARCH */}
      {activeTab === "search" && (
        <div className="space-y-4">
          <form onSubmit={handleSearch} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3">
            <label className="block text-xs font-semibold text-neutral-800">
              Search Javtiful by Code or Keyword
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-3 text-neutral-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. SSIS-001, DASS-374, Hatano Yui, Glory Quest..."
                  className="w-full pl-9 pr-3 py-2 border border-neutral-300 rounded-lg text-xs font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="px-4 py-2 bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-medium rounded-lg flex items-center gap-1.5 shrink-0"
              >
                {searchLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                <span>Search</span>
              </button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-neutral-500">
              <span>Quick tests:</span>
              {["SSIS-001", "GVH-607", "DASS-374", "Hatano", "Glory Quest"].map((q) => (
                <button
                  type="button"
                  key={q}
                  onClick={() => {
                    setSearchQuery(q);
                    fetch(`/api/scrapers/javtiful/search?q=${encodeURIComponent(q)}`)
                      .then((r) => r.json())
                      .then(setSearchResult);
                  }}
                  className="underline hover:text-neutral-800"
                >
                  {q}
                </button>
              ))}
            </div>
          </form>

          {searchError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              {searchError}
            </div>
          )}

          {searchResult && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>
                  Found <strong>{searchResult.totalFound}</strong> results for &ldquo;{searchQuery}&rdquo;
                </span>
                <span>
                  {searchResult.uniqueCount} new / {searchResult.duplicateCount} in registry
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResult.items.map((item, idx) => (
                  <div
                    key={`${item.code}-${idx}`}
                    className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-xs hover:border-neutral-300 transition-all flex flex-col justify-between"
                  >
                    <div className="relative aspect-video bg-neutral-100">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400">
                          <Film className="w-8 h-8 opacity-40" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2">
                        {item.isDuplicate ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/90 text-white text-[10px] font-semibold">
                            IN REGISTRY
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-600/90 text-white text-[10px] font-semibold">
                            UNIQUE
                          </span>
                        )}
                      </div>
                      {item.duration && (
                        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px]">
                          {item.duration}
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200 inline-block">
                          {item.code || "NO CODE"}
                        </span>
                        <p className="text-xs text-neutral-800 font-medium line-clamp-2">
                          {item.title}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                        <button
                          onClick={() => inspectPostDetails(item)}
                          className="text-xs font-medium text-neutral-700 hover:text-neutral-900 underline"
                        >
                          View Details
                        </button>
                        {!item.isDuplicate && (
                          <button
                            onClick={() => registerItemInRegistry(item)}
                            disabled={registeringCode === item.code}
                            className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-medium"
                          >
                            + Register
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTRESSES */}
      {activeTab === "actresses" && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wide">
                Javtiful Actresses Directory (/actresses)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Lists top featured actresses and models with video catalog links.
              </p>
            </div>
            <button
              onClick={() => {
                setActresses([]);
                loadActresses();
              }}
              disabled={actressesLoading}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actressesLoading ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>

          {actressesLoading ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Loading actresses from https://javtiful.com/actresses...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {actresses.map((a) => (
                <div
                  key={a.slug}
                  onClick={() => viewActressVideos(a.slug)}
                  className={`bg-white border rounded-xl p-3 shadow-xs cursor-pointer hover:border-neutral-400 transition-all flex flex-col items-center text-center space-y-2 ${
                    selectedActress === a.slug ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200"
                  }`}
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-neutral-100 flex items-center justify-center">
                    {a.thumbnail ? (
                      <img
                        src={a.thumbnail}
                        alt={a.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-8 h-8 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 line-clamp-1">{a.name}</div>
                    {a.videoCount !== undefined && (
                      <div className="text-[11px] text-neutral-400">{a.videoCount} videos</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedActress && actressVideos.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-neutral-900">
                  Videos for actress: <span className="font-mono text-neutral-700">{selectedActress}</span>
                </h4>
                <span className="text-xs text-neutral-500">{actressVideos.length} videos extracted</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {actressVideos.map((v, i) => (
                  <div key={i} className="p-2 border border-neutral-100 rounded-lg bg-neutral-50 space-y-1">
                    <div className="font-mono text-xs font-bold text-neutral-800">{v.code || "N/A"}</div>
                    <div className="text-xs text-neutral-600 line-clamp-1">{v.title}</div>
                    <div className="text-[10px] text-neutral-400">{v.duration}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STUDIOS */}
      {activeTab === "studios" && (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wide">
                Javtiful Studios & Channels Directory (/channels)
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                Lists top channels and production studios with indexed releases.
              </p>
            </div>
            <button
              onClick={() => {
                setStudios([]);
                loadStudios();
              }}
              disabled={studiosLoading}
              className="px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-50 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${studiosLoading ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>

          {studiosLoading ? (
            <div className="py-12 text-center text-xs text-neutral-500">
              Loading studios from https://javtiful.com/channels...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {studios.map((s) => (
                <div
                  key={s.slug}
                  onClick={() => viewStudioVideos(s.slug)}
                  className={`bg-white border rounded-xl p-3 shadow-xs cursor-pointer hover:border-neutral-400 transition-all flex flex-col items-center text-center space-y-2 ${
                    selectedStudio === s.slug ? "border-neutral-900 ring-2 ring-neutral-900/10" : "border-neutral-200"
                  }`}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-neutral-100 flex items-center justify-center p-2">
                    {s.thumbnail ? (
                      <img
                        src={s.thumbnail}
                        alt={s.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building className="w-6 h-6 text-neutral-400" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-900 line-clamp-1">{s.name}</div>
                    {s.videoCount !== undefined && (
                      <div className="text-[11px] text-neutral-400">{s.videoCount} videos</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedStudio && studioVideos.length > 0 && (
            <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-neutral-900">
                  Videos for studio: <span className="font-mono text-neutral-700">{selectedStudio}</span>
                </h4>
                <span className="text-xs text-neutral-500">{studioVideos.length} videos extracted</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {studioVideos.map((v, i) => (
                  <div key={i} className="p-2 border border-neutral-100 rounded-lg bg-neutral-50 space-y-1">
                    <div className="font-mono text-xs font-bold text-neutral-800">{v.code || "N/A"}</div>
                    <div className="text-xs text-neutral-600 line-clamp-1">{v.title}</div>
                    <div className="text-[10px] text-neutral-400">{v.duration}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AUTOMATED TEST SUITE (Step 7, 6, 5 Verification) */}
      

      {/* METADATA INSPECTOR MODAL */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200 shadow-xl space-y-5 p-6 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold bg-neutral-100 text-neutral-900 px-2 py-0.5 rounded border border-neutral-200">
                  {selectedVideo.code || "NO CODE"}
                </span>
                {selectedVideo.isDuplicate ? (
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-200">
                    Already in CodeRegistry
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                    Unique New Video
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedVideo(null)}
                className="text-neutral-400 hover:text-neutral-600 text-sm font-medium"
              >
                Close ✕
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-8 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-neutral-400" />
                <span>Fetching full post metadata from Javtiful...</span>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Cover Image */}
                {selectedVideo.coverImage && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200">
                    <img
                      src={selectedVideo.coverImage}
                      alt={selectedVideo.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Normalized Metadata Table */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-neutral-900 uppercase tracking-wider text-[11px]">
                    Extracted Normalized Metadata
                  </h4>
                  <div className="border border-neutral-200 rounded-lg overflow-hidden divide-y divide-neutral-100 font-mono text-[11px]">
                    <div className="p-2.5 bg-neutral-50 flex items-center justify-between">
                      <span className="text-neutral-500">code:</span>
                      <span className="font-bold text-neutral-900">{selectedVideo.code || "N/A"}</span>
                    </div>
                    <div className="p-2.5 flex items-start justify-between gap-4">
                      <span className="text-neutral-500 shrink-0">title:</span>
                      <span className="text-neutral-800 font-sans text-right">{selectedVideo.title}</span>
                    </div>
                    <div className="p-2.5 bg-neutral-50 flex items-center justify-between">
                      <span className="text-neutral-500">actress:</span>
                      <span className="text-neutral-900 font-semibold">{selectedVideo.actress || "(N/A)"}</span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-neutral-500">studio:</span>
                      <span className="text-neutral-900">{selectedVideo.studio || "(N/A)"}</span>
                    </div>
                    <div className="p-2.5 bg-neutral-50 flex items-center justify-between">
                      <span className="text-neutral-500">duration:</span>
                      <span className="text-neutral-900">{selectedVideo.duration || "(N/A)"}</span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between">
                      <span className="text-neutral-500">releaseDate:</span>
                      <span className="text-neutral-900">{selectedVideo.releaseDate || "(N/A)"}</span>
                    </div>
                    <div className="p-2.5 bg-neutral-50 flex items-start justify-between gap-2">
                      <span className="text-neutral-500 shrink-0">coverImage:</span>
                      <span className="text-neutral-600 truncate max-w-sm">{selectedVideo.coverImage || "(N/A)"}</span>
                    </div>
                    <div className="p-2.5 flex items-center justify-between gap-2">
                      <span className="text-neutral-500 shrink-0">canonical/post URL:</span>
                      <a
                        href={selectedVideo.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 truncate max-w-sm"
                      >
                        <span>{selectedVideo.postUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-neutral-100">
                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="px-4 py-2 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 font-medium"
                  >
                    Close
                  </button>
                  {!selectedVideo.isDuplicate && (
                    <button
                      onClick={() => ingestVideo(selectedVideo)}
                      disabled={ingestingCode === selectedVideo.code}
                      className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 font-medium transition-colors"
                    >
                      {ingestingCode === selectedVideo.code ? "Ingesting into Database..." : "Ingest into Database"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
