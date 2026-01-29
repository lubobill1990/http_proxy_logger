'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RequestList from '@/components/RequestList';
import RequestDetail from '@/components/RequestDetail';
import { LogEntry, LogDetail } from '@/types/log';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<LogDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    };

    checkDarkMode();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => mediaQuery.removeEventListener('change', checkDarkMode);
  }, []);

  const fetchLogs = async (startTime?: number, endTime?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startTime) params.append('startTime', startTime.toString());
      if (endTime) params.append('endTime', endTime.toString());

      const response = await fetch(`/api/logs?${params.toString()}`);
      const data = await response.json();
      setLogs(data);
      return data;
    } catch (error) {
      console.error('Error fetching logs:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchLogDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/logs/${id}`);
      const data = await response.json();
      setSelectedLog(data);
    } catch (error) {
      console.error('Error fetching log detail:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // Load initial logs and restore selected item from URL
  useEffect(() => {
    const loadInitialData = async () => {
      const loadedLogs = await fetchLogs();

      // Check if there's a selected log in the URL
      const logId = searchParams.get('log');
      if (logId && loadedLogs.length > 0) {
        // Verify the log exists in the loaded logs
        const logExists = loadedLogs.some((log: LogEntry) => log.id === logId);
        if (logExists) {
          setSelectedId(logId);
          fetchLogDetail(logId);
        }
      }
    };

    loadInitialData();
  }, []);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    fetchLogDetail(id);

    // Update URL with selected log
    const params = new URLSearchParams(window.location.search);
    params.set('log', id);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleFilterChange = (startTime?: number, endTime?: number) => {
    setSelectedId(undefined);
    setSelectedLog(null);

    // Clear log selection from URL
    const params = new URLSearchParams();
    if (startTime) params.append('startTime', startTime.toString());
    if (endTime) params.append('endTime', endTime.toString());

    router.push(params.toString() ? `?${params.toString()}` : '/', { scroll: false });
    fetchLogs(startTime, endTime);
  };

  return (
    <main className="flex h-screen bg-white dark:bg-gray-900">
      {/* Left Panel - Request List */}
      <div className="w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            HTTP Proxy Logs
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {logs.length} requests
          </p>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        ) : (
          <RequestList
            logs={logs}
            selectedId={selectedId}
            onSelect={handleSelect}
            onFilterChange={handleFilterChange}
          />
        )}
      </div>

      {/* Right Panel - Request Detail */}
      <div className="flex-1 flex flex-col">
        {detailLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading details...
          </div>
        ) : (
          <RequestDetail log={selectedLog} isDark={isDark} />
        )}
      </div>
    </main>
  );
}
