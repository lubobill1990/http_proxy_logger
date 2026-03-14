'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RequestList from '@/components/RequestList';
import RequestDetail from '@/components/RequestDetail';
import { LogEntry, LogDetail } from '@/types/log';

interface LogDir {
  name: string;
  path: string;
}

// Favorites stored in localStorage keyed by dir name
function getFavorites(dir: string): Set<string> {
  try {
    const raw = localStorage.getItem(`favorites:${dir}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveFavorites(dir: string, favs: Set<string>) {
  localStorage.setItem(`favorites:${dir}`, JSON.stringify([...favs]));
}

interface HomeClientProps {
  logDirs: LogDir[];
  initialLogs: LogEntry[];
  initialDir: string;
  serverQ: string;
}

export default function HomeClient({ logDirs, initialLogs, initialDir, serverQ }: HomeClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const currentDir = initialDir;

  // Read filter state from URL for initial values
  const urlQ = searchParams.get('q') || '';
  const urlStart = searchParams.get('start') || '';
  const urlEnd = searchParams.get('end') || '';
  const urlFav = searchParams.get('fav') === '1';
  const urlMethods = searchParams.get('methods')?.split(',').filter(Boolean) || [];

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    };
    checkDarkMode();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', checkDarkMode);
    return () => mq.removeEventListener('change', checkDarkMode);
  }, []);

  const fetchLogDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentDir) params.append('dir', currentDir);
      const encodedId = id.split('/').map(encodeURIComponent).join('/');
      const response = await fetch(`/api/logs/${encodedId}?${params.toString()}`);
      if (!response.ok) {
        console.error('API error:', response.status, await response.text());
        return;
      }
      setSelectedLog(await response.json());
    } catch (error) {
      console.error('Error fetching log detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Load favorites when dir changes
  useEffect(() => {
    if (currentDir) setFavorites(getFavorites(currentDir));
  }, [currentDir]);

  // Auto-load detail if ?log= is in URL on initial mount
  useEffect(() => {
    const logId = searchParams.get('log');
    if (logId && initialLogs.some(l => l.id === logId)) {
      setSelectedId(logId);
      fetchLogDetail(logId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (id: string) => {
    setSelectedId(id);
    fetchLogDetail(id);
    // Update URL without triggering server re-render
    const params = new URLSearchParams(window.location.search);
    params.set('log', id);
    window.history.replaceState(null, '', `?${params.toString()}`);
  };

  // Navigate: triggers server re-render for new data
  const handleNavigate = useCallback((navParams: { q?: string; start?: string; end?: string }) => {
    setSelectedId(undefined);
    setSelectedLog(null);
    const urlParams = new URLSearchParams();
    if (currentDir) urlParams.set('dir', currentDir);
    if (navParams.q) urlParams.set('q', navParams.q);
    if (navParams.start) urlParams.set('start', navParams.start);
    if (navParams.end) urlParams.set('end', navParams.end);
    startTransition(() => {
      router.push(urlParams.toString() ? `?${urlParams.toString()}` : '/', { scroll: false });
    });
  }, [currentDir, router, startTransition]);

  const handleDirChange = (dirName: string) => {
    setSelectedId(undefined);
    setSelectedLog(null);
    startTransition(() => {
      router.push(`?dir=${dirName}`, { scroll: false });
    });
  };

  const handleToggleFavorite = (logId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(logId) ? next.delete(logId) : next.add(logId);
      saveFavorites(currentDir, next);
      return next;
    });
  };

  return (
    <main className="flex h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* Left Panel - Request List */}
      <div className="w-96 shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            HTTP Proxy Logs
          </h1>
          {logDirs.length > 1 && (
            <select
              value={currentDir}
              onChange={(e) => handleDirChange(e.target.value)}
              className="mt-2 w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {logDirs.map((dir) => (
                <option key={dir.name} value={dir.name}>{dir.name}</option>
              ))}
            </select>
          )}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {initialLogs.length} requests
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <RequestList
            logs={initialLogs}
            selectedId={selectedId}
            onSelect={handleSelect}
            onNavigate={handleNavigate}
            favorites={favorites}
            serverQ={serverQ}
            initialQ={urlQ}
            initialStart={urlStart}
            initialEnd={urlEnd}
            initialFav={urlFav}
            initialMethods={urlMethods}
            isPending={isPending}
          />
        </div>
      </div>

      {/* Right Panel - Request Detail */}
      <div className="flex-1 min-w-0 flex flex-col">
        {detailLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading details...
          </div>
        ) : (
          <RequestDetail
            log={selectedLog}
            isDark={isDark}
            isFavorite={selectedId ? favorites.has(selectedId) : false}
            onToggleFavorite={selectedId ? () => handleToggleFavorite(selectedId) : undefined}
          />
        )}
      </div>
    </main>
  );
}
