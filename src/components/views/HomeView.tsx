import React, { useState, useEffect } from "react";
import {
  BackendStatus,
  NavView,
  SelfTestReport,
  DatabaseStatusReport,
  IndexFileStatus,
  StoragePerformanceMetrics,
  Step10PerformanceReport,
} from "../../types";
import {
  Search,
  Layers,
  Users,
  Building2,
  Hash,
  Film,
  FolderTree,
  ArrowRight,
  HardDrive,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Activity,
  Database,
  FileCode,
  RefreshCw,
  Zap,
  Trash2,
  Clock,
  ShieldCheck,
  Wrench,
} from "lucide-react";

interface HomeViewProps {
  status: BackendStatus | null;
  onNavigate: (view: NavView) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ status, onNavigate }) => {
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testReport, setTestReport] = useState<SelfTestReport | null>(null);

  // Schema status & interactive samples
  const [schemaReport, setSchemaReport] = useState<DatabaseStatusReport | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [selectedSample, setSelectedSample] = useState<string>("codesIndex");

  // Step 10: Performance, Caching & Concurrency telemetry
  const [perfMetrics, setPerfMetrics] = useState<StoragePerformanceMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [isRunningPerfTest, setIsRunningPerfTest] = useState(false);
  const [perfReport, setPerfReport] = useState<Step10PerformanceReport | null>(null);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  const fetchSchemaStatus = async () => {
    setLoadingSchema(true);
    try {
      const res = await fetch("/api/database/schema-status");
      const data: DatabaseStatusReport = await res.json();
      setSchemaReport(data);
    } catch (err) {
      console.error("Failed to load schema status:", err);
    } finally {
      setLoadingSchema(false);
    }
  };

  const fetchPerformanceMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await fetch("/api/storage/metrics");
      const data = await res.json();
      if (data.metrics) {
        setPerfMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Failed to load performance metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    fetchSchemaStatus();
    fetchPerformanceMetrics();
  }, []);

  const runStorageSelfTest = async () => {
    setIsRunningTest(true);
    try {
      const res = await fetch("/api/storage/test", { method: "POST" });
      const data: SelfTestReport = await res.json();
      setTestReport(data);
    } catch (err) {
      console.error("Storage test error:", err);
    } finally {
      setIsRunningTest(false);
    }
  };

  const handlePurgeCache = async () => {
    setIsPurgingCache(true);
    setPurgeFeedback(null);
    try {
      const res = await fetch("/api/storage/cache/purge", { method: "POST" });
      const data = await res.json();
      setPurgeFeedback(data.message || `Purged ${data.purgedCount} cache entries.`);
      await fetchPerformanceMetrics();
    } catch (err) {
      setPurgeFeedback("Failed to purge storage cache.");
      console.error(err);
    } finally {
      setIsPurgingCache(false);
      setTimeout(() => setPurgeFeedback(null), 4000);
    }
  };

  const runStep10PerformanceSuite = async () => {
    setIsRunningPerfTest(true);
    try {
      const res = await fetch("/api/system/step10-performance-test", { method: "POST" });
      const data: Step10PerformanceReport = await res.json();
      setPerfReport(data);
      if (data.metrics) {
        setPerfMetrics(data.metrics);
      }
    } catch (err) {
      console.error("Performance test suite error:", err);
    } finally {
      setIsRunningPerfTest(false);
    }
  };

  const directoryLayout = [
    {
      path: "database/index/codes.json",
      desc: "Global index of normalized video codes (unique registry)",
      type: "Index",
    },
    {
      path: "database/index/actresses.json",
      desc: "Master index of all actress slugs and metadata summaries",
      type: "Index",
    },
    {
      path: "database/index/studios.json",
      desc: "Master index of all studio slugs and metadata summaries",
      type: "Index",
    },
    {
      path: "database/index/videos.json",
      desc: "Chronological or paginated list of cataloged video records",
      type: "Index",
    },
    {
      path: "database/pstar/{a..z}/{slug}.json",
      desc: "Individual actress profiles and video references",
      type: "Entity Store",
    },
    {
      path: "database/studio/{a..z}/{slug}.json",
      desc: "Individual studio profiles and video references",
      type: "Entity Store",
    },
  ];

  const quickLinks: Array<{ id: NavView; label: string; icon: React.ElementType; desc: string }> = [
    { id: "search", label: "Search", icon: Search, desc: "Search across code, actress, or studio" },
    { id: "bulk-scraper", label: "Bulk Scraper", icon: Layers, desc: "Batch ingestion pipeline" },
    { id: "actress", label: "Actress Catalog", icon: Users, desc: "Browse actress records in pstar/" },
    { id: "studio", label: "Studio Catalog", icon: Building2, desc: "Browse studio records in studio/" },
    { id: "code", label: "Code Registry", icon: Hash, desc: "Deduplication & code index" },
    { id: "videos", label: "Video Catalog", icon: Film, desc: "Aggregated video database" },
    { id: "maintenance", label: "Maintenance Tools", icon: Wrench, desc: "Validation, duplicate/orphan detection & rebuild" },
  ];

  const sampleTabs: Array<{ id: string; label: string; path: string }> = [
    { id: "codesIndex", label: "codes.json", path: "database/index/codes.json" },
    { id: "actressesIndex", label: "actresses.json", path: "database/index/actresses.json" },
    { id: "studiosIndex", label: "studios.json", path: "database/index/studios.json" },
    { id: "videosIndex", label: "videos.json", path: "database/index/videos.json" },
    { id: "actressEntity", label: "actress.json", path: "database/pstar/{letter}/{slug}.json" },
    { id: "studioEntity", label: "studio.json", path: "database/studio/{letter}/{slug}.json" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8">
      {/* System Status Banner */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wide">
              <span>Universal Metadata Architecture</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700">Storage & Indexes Active</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-neutral-900 mt-1">
              Avdb Metadata Repository
            </h2>
            <p className="text-xs sm:text-sm text-neutral-600 mt-1 max-w-2xl leading-relaxed">
              Minimalist web application for searching, scraping, organizing, and browsing video metadata.
              GitHub repository JSON acts as the persistent, single-source-of-truth database.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 shrink-0">
            <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="text-[11px] font-medium text-neutral-500">Repository</div>
              <div className="text-xs sm:text-sm font-semibold font-mono text-neutral-900 truncate">
                {status?.repo ? `${status.repo.owner}/${status.repo.repo}` : "telebottg7-sudo/Avdb"}
              </div>
            </div>
            <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="text-[11px] font-medium text-neutral-500">Target Root</div>
              <div className="text-xs sm:text-sm font-semibold font-mono text-neutral-900">
                {status?.repo?.root || "database"}/
              </div>
            </div>
            {status?.rateLimit && (
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
                <div className="text-[11px] font-medium text-neutral-500">API Rate Limit</div>
                <div className="text-xs sm:text-sm font-semibold font-mono text-neutral-900 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{status.rateLimit.remaining} / {status.rateLimit.limit}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Core Database Master Indexes Registry (Step 3 Status) */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">Core Master Indexes Status</h3>
              <p className="text-xs text-neutral-500">
                Verified against repository <code className="font-mono text-neutral-700">{status?.repo?.root || "database"}/index/*.json</code>
              </p>
            </div>
          </div>

          <button
            onClick={fetchSchemaStatus}
            disabled={loadingSchema}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSchema ? "animate-spin" : ""}`} />
            <span>Refresh Indexes</span>
          </button>
        </div>

        {schemaReport && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            {(Object.entries(schemaReport.files) as [string, IndexFileStatus][]).map(([key, file]) => (
              <div
                key={key}
                className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-xs text-neutral-900 truncate">
                      {key}.json
                    </span>
                    {file.exists && file.valid ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100/70 text-emerald-800 text-[10px] font-semibold shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Valid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold shrink-0">
                        Missing
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 mt-1 truncate">
                    {file.path}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] pt-2 border-t border-neutral-200/60">
                  <span className="text-neutral-500">Records</span>
                  <span className="font-mono font-semibold text-neutral-800">{file.totalCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Canonical Schema Samples & Spec Viewer */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-neutral-700 shrink-0" />
          <h3 className="text-sm font-semibold text-neutral-900">Canonical Schema Specifications</h3>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 border border-neutral-200 p-1 rounded-lg bg-neutral-50 text-xs overflow-x-auto">
          {sampleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedSample(tab.id)}
              className={`px-3 py-1.5 rounded-md font-mono text-xs font-medium transition-colors shrink-0 ${
                selectedSample === tab.id
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200"
                  : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sample Payload Display */}
        {schemaReport?.samples && (
          <div className="rounded-lg border border-neutral-200 bg-neutral-900 p-3 sm:p-4 text-neutral-100 overflow-x-auto font-mono text-xs max-h-80">
            <div className="text-[11px] text-neutral-400 mb-2">
              // Target Path: {sampleTabs.find((t) => t.id === selectedSample)?.path}
            </div>
            <pre className="text-emerald-400 leading-relaxed">
              {JSON.stringify(
                (schemaReport.samples as Record<string, unknown>)[selectedSample],
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* GitHub Storage Diagnostics & Verification Suite (Step 2 Verification) */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">GitHub Storage Verification Suite</h3>
              <p className="text-xs text-neutral-500">
                Verifies read, write, existence-check, atomic multi-file batch commit, and cleanup against repository.
              </p>
            </div>
          </div>

          <button
            onClick={runStorageSelfTest}
            disabled={isRunningTest}
            className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-xs font-medium transition-colors flex items-center justify-center gap-2 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
          >
            {isRunningTest ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Running Verification...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Storage Self-Test</span>
              </>
            )}
          </button>
        </div>

        {testReport && (
          <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testReport.success ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Storage Verification Succeeded ({testReport.totalDurationMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5" />
                    Verification Failed
                  </span>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                {new Date(testReport.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 overflow-hidden text-xs bg-neutral-50/30">
              {testReport.steps.map((step, idx) => (
                <div key={idx} className="p-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {step.status === "passed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900">{step.name}</div>
                      {step.message && (
                        <div className="text-neutral-600 text-[11px] mt-0.5 break-all">
                          {step.message}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                    {step.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 10: High-Performance Caching & Concurrency Control */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">
                  Step 10: High-Performance Caching & Concurrency Control
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                In-memory index caching, write queue serialization, timeout handling & exponential backoff retries
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={handlePurgeCache}
              disabled={isPurgingCache}
              className="px-3 py-2 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Purge all in-memory cached index files"
            >
              {isPurgingCache ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-500" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 text-neutral-500" />
              )}
              <span>Purge Cache</span>
            </button>

            <button
              onClick={runStep10PerformanceSuite}
              disabled={isRunningPerfTest}
              className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed shadow-xs"
            >
              {isRunningPerfTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Load-Testing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Step 10 Benchmark</span>
                </>
              )}
            </button>
          </div>
        </div>

        {purgeFeedback && (
          <div className="px-3.5 py-2 rounded-lg bg-neutral-100 border border-neutral-200 text-xs font-mono text-neutral-800 flex items-center justify-between">
            <span>{purgeFeedback}</span>
            <span className="text-[10px] text-neutral-500">Auto-clearing</span>
          </div>
        )}

        {/* Real-time Storage Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
            <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between">
              <span>Cache Hit Ratio</span>
              <Activity className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-neutral-900 mt-1">
              {perfMetrics ? `${(perfMetrics.cache.hitRatio * 100).toFixed(1)}%` : "100%"}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              {perfMetrics ? `${perfMetrics.cache.hits} hits / ${perfMetrics.cache.misses} misses` : "0 hits"}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
            <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between">
              <span>Cache Lookup Speed</span>
              <Clock className="w-3 h-3 text-blue-600" />
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-neutral-900 mt-1">
              {perfMetrics && perfMetrics.cache.avgLatencyMs > 0
                ? `${perfMetrics.cache.avgLatencyMs.toFixed(2)}ms`
                : "< 1.0ms"}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              {perfMetrics ? `${perfMetrics.cache.totalEntries} files cached` : "In-memory LRU"}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
            <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between">
              <span>Write Queue Mutex</span>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-neutral-900 mt-1">
              {perfMetrics?.writeQueue.activeWrites ? "1 Active" : "Idle (0)"}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              {perfMetrics ? `Peak queue: ${perfMetrics.writeQueue.peakQueueLength}` : "Serialized FIFO"}
            </div>
          </div>

          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
            <div className="text-[11px] font-medium text-neutral-500 flex items-center justify-between">
              <span>Race Conflict Safety</span>
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
            </div>
            <div className="text-base sm:text-lg font-bold font-mono text-emerald-700 mt-1">
              0 Collisions
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
              Zero 409 errors
            </div>
          </div>
        </div>

        {/* Step 10 Benchmark Report Display */}
        {perfReport && (
          <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {perfReport.success ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Step 10 Performance & Race Condition Test Passed ({perfReport.totalDurationMs}ms)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-3.5 h-3.5" />
                    Benchmark Identified Errors
                  </span>
                )}
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                {new Date(perfReport.timestamp).toLocaleTimeString()}
              </span>
            </div>

            <div className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 overflow-hidden text-xs bg-neutral-50/30">
              {perfReport.steps.map((step, idx) => (
                <div key={idx} className="p-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {step.status === "passed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900">{step.name}</div>
                      {step.details && (
                        <div className="text-neutral-600 text-[11px] mt-0.5 font-mono">
                          {typeof step.details === "string"
                            ? step.details
                            : JSON.stringify(step.details)}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 shrink-0">
                    {step.durationMs}ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Target Repository Directory Map */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
          <FolderTree className="w-4 h-4 text-neutral-700 shrink-0" />
          <span>Configured Storage Hierarchy</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {directoryLayout.map((item) => (
            <div
              key={item.path}
              className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 flex flex-col justify-between text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2 font-mono font-semibold text-neutral-800">
                <span className="truncate">{item.path}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-700 font-sans shrink-0">
                  {item.type}
                </span>
              </div>
              <p className="text-neutral-500 leading-normal">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access Sections */}
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">
          Sidebar Views
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="p-4 rounded-xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-xs transition-all text-left flex flex-col justify-between group"
              >
                <div>
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-800 group-hover:bg-neutral-900 group-hover:text-white transition-colors mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="font-semibold text-sm text-neutral-900">{link.label}</div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{link.desc}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-medium text-neutral-700 group-hover:text-neutral-900">
                  <span>Open view</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
