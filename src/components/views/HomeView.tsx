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
  Copy,
  Check,
  Sparkles,
  ExternalLink,
  Flame,
} from "lucide-react";
import { DatabaseTopologyGraphic } from "../home/DatabaseTopologyGraphic";
import { DatabaseHealthGauges } from "../home/DatabaseHealthGauges";

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
  const [copiedSample, setCopiedSample] = useState(false);

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

  const handleCopySample = () => {
    if (!schemaReport?.samples) return;
    const sampleData = (schemaReport.samples as Record<string, unknown>)[selectedSample];
    navigator.clipboard.writeText(JSON.stringify(sampleData, null, 2));
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  const directoryLayout = [
    {
      path: "database/index/codes.json",
      desc: "Global master index of normalized video codes for instantaneous deduplication checks.",
      type: "Index",
      count: schemaReport?.files?.codes?.totalCount,
    },
    {
      path: "database/index/videos.json",
      desc: "Chronological registry of cataloged video records with thumbnail and metadata references.",
      type: "Index",
      count: schemaReport?.files?.videos?.totalCount,
    },
    {
      path: "database/index/actresses.json",
      desc: "Master index of all actress slugs, profile pointers, and catalog summary counts.",
      type: "Index",
      count: schemaReport?.files?.actresses?.totalCount,
    },
    {
      path: "database/index/studios.json",
      desc: "Master index of all studio and channel slugs with indexed releases counters.",
      type: "Index",
      count: schemaReport?.files?.studios?.totalCount,
    },
    {
      path: "database/pstar/{a..z}/{slug}.json",
      desc: "Sharded individual actress profiles containing full video lists and aliases.",
      type: "Entity Store",
    },
    {
      path: "database/studio/{a..z}/{slug}.json",
      desc: "Sharded individual studio profiles containing production video references.",
      type: "Entity Store",
    },
  ];

  const quickLinks: Array<{ id: NavView; label: string; icon: React.ElementType; desc: string; badge?: string }> = [
    { id: "bulk-scraper", label: "Bulk Scraper", icon: Layers, desc: "Batch ingestion pipeline for Javtiful videos, actresses & channels", badge: "Ingestion" },
    { id: "search", label: "Search Engine", icon: Search, desc: "Sub-millisecond query across code, actress, studio & release title", badge: "Live Query" },
    { id: "code", label: "Code Registry", icon: Hash, desc: "Normalized code de-duplication registry & prefix analytics", badge: `${schemaReport?.files?.codes?.totalCount ?? 62} Codes` },
    { id: "videos", label: "Video Catalog", icon: Film, desc: "Browse full video database with rich tags, performers & studio info", badge: `${schemaReport?.files?.videos?.totalCount ?? 60} Releases` },
    { id: "actress", label: "Actress Catalog", icon: Users, desc: "Explore sharded actress profiles in database/pstar/", badge: `${schemaReport?.files?.actresses?.totalCount ?? 34} Profiles` },
    { id: "studio", label: "Studio Catalog", icon: Building2, desc: "Explore studio directory and production releases in database/studio/", badge: `${schemaReport?.files?.studios?.totalCount ?? 22} Studios` },
    { id: "maintenance", label: "Maintenance Tools", icon: Wrench, desc: "Deep validation, duplicate/orphan detection, index repairs & rebuilds", badge: "Health Audit" },
  ];

  const sampleTabs: Array<{ id: string; label: string; path: string }> = [
    { id: "codesIndex", label: "codes.json", path: "database/index/codes.json" },
    { id: "videosIndex", label: "videos.json", path: "database/index/videos.json" },
    { id: "actressesIndex", label: "actresses.json", path: "database/index/actresses.json" },
    { id: "studiosIndex", label: "studios.json", path: "database/index/studios.json" },
    { id: "actressEntity", label: "actress.json (pstar/)", path: "database/pstar/{letter}/{slug}.json" },
    { id: "studioEntity", label: "studio.json (studio/)", path: "database/studio/{letter}/{slug}.json" },
  ];

  const totalIndexed =
    (schemaReport?.files?.codes?.totalCount ?? 62) +
    (schemaReport?.files?.videos?.totalCount ?? 60) +
    (schemaReport?.files?.actresses?.totalCount ?? 34) +
    (schemaReport?.files?.studios?.totalCount ?? 22);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* 1. HERO BANNER WITH REPOSITORY TELEMETRY */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-500 uppercase tracking-wider">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Single-Source JSON Engine
              </span>
              <span className="text-neutral-300">|</span>
              <span className="text-neutral-600">Avdb Universal Architecture</span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-neutral-950 tracking-tight">
              Avdb Metadata Repository & Database Engine
            </h1>

            <p className="text-xs sm:text-sm text-neutral-600 max-w-2xl leading-relaxed">
              High-performance, file-backed metadata repository storing normalized Japanese Adult Video records directly in GitHub JSON.
              Includes built-in de-duplication, in-memory LRU caching, atomic mutex write queues, and live scraping pipelines.
            </p>

            {/* Quick Action Navigation Buttons */}
            <div className="pt-2 flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => onNavigate("bulk-scraper")}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all hover:shadow"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Open Bulk Scraper</span>
              </button>

              <button
                onClick={() => onNavigate("search")}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Search className="w-3.5 h-3.5 text-neutral-500" />
                <span>Search Database</span>
              </button>

              <button
                onClick={() => onNavigate("maintenance")}
                className="px-3.5 py-2 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Wrench className="w-3.5 h-3.5 text-neutral-500" />
                <span>Run Integrity Audit</span>
              </button>
            </div>
          </div>

          {/* Right Status Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 shrink-0">
            <div className="px-3.5 py-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/80">
              <div className="text-[10px] font-mono font-medium text-neutral-500 uppercase">Target Repository</div>
              <div className="text-xs font-bold font-mono text-neutral-900 truncate">
                {status?.repo ? `${status.repo.owner}/${status.repo.repo}` : "telebottg7-sudo/Avdb"}
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/80">
              <div className="text-[10px] font-mono font-medium text-neutral-500 uppercase">Database Root</div>
              <div className="text-xs font-bold font-mono text-neutral-900">
                {status?.repo?.root || "database"}/
              </div>
            </div>

            <div className="px-3.5 py-2.5 rounded-xl border border-neutral-200/80 bg-neutral-50/80">
              <div className="text-[10px] font-mono font-medium text-neutral-500 uppercase">Total Records</div>
              <div className="text-xs font-bold font-mono text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>{totalIndexed} Indexed Entities</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. GRAPHICAL DATABASE TOPOLOGY & DATA FLOW PIPELINE */}
      <DatabaseTopologyGraphic
        cacheHitRatio={perfMetrics?.cache.hitRatio ?? 0.72}
        avgLatencyMs={perfMetrics?.cache.avgLatencyMs ?? 0.01}
        totalCodes={schemaReport?.files?.codes?.totalCount ?? 62}
        totalVideos={schemaReport?.files?.videos?.totalCount ?? 60}
        totalActresses={schemaReport?.files?.actresses?.totalCount ?? 34}
        totalStudios={schemaReport?.files?.studios?.totalCount ?? 22}
        onNavigate={onNavigate}
      />

      {/* 3. GRAPHICAL DATABASE HEALTH GAUGES & COMPOSITION CHART */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Database Health & Performance Telemetry
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Real-time in-memory caching efficiency, sub-millisecond lookup latency & concurrency metrics
            </p>
          </div>
          <button
            onClick={() => {
              fetchSchemaStatus();
              fetchPerformanceMetrics();
            }}
            disabled={loadingSchema || loadingMetrics}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSchema || loadingMetrics ? "animate-spin" : ""}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>

        <DatabaseHealthGauges
          schemaReport={schemaReport}
          perfMetrics={perfMetrics}
          onNavigate={onNavigate}
        />
      </div>

      {/* 4. MASTER INDEXES REAL-TIME STATUS CARDS */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">
                Core Master Index Registry Files
              </h3>
              <p className="text-xs text-neutral-500">
                Single-source index files in <code className="font-mono text-neutral-700">{status?.repo?.root || "database"}/index/*.json</code>
              </p>
            </div>
          </div>

          <span className="text-xs font-mono text-neutral-500">
            SHA-1 verified on each commit
          </span>
        </div>

        {schemaReport && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
            {(Object.entries(schemaReport.files) as [string, IndexFileStatus][]).map(([key, file]) => {
              const routeMapping: Record<string, NavView> = {
                codes: "code",
                videos: "videos",
                actresses: "actress",
                studios: "studio",
              };
              const targetRoute = routeMapping[key] || "home";

              return (
                <div
                  key={key}
                  className="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/50 hover:bg-white hover:border-neutral-300 hover:shadow-xs transition-all flex flex-col justify-between space-y-3 group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="font-mono font-bold text-sm text-neutral-900 group-hover:text-emerald-700 transition-colors">
                        {key}.json
                      </span>
                      {file.exists && file.valid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Missing
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-neutral-400 truncate">
                      {file.path}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-200/70">
                      <span className="text-neutral-500 font-medium">Record Count</span>
                      <span className="font-mono font-bold text-neutral-900 text-sm">{file.totalCount}</span>
                    </div>

                    {file.sha && (
                      <div className="text-[10px] font-mono text-neutral-400 truncate bg-neutral-100/80 px-2 py-1 rounded">
                        SHA: {file.sha.substring(0, 12)}...
                      </div>
                    )}

                    <button
                      onClick={() => onNavigate(targetRoute)}
                      className="w-full pt-1 text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 flex items-center justify-between transition-colors"
                    >
                      <span>Explore Catalog</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. CANONICAL SCHEMA SPECIFICATIONS & SYNTAX VIEWER */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-neutral-800 shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Canonical JSON Schema Specifications</h3>
              <p className="text-xs text-neutral-500">Live schema templates for storage indexing and sharded entity files</p>
            </div>
          </div>

          <button
            onClick={handleCopySample}
            disabled={!schemaReport?.samples}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-700 text-xs font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            {copiedSample ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied JSON!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-neutral-500" />
                <span>Copy Specification</span>
              </>
            )}
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1.5 border border-neutral-200 p-1.5 rounded-xl bg-neutral-50 text-xs overflow-x-auto">
          {sampleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedSample(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-all shrink-0 ${
                selectedSample === tab.id
                  ? "bg-white text-neutral-900 shadow-xs border border-neutral-200/80"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sample Payload Display */}
        {schemaReport?.samples && (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-neutral-100 overflow-x-auto font-mono text-xs max-h-80 shadow-inner">
            <div className="text-[11px] text-neutral-400 mb-2 pb-2 border-b border-neutral-800 flex items-center justify-between">
              <span>// Schema Path: {sampleTabs.find((t) => t.id === selectedSample)?.path}</span>
              <span className="text-emerald-400 text-[10px]">Strict TypeScript Schema</span>
            </div>
            <pre className="text-emerald-400 leading-relaxed font-mono">
              {JSON.stringify(
                (schemaReport.samples as Record<string, unknown>)[selectedSample],
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* 6. STORAGE VERIFICATION & CONCURRENCY BENCHMARK SUITES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Verification Suite */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-neutral-700" />
                <h3 className="text-sm font-bold text-neutral-900">GitHub Storage Verification Suite</h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                Step 2 Suite
              </span>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Validates read, write, existence-check, atomic multi-file commit, and cleanup against repository storage.
            </p>
          </div>

          <div>
            <button
              onClick={runStorageSelfTest}
              disabled={isRunningTest}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-xs"
            >
              {isRunningTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Storage Diagnostics...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Storage Self-Test</span>
                </>
              )}
            </button>

            {testReport && (
              <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {testReport.success ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Passed ({testReport.totalDurationMs}ms)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Failed
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-neutral-400">
                    {new Date(testReport.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {testReport.steps.map((step, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-neutral-800">{step.name}</span>
                      <span className="font-mono text-neutral-500">{step.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 10 Concurrency & Performance Suite */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-neutral-900">Step 10 Concurrency & Benchmark</h3>
              </div>
              <button
                onClick={handlePurgeCache}
                disabled={isPurgingCache}
                className="text-[11px] text-neutral-600 hover:text-neutral-900 font-semibold flex items-center gap-1 underline"
              >
                <Trash2 className="w-3 h-3" />
                <span>Purge Cache</span>
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Runs concurrent load tests, race-condition safety checks, and in-memory cache speed benchmarks.
            </p>
          </div>

          <div>
            <button
              onClick={runStep10PerformanceSuite}
              disabled={isRunningPerfTest}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:bg-neutral-950 text-white text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-xs"
            >
              {isRunningPerfTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Benchmarking Concurrency...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Step 10 Concurrency Suite</span>
                </>
              )}
            </button>

            {perfReport && (
              <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {perfReport.success ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      All Race Checks Passed ({perfReport.totalDurationMs}ms)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Identified Errors
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-neutral-400">
                    {new Date(perfReport.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                  {perfReport.steps.map((step, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-neutral-50 border border-neutral-200/60 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-neutral-800">{step.name}</span>
                      <span className="font-mono text-neutral-500">{step.durationMs}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. QUICK ACCESS EXPLORER TILES */}
      <div>
        <div className="mb-3">
          <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
            Application Modules & Catalogs
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Direct access to ingestion pipelines, code indexes, performers, and maintenance tools
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="p-4 rounded-2xl border border-neutral-200/90 bg-white hover:border-neutral-300 hover:shadow-xs transition-all text-left flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    {link.badge && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                        {link.badge}
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm text-neutral-900 group-hover:text-neutral-950">{link.label}</div>
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{link.desc}</p>
                </div>
                <div className="mt-4 pt-2 border-t border-neutral-100 flex items-center gap-1 text-xs font-semibold text-neutral-600 group-hover:text-neutral-900">
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
