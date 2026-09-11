import React, { useState, useEffect } from "react";
import {
  Hash,
  ShieldAlert,
  CheckCircle2,
  Search,
  RefreshCw,
  XCircle,
  ExternalLink,
  Users,
  Building2,
  Calendar,
  Download,
  Sparkles,
  Link2
} from "lucide-react";
import { CodeSummary, NavView } from "../../types";
import { MediaHarvesterModal } from "../modals/MediaHarvesterModal";

interface CodeViewProps {
  onNavigate?: (view: NavView) => void;
}

export const CodeView: React.FC<CodeViewProps> = ({ onNavigate }) => {
  const [codes, setCodes] = useState<CodeSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Live Code Checker
  const [checkInput, setCheckInput] = useState("");
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    code: string;
    normalizedCode: string;
    isValidFormat: boolean;
    isDuplicate: boolean;
    existingEntry?: CodeSummary;
  } | null>(null);

  // Media Harvester Modal
  const [harvesterTarget, setHarvesterTarget] = useState<string | null>(null);

  const fetchCodes = async (targetPage = 1, query = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        limit: "50",
      });
      if (query.trim()) params.append("q", query.trim());

      const res = await fetch(`/api/codes?${params.toString()}`);
      const data = await res.json();
      setCodes(data.codes || []);
      setTotalCount(data.totalCount || 0);
      setTotalFound(data.totalFound || 0);
      setTotalPages(data.totalPages || 1);
      setPage(data.page || 1);
    } catch (err) {
      console.error("Failed to load codes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes(1, searchQuery);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCodes(1, searchQuery);
  };

  const handleCheckCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInput.trim()) return;
    setCheckLoading(true);
    try {
      const res = await fetch(`/api/codes/check?code=${encodeURIComponent(checkInput.trim())}`);
      const data = await res.json();
      setCheckResult(data);
    } catch (err) {
      console.error("Failed to check code:", err);
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-neutral-900 text-white tracking-wide">
                Registry Index
              </span>
              <h1 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                <Hash className="w-5 h-5 text-neutral-700" />
                Global Code Registry & Deduplication Engine
              </h1>
            </div>
            <p className="text-xs text-neutral-500 mt-1">
              Deterministic O(1) hash index in{" "}
              <code className="font-mono bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-800">
                database/index/codes.json
              </code>{" "}
              guaranteeing zero duplicate records across the entire repository.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchCodes(page, searchQuery)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50 text-xs font-medium text-neutral-700 transition-colors shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Code Checker Bar */}
        <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Live Code Syntax & Deduplication Checker</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-mono">
              Total in Master Index: {totalCount} unique codes
            </span>
          </div>

          <form onSubmit={handleCheckCode} className="flex gap-2">
            <input
              type="text"
              value={checkInput}
              onChange={(e) => setCheckInput(e.target.value)}
              placeholder="Enter code to verify (e.g., SSIS-001, moil_008)..."
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-neutral-300 bg-white font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={checkLoading || !checkInput.trim()}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              {checkLoading ? "Checking..." : "Verify Code"}
            </button>
          </form>

          {/* Checker Result Display */}
          {checkResult && (
            <div className="p-3 bg-white rounded-lg border border-neutral-200 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-neutral-900">
                    Input: {checkResult.code}
                  </span>
                  &rarr;
                  <span className="font-mono text-neutral-600 bg-neutral-100 px-1.5 py-0.5 rounded">
                    Normalized: {checkResult.normalizedCode || "Invalid"}
                  </span>
                </div>

                {checkResult.isDuplicate ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs font-medium">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                      Duplicate Detected (Already Indexed)
                    </span>
                    <button
                      onClick={() => setHarvesterTarget(checkResult.normalizedCode || checkResult.code)}
                      className="inline-flex items-center gap-1 text-neutral-900 hover:underline font-medium text-xs ml-1"
                    >
                      <Download className="w-3 h-3" />
                      Inspect Streams
                    </button>
                  </div>
                ) : !checkResult.isValidFormat ? (
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-medium">
                    <XCircle className="w-3.5 h-3.5" />
                    Invalid Code Format
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Available (Unique & Safe to Ingest)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Database Search & List */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative max-w-md w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search registry by code or title..."
              className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-300 rounded-lg focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors"
            />
          </form>
          <div className="text-xs text-neutral-500 font-mono shrink-0">
            Showing {codes.length} of {totalFound} results
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Title / Subject</th>
                <th className="px-4 py-3">Relations</th>
                <th className="px-4 py-3">Added Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && codes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading registry...
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    No codes found matching your criteria.
                  </td>
                </tr>
              ) : (
                codes.map((item) => (
                  <tr key={item.code} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-900">
                      {item.code}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate text-neutral-600">
                      {item.title || "Unknown Title"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.actressName && (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-rose-100 truncate max-w-[100px]">
                            <Users className="w-3 h-3 shrink-0" />
                            {item.actressName}
                          </span>
                        )}
                        {item.studioName && (
                          <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-sky-100 truncate max-w-[100px]">
                            <Building2 className="w-3 h-3 shrink-0" />
                            {item.studioName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-neutral-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {new Date(item.addedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => setHarvesterTarget(item.code)}
                        className="inline-flex items-center justify-center p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded transition-colors"
                        title="Inspect Streams"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {item.postUrl && (
                        <a
                          href={item.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-1.5 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Open Source"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-neutral-200 flex items-center justify-between">
            <button
              onClick={() => fetchCodes(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 disabled:opacity-50 hover:bg-neutral-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-neutral-500 font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => fetchCodes(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 border border-neutral-300 rounded-md text-xs font-medium text-neutral-700 disabled:opacity-50 hover:bg-neutral-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <MediaHarvesterModal
        isOpen={!!harvesterTarget}
        onClose={() => setHarvesterTarget(null)}
        postUrlOrCode={harvesterTarget}
      />
    </div>
  );
};
