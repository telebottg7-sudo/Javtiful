import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Globe, Search, Star, Database, Filter, Layers, LayoutGrid } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  mode: string;
  setMode: (mode: any) => void;
  fetchPornstars: () => void;
  handleExtract: (url: string) => void;
}

export default function Sidebar({ isOpen, setIsOpen, mode, setMode, fetchPornstars, handleExtract }: SidebarProps) {
  const menuItems = [
    { id: 'scrape', label: 'Scrape URL', icon: Globe },
    { id: 'bulk_scrape', label: 'Bulk Scrape', icon: Layers },
    { id: 'search_javtiful', label: 'Javtiful', icon: Search },
    { id: 'pornstars', label: 'Pornstars', icon: Star },
    { id: 'database', label: 'Saved Videos', icon: Database },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border text-text-main rounded-lg shadow-md"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="lg:hidden fixed inset-0 bg-bg/80 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Container */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: isOpen ? 0 : -300,
          width: isOpen ? 280 : 0
        }}
        className="fixed lg:static inset-y-0 left-0 z-40 bg-surface border-r border-border flex flex-col h-full overflow-hidden shadow-xl lg:shadow-none"
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-accent p-2 rounded-xl">
              <Layers className="text-white" size={24} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Extractor</h2>
          </div>
          <button onClick={() => setIsOpen(false)} className="lg:hidden text-text-muted hover:text-text-main">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-grow py-6 px-3 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = mode === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'pornstars') {
                    setMode('pornstars');
                    fetchPornstars();
                  } else if (item.id === 'database') {
                    setMode('database');
                    handleExtract("");
                  } else {
                    setMode(item.id as any);
                  }
                  if (window.innerWidth < 1024) setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 font-medium text-sm rounded-lg transition-all ${
                  isActive 
                    ? 'bg-accent/10 text-accent' 
                    : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-accent' : 'text-text-muted'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border bg-surface-hover">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-text-muted">Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
              <span className="text-xs text-text-main font-medium">Database Connected</span>
            </div>
          </div>
        </div>
      </motion.aside>
    </>
  );
}
