'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { LogEntry } from '@/types/log';
import { format } from 'date-fns';

const ALL_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'CONNECT'] as const;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const normalizeSearch = (s: string) => s.toLowerCase().replace(/\//g, '%2f');

interface RequestListProps {
  logs: LogEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNavigate: (params: { q?: string[]; start?: string; end?: string; methods?: string[]; fav?: boolean }) => void;
  favorites: Set<string>;
  serverQ: string[];
  initialQ?: string[];
  initialStart?: string;
  initialEnd?: string;
  initialFav?: boolean;
  initialMethods?: string[];
  isPending?: boolean;
}

export default function RequestList({
  logs,
  selectedId,
  onSelect,
  onNavigate,
  favorites,
  serverQ,
  initialQ = [],
  initialStart = '',
  initialEnd = '',
  initialFav = false,
  initialMethods = [],
  isPending = false,
}: RequestListProps) {
  const [searchTerms, setSearchTerms] = useState<string[]>(initialQ.length > 0 ? initialQ : ['']);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [showFavOnly, setShowFavOnly] = useState(initialFav);
  const [selectedMethods, setSelectedMethods] = useState<Set<string>>(new Set(initialMethods));
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Helper to serialize filter state uniformly
  const serializeFilters = (q: string[], start: string, end: string, methods: string[], fav: boolean) => {
    const validQ = q.filter(Boolean);
    return JSON.stringify({
      q: validQ.length > 0 ? validQ : [''],
      start,
      end,
      methods: Array.from(methods).sort(),
      fav
    });
  };

  const filtersState = serializeFilters(searchTerms, startDate, endDate, Array.from(selectedMethods), showFavOnly);
  const debouncedFiltersState = useDebounce(filtersState, 800);
  const lastPushedFilters = useRef<string | null>(null);

  // 1. Sync OUT to URL on user interaction (debounced)
  const prevDebouncedFilters = useRef(debouncedFiltersState);
  useEffect(() => {
    if (prevDebouncedFilters.current === debouncedFiltersState) return;
    prevDebouncedFilters.current = debouncedFiltersState;
    
    lastPushedFilters.current = debouncedFiltersState;
    
    const parsed = JSON.parse(debouncedFiltersState);
    const terms: string[] = parsed.q.filter(Boolean);
    
    onNavigate({
      q: terms.length > 0 ? terms : undefined,
      start: parsed.start || undefined,
      end: parsed.end || undefined,
      methods: parsed.methods.length > 0 ? parsed.methods : undefined,
      fav: parsed.fav || undefined
    });
  }, [debouncedFiltersState, onNavigate]);

  // 2. Sync IN from URL (e.g. Back/Forward button, initial mount, or folder change)
  useEffect(() => {
    const incomingStateStr = serializeFilters(initialQ, initialStart, initialEnd, initialMethods, initialFav);

    if (lastPushedFilters.current !== null && incomingStateStr === lastPushedFilters.current) {
      // This URL change is simply the echo of our last explicitly initiated onNavigate. Ignore to avoid focus jumps/overwrites.
      return;
    }

    setSearchTerms(initialQ.length > 0 ? initialQ : ['']);
    setStartDate(initialStart);
    setEndDate(initialEnd);
    setSelectedMethods(new Set(initialMethods));
    setShowFavOnly(initialFav);
    
    lastPushedFilters.current = incomingStateStr;
    prevDebouncedFilters.current = incomingStateStr;
  }, [initialQ, initialStart, initialEnd, initialMethods, initialFav]);

  // Search term helpers
  const updateTerm = (index: number, value: string) => {
    setSearchTerms(prev => prev.map((t, i) => i === index ? value : t));
  };
  const addTerm = () => {
    setSearchTerms(prev => [...prev, '']);
  };
  const removeTerm = (index: number) => {
    setSearchTerms(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [''] : next;
    });
  };

  // Available methods for pills
  const availableMethods = useMemo(() => {
    const methods = new Set(logs.map(l => l.method));
    return ALL_METHODS.filter(m => methods.has(m));
  }, [logs]);

  const toggleMethod = (method: string) => {
    setSelectedMethods(prev => {
      const next = new Set(prev);
      next.has(method) ? next.delete(method) : next.add(method);
      return next;
    });
  };

  // Client-side filtering
  const filteredLogs = useMemo(() => {
    const activeTerms = searchTerms.filter(Boolean);
    return logs.filter((log) => {
      if (showFavOnly && !favorites.has(log.id)) return false;
      if (selectedMethods.size > 0 && !selectedMethods.has(log.method)) return false;
      if (activeTerms.length > 0) {
        // Check if we can filter client-side (all terms refine server terms)
        const isRefinement = activeTerms.every(term =>
          serverQ.length === 0 || serverQ.some(sq => normalizeSearch(term).includes(normalizeSearch(sq)))
        );
        if (isRefinement) {
          // OR match: entry must match at least one search term
          const dirLower = log.directory.toLowerCase();
          const matched = activeTerms.some(term => dirLower.includes(normalizeSearch(term)));
          if (!matched) return false;
        }
        // If not a refinement, server navigation is pending — show all current data
      }
      return true;
    });
  }, [logs, searchTerms, showFavOnly, favorites, selectedMethods, serverQ]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedId && selectedRef.current) {
      selectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedId]);

  return (
    <div className="flex flex-col h-full">
      {/* Filter Section */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 space-y-2">
        {/* Search terms */}
        <div className="space-y-1">
          {searchTerms.map((term, idx) => (
            <div key={idx} className="flex gap-1">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={idx === 0 ? 'Search path...' : 'OR path...'}
                  value={term}
                  onChange={(e) => updateTerm(idx, e.target.value)}
                  className="w-full px-3 py-1.5 pr-7 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
                />
                {term && (
                  <button
                    type="button"
                    onClick={() => updateTerm(idx, '')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                  >
                    &#x2715;
                  </button>
                )}
              </div>
              {searchTerms.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTerm(idx)}
                  className="px-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 text-sm shrink-0"
                  title="Remove"
                >
                  &minus;
                </button>
              )}
              {idx === searchTerms.length - 1 && (
                <button
                  type="button"
                  onClick={addTerm}
                  className="px-1.5 text-gray-400 hover:text-green-600 dark:hover:text-green-400 text-sm shrink-0"
                  title="Add search term"
                >
                  +
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Method pills */}
        {availableMethods.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {availableMethods.map(method => (
              <button
                key={method}
                type="button"
                onClick={() => toggleMethod(method)}
                className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                  selectedMethods.has(method)
                    ? method === 'GET'
                      ? 'bg-green-600 text-white border-green-600'
                      : method === 'POST'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : method === 'PUT' || method === 'PATCH'
                      ? 'bg-yellow-600 text-white border-yellow-600'
                      : method === 'DELETE'
                      ? 'bg-red-600 text-white border-red-600'
                      : 'bg-gray-600 text-white border-gray-600'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        )}

        {/* Time filters */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Start</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">End</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-xs"
            />
          </div>
        </div>

        {/* Favorites + status */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showFavOnly}
              onChange={(e) => setShowFavOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-yellow-500 focus:ring-yellow-500"
            />
            <span>&#9733; Favorites</span>
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {filteredLogs.length !== logs.length
              ? `${filteredLogs.length} / ${logs.length}`
              : logs.length}
            {isPending && ' ...'}
          </span>
        </div>
      </div>

      {/* Request List */}
      <div className="flex-1 overflow-y-auto">
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No requests found
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredLogs.map((log) => (
              <button
                key={log.id}
                ref={selectedId === log.id ? selectedRef : null}
                onClick={() => onSelect(log.id)}
                className={`w-full text-left px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedId === log.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  {favorites.has(log.id) && (
                    <span className="text-yellow-500 text-xs">&#9733;</span>
                  )}
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0 rounded text-xs font-medium ${
                      log.method === 'GET'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : log.method === 'POST'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : log.method === 'PUT'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : log.method === 'DELETE'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}
                  >
                    {log.method}
                  </span>
                </div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                  {log.path ? '/' + (() => { try { return decodeURIComponent(log.path); } catch { return log.path; } })() : '/'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
