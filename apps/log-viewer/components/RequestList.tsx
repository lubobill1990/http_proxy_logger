'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { LogEntry } from '@/types/log';
import { format } from 'date-fns';

interface RequestListProps {
  logs: LogEntry[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onFilterChange: (startTime: number | undefined, endTime: number | undefined) => void;
}

export default function RequestList({
  logs,
  selectedId,
  onSelect,
  onFilterChange,
}: RequestListProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const selectedRef = useRef<HTMLButtonElement>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          log.method.toLowerCase().includes(searchLower) ||
          log.path.toLowerCase().includes(searchLower)
        );
      }
      return true;
    });
  }, [logs, searchTerm]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (selectedId && selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedId]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const start = startDate ? new Date(startDate).getTime() : undefined;
    const end = endDate ? new Date(endDate).getTime() : undefined;
    onFilterChange(start, end);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    onFilterChange(undefined, undefined);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Section */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <form onSubmit={handleFilterSubmit} className="space-y-3">
          <div>
            <input
              type="text"
              placeholder="Search by method or path..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              Start Time
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
              End Time
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleClearFilter}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-600 text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </form>
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
                className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  selectedId === log.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
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
                  {log.responseMetadata && (
                    <span
                      className={`text-xs font-medium ${
                        log.responseMetadata.statusCode >= 200 &&
                        log.responseMetadata.statusCode < 300
                          ? 'text-green-600 dark:text-green-400'
                          : log.responseMetadata.statusCode >= 400
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {log.responseMetadata.statusCode}
                    </span>
                  )}
                </div>
                <div className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate mb-1">
                  {log.path || '/'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
