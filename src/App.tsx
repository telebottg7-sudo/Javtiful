/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';

export default function App() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<{ title: string; link: string; thumbnail?: string; isRelated?: boolean }[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrapePage, setScrapePage] = useState(1);
  const [searchPage, setSearchPage] = useState(1);
  const [mode, setMode] = useState<'scrape' | 'search_javtiful' | 'pornstars' | 'database'>('scrape');
  const [pornstars, setPornstars] = useState<any[]>([]);
  const [postDetails, setPostDetails] = useState<Record<string, { loading: boolean; data: any }>>({});
  const [hoveredIndex, setHoveredIndex] = useState<{ index: number; thumbIndex: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [dbQueries, setDbQueries] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedDbQuery, setSelectedDbQuery] = useState<string>('all');
  const [autoScrape, setAutoScrape] = useState(false);
  const [isAutoScraping, setIsAutoScraping] = useState(false);
  const [autoDownload, setAutoDownload] = useState(false);
  const autoScrapeTimeoutRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/auto-download-status')
      .then(res => res.json())
      .then(data => setAutoDownload(data.active))
      .catch(e => console.error("Error fetching auto-download status:", e));
  }, []);

  const handleToggleAutoDownload = async () => {
    try {
      const newState = !autoDownload;
      const res = await fetch('/api/auto-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newState })
      });
      const data = await res.json();
      setAutoDownload(data.active);
    } catch (e) {
      console.error("Error toggling auto-download:", e);
    }
  };

  useEffect(() => {
    fetch('/api/db-platforms')
      .then(res => res.json())
      .then(data => setPlatforms(data.platforms || []))
      .catch(e => console.error("Error fetching platforms:", e));

    fetch('/api/db-queries')
      .then(res => res.json())
      .then(data => setDbQueries(data.queries || []))
      .catch(e => console.error("Error fetching db queries:", e));
  }, []);

  const [showThumbnails, setShowThumbnails] = useState(true);
  const [detailsModal, setDetailsModal] = useState<{ isOpen: boolean; loading: boolean; data: any; url: string }>({
    isOpen: false, loading: false, data: null, url: ''
  });

  const handleExtractDetails = async (postUrl: string) => {
    // Check if we already have the details in our background cache
    if (postDetails[postUrl]?.data && !postDetails[postUrl].loading) {
      setDetailsModal({ isOpen: true, loading: false, data: postDetails[postUrl].data, url: postUrl });
      return;
    }

    setDetailsModal({ isOpen: true, loading: true, data: null, url: postUrl });
    try {
      const response = await fetch('/api/extract-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: postUrl }),
      });
      const data = await response.json();
      setDetailsModal({ isOpen: true, loading: false, data: data.details, url: postUrl });
    } catch (error) {
      setDetailsModal({ isOpen: true, loading: false, data: { error: 'Failed to load details' }, url: postUrl });
    }
  };

  useEffect(() => {
    if (mode === 'database') {
      handleExtract();
    }
  }, [selectedPlatform, selectedDbQuery]);

  const handleClearDb = async () => {
    if (confirm("Are you sure you want to clear the entire database? This action cannot be undone.")) {
      try {
        setLoading(true);
        await fetch('/api/clear-db', { method: 'POST' });
        setResults([]);
        setPornstars([]);
        alert("Database cleared.");
      } catch (e) {
        console.error("Error clearing DB:", e);
        alert("Failed to clear database.");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExtract = async (targetUrl?: string, pageToFetch?: number, append = false) => {
    const inputVal = targetUrl || url;
    if (targetUrl) setUrl(targetUrl);
    
    // Only return early if there's no URL and we're not in database mode
    if (!inputVal && mode !== 'database') return;
    
    // Explicitly reset search page if it's a new query (not from pagination button)
    const page = pageToFetch || 1;
    if (!pageToFetch && !append) setSearchPage(1);
    
    setLoading(true);
    try {
      const isUrl = inputVal.startsWith('http://') || inputVal.startsWith('https://');
      let endpoint = '/api/extract';
      let payload: any = { url: inputVal };
      
      if (mode === 'bulk_scrape' && isUrl) {
         try {
           const baseUrl = new URL(inputVal);
           baseUrl.searchParams.set('page', page.toString());
           payload = { url: baseUrl.toString() };
         } catch(e) {}
      }
      
      if (!isUrl) {
         if (mode === 'search_javtiful') {
            endpoint = '/api/search-javtiful';
            payload = { query: inputVal, page };
         } else if (mode === 'database') {
            endpoint = '/api/db-videos';
            payload = { query: inputVal, page, platform: selectedPlatform, sourceQuery: selectedDbQuery };
         }
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      const newResults = data.results || [];
      
      if (append) {
        setResults(prev => [...prev, ...newResults]);
      } else {
        setResults(newResults);
      }
      
      // Update postDetails with any pre-populated data from search/results
      const initialDetails: Record<string, any> = {};
      newResults.forEach((res: any) => {
        if (res.details || res.description || res.tags || res.views) {
          initialDetails[res.link] = { 
            loading: false, 
            data: res.details || {
              description: res.description,
              views: res.views,
              duration: res.duration,
              tags: res.tags ? (typeof res.tags === 'string' ? res.tags.split(',').map((t: string) => t.trim()) : res.tags) : []
            } 
          };
        }
      });
      if (Object.keys(initialDetails).length > 0) {
        setPostDetails(prev => ({ ...prev, ...initialDetails }));
      }

      // Automatically extract details for each result sequentially with delay to avoid 429
      extractDetailsSequentially(newResults.map((r: any) => r.link));

      // Auto-scrape logic: if enabled and we are in search mode or bulk scrape, fetch the next page
      if (autoScrape && newResults.length > 0 && (mode.startsWith('search') || mode === 'bulk_scrape')) {
        setIsAutoScraping(true);
        const nextReqPage = page + 1;
        setSearchPage(nextReqPage);
        
        // Use a longer delay between pages to avoid being blocked
        autoScrapeTimeoutRef.current = setTimeout(() => {
          // Re-check autoScrape state as it might have been disabled during wait
          handleExtract(inputVal, nextReqPage, true);
        }, 2000);
      } else {
        setIsAutoScraping(false);
      }

    } catch (error) {
      console.error('Error extracting:', error);
      setIsAutoScraping(false);
    } finally {
      setLoading(false);
    }
  };

  const extractDetailsSequentially = async (links: string[]) => {
    // Only process links that aren't already loading or have data
    const linksToFetch = links.filter(link => !postDetails[link]);
    
    for (const link of linksToFetch) {
      await fetchDetailsBackground(link);
      // Wait 1 second between requests if we're doing batch work to avoid 429
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  const fetchPornstars = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/pornstars');
      const data = await response.json();
      setPornstars(data.pornstars || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleScrapePornstars = async () => {
    setLoading(true);
    try {
      await fetch('/api/scrape-pornstars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: scrapePage }) });
      await fetchPornstars();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailsBackground = async (postUrl: string) => {
    // If we already have data or are loading, skip
    if (postDetails[postUrl]?.loading || postDetails[postUrl]?.data) return;

    setPostDetails(prev => ({ ...prev, [postUrl]: { loading: true, data: null } }));
    try {
      const response = await fetch('/api/extract-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: postUrl }),
      });
      
      if (response.status === 429) {
        setPostDetails(prev => ({ ...prev, [postUrl]: { loading: false, data: { error: 'Rate limit' } } }));
        return;
      }

      const data = await response.json();
      setPostDetails(prev => ({ ...prev, [postUrl]: { loading: false, data: data.details } }));
    } catch (error) {
      setPostDetails(prev => ({ ...prev, [postUrl]: { loading: false, data: { error: 'Failed' } } }));
    }
  };

  // Add effect for cycling thumbnails on hover
  useEffect(() => {
    const interval = setInterval(() => {
      setHoveredIndex(prev => {
        if (!prev) return null;
        const link = results[prev.index]?.link;
        if (!link) return prev;
        const thumbs = postDetails[link]?.data?.thumbs;
        if (!thumbs || thumbs.length <= 1) return prev;
        return { ...prev, thumbIndex: (prev.thumbIndex + 1) % thumbs.length };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [results, postDetails]);

  return (
    <div className="flex h-screen bg-bg text-text-main overflow-hidden font-sans">
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen} 
        mode={mode} 
        setMode={setMode} 
        fetchPornstars={fetchPornstars}
        handleExtract={handleExtract}
      />

      <main className="flex-grow overflow-y-auto p-4 sm:p-6 md:p-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 gap-4 mt-12 lg:mt-0">
            <div className="flex items-center gap-4">
              {!sidebarOpen && (
                <button 
                  onClick={() => setSidebarOpen(true)}
                  className="hidden lg:block p-2 border border-border rounded-lg bg-surface hover:bg-surface-hover text-text-muted hover:text-accent transition-colors shadow-sm"
                >
                  <Menu size={20} />
                </button>
              )}
              <h1 className="text-3xl sm:text-5xl md:text-5xl font-bold tracking-tight text-text-main">
                {mode === 'scrape' ? 'Link Extractor' : 
                 mode === 'bulk_scrape' ? 'Bulk Scraper' :
                 mode === 'search_javtiful' ? 'Javtiful Search' : 
                 mode === 'pornstars' ? 'Pornstars' : 'Saved Videos'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-muted">Auto Download (720p)</span>
                <button 
                  onClick={handleToggleAutoDownload}
                  className={`w-12 h-6 flex items-center px-1 rounded-full transition-colors ${autoDownload ? 'bg-accent' : 'bg-surface border border-border'}`}
                >
                  <div className={`w-4 h-4 rounded-full transition-transform ${autoDownload ? 'translate-x-6 bg-white' : 'translate-x-0 bg-text-muted'}`} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-text-muted">Thumbnails</span>
                <button 
                  onClick={() => setShowThumbnails(!showThumbnails)}
                  className={`w-12 h-6 flex items-center px-1 rounded-full transition-colors ${showThumbnails ? 'bg-accent' : 'bg-surface border border-border'}`}
                >
                  <div className={`w-4 h-4 rounded-full transition-transform ${showThumbnails ? 'translate-x-6 bg-white' : 'translate-x-0 bg-text-muted'}`} />
                </button>
              </div>
            </div>
          </div>
          
          {mode !== 'pornstars' && (
          <div className="flex flex-col mb-8 md:mb-12 gap-0 bg-surface/80 backdrop-blur-md sticky top-0 z-20 rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row w-full">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={mode === 'database' ? "Filter saved videos by title or query..." : (mode === 'bulk_scrape' ? "Enter base URL to bulk scrape (e.g. actress page)..." : (mode !== 'scrape' ? "Enter search query (e.g. teen, amateur)..." : "Enter website URL..."))}
                className="flex-grow bg-transparent border-b sm:border-b-0 border-border text-lg p-4 sm:p-5 outline-none font-mono placeholder-text-muted/50"
                onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
              />
              {mode === 'database' && (
                <>
                  <select
                    value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}
                    className="bg-transparent text-text-main border-l border-border p-4 font-semibold text-xs outline-none cursor-pointer hover:bg-surface-hover transition-colors"
                  >
                    <option value="all">Site: All</option>
                    {platforms.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <select
                    value={selectedDbQuery}
                    onChange={(e) => setSelectedDbQuery(e.target.value)}
                    className="bg-transparent text-text-main border-l border-border p-4 font-semibold text-xs outline-none cursor-pointer hover:bg-surface-hover transition-colors max-w-[200px]"
                  >
                    <option value="all">Query: All</option>
                    {dbQueries.map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleClearDb}
                    disabled={loading}
                    className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border-l border-border font-bold px-6 py-4 sm:px-8 cursor-pointer text-sm transition-colors shrink-0"
                  >
                    Clear DB
                  </button>
                </>
              )}
              <button
                onClick={() => handleExtract()}
                disabled={loading}
                className={`bg-accent text-white font-bold px-6 py-4 sm:px-10 cursor-pointer text-sm sm:text-base w-full sm:w-auto hover:bg-accent/90 transition-colors shrink-0 ${isAutoScraping ? 'animate-pulse' : ''}`}
              >
                {isAutoScraping ? 'Scraping...' : (loading ? 'Processing...' : (mode !== 'scrape' && !url.startsWith('http') ? 'Search' : 'Execute'))}
              </button>
            </div>
            {(mode === 'search_javtiful' || mode === 'bulk_scrape') && (
              <div className="flex items-center gap-4 p-4 border-t border-border bg-surface-hover">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-text-muted">Auto Scrape (All Pages)</span>
                  <button 
                    onClick={() => {
                      if (isAutoScraping) {
                        setAutoScrape(false);
                        setIsAutoScraping(false);
                      } else {
                        setAutoScrape(!autoScrape);
                      }
                    }}
                    className={`w-12 h-6 flex items-center px-1 rounded-full transition-colors ${autoScrape ? 'bg-accent' : 'bg-surface border border-border'}`}
                  >
                    <div className={`w-4 h-4 rounded-full transition-transform ${autoScrape ? 'translate-x-6 bg-white' : 'translate-x-0 bg-text-muted'}`} />
                  </button>
                </div>
                {isAutoScraping && (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-accent rounded-full animate-ping" />
                      <span className="text-[10px] font-mono font-black text-accent animate-pulse">Collecting page {searchPage}...</span>
                    </div>
                    <button 
                      onClick={() => {
                        setAutoScrape(false);
                        setIsAutoScraping(false);
                        if (autoScrapeTimeoutRef.current) {
                          clearTimeout(autoScrapeTimeoutRef.current);
                          autoScrapeTimeoutRef.current = null;
                        }
                      }}
                      className="px-3 py-1 bg-red-600 text-bg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                    >
                      Stop Scrape
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )}

      {mode === 'pornstars' && (
        <div className="mb-6 flex items-center justify-end gap-2">
          <label className="text-sm font-bold uppercase tracking-widest text-text-muted">Page:</label>
          <input 
            type="number" 
            min="1"
            value={scrapePage}
            onChange={(e) => setScrapePage(parseInt(e.target.value) || 1)}
            className="w-16 px-2 py-2 border-2 border-text-main bg-bg text-text-main text-center outline-none focus:border-accent"
          />
          <button 
            onClick={handleScrapePornstars}
            disabled={loading}
            className="text-xs font-black uppercase tracking-widest px-4 py-2 border-2 border-text-main text-text-main hover:bg-text-main hover:text-bg transition-colors"
          >
            {loading ? 'Scraping...' : 'Scrape Models'}
          </button>
        </div>
      )}

      {mode === 'pornstars' ? (
        <ul className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
          {pornstars.map((star, i) => (
            <li 
              key={i} 
              className="flex flex-col border border-text-muted p-2 hover:border-text-main transition-colors cursor-pointer"
              onClick={() => {
                 let targetUrl = star.url;
                 setUrl(targetUrl);
                 setMode('scrape');
                 handleExtract(targetUrl);
              }}
            >
              {star.thumbnail ? (
                <img src={star.thumbnail} alt={star.name} className="w-full aspect-[3/4] object-cover mb-2 bg-surface" />
              ) : (
                <div className="w-full aspect-[3/4] bg-surface flex items-center justify-center text-text-muted mb-2">
                  No Image
                </div>
              )}
              <h3 className="font-bold text-sm truncate" title={star.name}>{star.name}</h3>
              <p className="text-xs text-text-muted uppercase tracking-wider">{star.platform}</p>
            </li>
          ))}
          {pornstars.length === 0 && !loading && (
            <li className="col-span-full border-2 border-dashed border-text-muted text-text-muted p-8 text-center font-mono uppercase tracking-wider">
              No pornstars found in database. Search for videos to extract models, or use quick scrape.
            </li>
          )}
        </ul>
      ) : (
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {results.length > 0 ? (
          results.map((item: any, index) => {
            const hasDetails = postDetails[item.link]?.data;
            const thumbs = hasDetails?.thumbs || [];
            const currentThumb = (hoveredIndex?.index === index && thumbs.length > 0) 
              ? thumbs[hoveredIndex.thumbIndex]?.src 
              : item.thumbnail;

            return (
              <li 
                key={index} 
                className="group bg-surface border border-border rounded-xl flex flex-col overflow-hidden hover:border-accent hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
                onMouseEnter={() => thumbs.length > 0 && setHoveredIndex({ index, thumbIndex: 0 })}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {showThumbnails && (
                  <div className="aspect-video w-full overflow-hidden bg-bg relative">
                    {currentThumb ? (
                      <img 
                        src={`/api/proxy?url=${encodeURIComponent(currentThumb)}`} 
                        alt={item.title} 
                        key={currentThumb} // Re-mount to trigger transition if desired, or just swap src
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-500"
                        loading="lazy"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.image-placeholder') as HTMLElement;
                          if (placeholder) placeholder.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    {thumbs.length > 1 && hoveredIndex?.index === index && (
                      <div className="absolute bottom-2 right-2 bg-bg/80 text-accent px-1.5 py-0.5 text-[8px] font-mono rounded">
                        {hoveredIndex.thumbIndex + 1}/{thumbs.length}
                      </div>
                    )}
                    <div className={`image-placeholder absolute inset-0 flex items-center justify-center bg-bg/50 border-b border-text-muted/10 ${!currentThumb ? 'flex' : 'hidden'}`}>
                    <div className="flex flex-col items-center gap-2 opacity-20">
                      <div className="w-12 h-12 border-2 border-text-main rounded-full flex items-center justify-center">
                        <div className="w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[12px] border-l-text-main ml-1"></div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">No Preview</span>
                    </div>
                  </div>
                </div>
              )}
              <div className="p-5 flex flex-col justify-between flex-grow">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-base font-semibold leading-tight line-clamp-2 group-hover:text-accent transition-colors">{item.title}</h3>
                  </div>
                  
                  {/* Meta Details Row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isRelated && (
                        <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-medium">
                          Related
                        </span>
                      )}
                      {item.is_uploaded && (
                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-medium">
                          Uploaded
                        </span>
                      )}
                      {item.platform && (
                         <span className="text-[10px] bg-surface-hover text-text-main px-2 py-0.5 rounded-full font-medium capitalize">
                           {item.platform}
                         </span>
                      )}
                      {(item as any).views && (
                        <span className="text-[10px] bg-surface-hover text-text-muted px-2 py-0.5 rounded-full font-medium">
                          {(item as any).views} views
                        </span>
                      )}
                      {(item as any).tags && (
                        <span className="text-[10px] text-text-muted truncate max-w-[100px]">
                          {(item as any).tags}
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted truncate bg-surface-hover px-2 py-0.5 rounded-full">
                        {(() => {
                           try {
                             return new URL(item.link).hostname;
                           } catch (e) {
                             return item.link ? (item.link.startsWith('http') ? item.link.split('/')[2] : item.link) : 'Unknown';
                           }
                        })()}
                      </span>
                    </div>
                    
                    {postDetails[item.link]?.loading ? (
                      <span className="text-[10px] text-accent animate-pulse font-medium">Loading details...</span>
                    ) : postDetails[item.link]?.data ? (
                      <>
                        {postDetails[item.link].data.views && (
                          <span className="text-[10px] text-text-main flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded-full">
                            <span className="text-accent">👁</span> {postDetails[item.link].data.views}
                          </span>
                        )}
                        {postDetails[item.link].data.date && (
                          <span className="text-[10px] text-text-main flex items-center gap-1 bg-surface-hover px-2 py-0.5 rounded-full">
                            <span className="text-accent">🕒</span> {postDetails[item.link].data.date.split(' ')[0]}
                          </span>
                        )}
                      </>
                    ) : null}
                  </div>

                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="block text-accent text-xs hover:underline break-all opacity-70 hover:opacity-100 mb-4 truncate"
                  >
                    {item.link}
                  </a>

                  {/* Tags */}
                  {postDetails[item.link]?.data?.tags && postDetails[item.link].data.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-6">
                      {postDetails[item.link].data.tags.slice(0, 10).map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] bg-surface-hover px-2 py-1 rounded-md text-text-muted capitalize">
                          {tag}
                        </span>
                      ))}
                      {postDetails[item.link].data.tags.length > 10 && (
                        <span className="text-[10px] text-text-muted/50 px-1 py-1">+{postDetails[item.link].data.tags.length - 10}</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExtractDetails(item.link)}
                      className="flex-1 text-xs font-semibold bg-surface-hover hover:bg-accent hover:text-white text-text-main rounded-lg px-4 py-2 transition-all transform active:scale-95 text-center"
                    >
                      Extract Details
                    </button>
                  </div>
                  <button 
                    onClick={() => handleExtract(item.link)}
                    className="text-xs font-semibold border border-border rounded-lg text-text-muted px-4 py-2 hover:border-accent hover:text-accent transition-all text-center"
                  >
                    Scan Related
                  </button>
                </div>
              </div>
            </li>
          );
        })
      ) : (
          !loading && url && <div className="col-span-full text-text-muted text-center py-20 border-2 border-dashed border-text-muted/20">
            <div className="text-4xl mb-4">∅</div>
            <div className="uppercase tracking-[0.3em] font-black text-sm">No results detected</div>
          </div>
        )}
      </ul>
      )}

      {/* Pagination UI */}
      {mode !== 'pornstars' && mode !== 'scrape' && results.length > 0 && (
        <div className="flex justify-center items-center gap-6 mt-12 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={() => {
              const prevPage = Math.max(1, searchPage - 1);
              setSearchPage(prevPage);
              handleExtract(undefined, prevPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={loading || searchPage === 1}
            className={`min-w-[120px] text-xs font-black uppercase tracking-[0.2em] px-6 py-3 border-2 transition-all ${searchPage === 1 ? 'border-text-muted/20 text-text-muted/40 cursor-not-allowed' : 'border-text-main text-text-main hover:bg-text-main hover:text-bg active:scale-95'}`}
          >
            ← Previous
          </button>
          
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest mb-1">Page</span>
            <span className="text-xl font-black font-mono text-accent">{searchPage}</span>
          </div>

          <button
            onClick={() => {
              const nextPage = searchPage + 1;
              setSearchPage(nextPage);
              handleExtract(undefined, nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={loading}
            className="min-w-[120px] text-xs font-black uppercase tracking-[0.2em] px-6 py-3 border-2 border-text-main text-text-main hover:bg-text-main hover:text-bg active:scale-95 transition-all"
          >
            Next →
          </button>
        </div>
      )}

      {detailsModal.isOpen && (
        <div className="fixed inset-0 bg-bg/90 flex items-center justify-center p-4 sm:p-10 z-50">
          <div className="bg-surface border-4 border-accent p-5 sm:p-10 max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-y-auto relative">
            <button 
              onClick={() => setDetailsModal({ ...detailsModal, isOpen: false })}
              className="absolute top-3 right-3 sm:top-5 sm:right-5 text-text-muted hover:text-accent font-black text-xl"
            >
              X
            </button>
            <h2 className="text-2xl sm:text-3xl font-black uppercase mb-4 sm:mb-6 border-b-2 border-text-muted pb-4 pr-6">Post Details</h2>
            
            {detailsModal.loading ? (
              <div className="text-accent font-mono animate-pulse">Extracting metadata...</div>
            ) : detailsModal.data?.error ? (
              <div className="text-red-500 font-mono">{detailsModal.data.error}</div>
            ) : detailsModal.data ? (
              <div className="space-y-6 font-mono text-sm">
                {detailsModal.data.previewImage && (
                  <div className="mb-6 w-full max-h-64 overflow-hidden bg-bg border-2 border-text-muted">
                    <img 
                      src={`/api/proxy?url=${encodeURIComponent(detailsModal.data.previewImage)}`} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div>
                  <strong className="text-accent uppercase tracking-widest block mb-1">URL:</strong>
                  <a href={detailsModal.url} target="_blank" rel="noreferrer" className="text-text-main hover:underline break-all">{detailsModal.url}</a>
                </div>
                {detailsModal.data.thumbnail && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Thumbnail (og:image):</strong>
                    <a href={detailsModal.data.thumbnail} target="_blank" rel="noreferrer" className="text-text-main hover:underline break-all">{detailsModal.data.thumbnail}</a>
                  </div>
                )}
                {detailsModal.data.fallback_thumbnail && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Fallback Thumbnail (twitter:image):</strong>
                    <a href={detailsModal.data.fallback_thumbnail} target="_blank" rel="noreferrer" className="text-text-main hover:underline break-all">{detailsModal.data.fallback_thumbnail}</a>
                  </div>
                )}
                {detailsModal.data.description && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Description:</strong>
                    <p className="text-text-muted">{detailsModal.data.description}</p>
                  </div>
                )}
                {detailsModal.data.author && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Author:</strong>
                    <p className="text-text-main">{detailsModal.data.author}</p>
                  </div>
                )}
                {detailsModal.data.date && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Published:</strong>
                    <p className="text-text-main">{detailsModal.data.date}</p>
                  </div>
                )}
                {detailsModal.data.pornstars && detailsModal.data.pornstars.length > 0 && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-2">Models:</strong>
                    <div className="flex flex-wrap gap-2">
                      {detailsModal.data.pornstars.map((star: any, i: number) => (
                        <a key={i} href={star.url} target="_blank" rel="noreferrer" className="px-2 py-1 bg-surface border border-text-muted text-xs hover:border-accent hover:text-accent transition-colors">
                          {star.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {detailsModal.data.views && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-1">Views:</strong>
                    <p className="text-text-main">{detailsModal.data.views}</p>
                  </div>
                )}
                {detailsModal.data.tags && detailsModal.data.tags.length > 0 && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-2">Tags:</strong>
                    <div className="flex flex-wrap gap-2">
                      {detailsModal.data.tags.map((tag: string, i: number) => (
                        <span key={i} className="border border-text-muted px-2 py-1 text-[10px] uppercase tracking-widest">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {detailsModal.data.thumbs && detailsModal.data.thumbs.length > 0 && (
                  <div>
                    <strong className="text-accent uppercase tracking-widest block mb-4">Thumbnail Gallery:</strong>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {detailsModal.data.thumbs.map((thumb: any, i: number) => (
                        <div key={i} className="aspect-video bg-bg border border-text-muted/20 overflow-hidden cursor-pointer hover:border-accent transition-colors">
                          <img 
                            src={`/api/proxy?url=${encodeURIComponent(thumb.src)}`} 
                            alt={`Thumb ${i}`} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
    </main>
    </div>
  );
}

