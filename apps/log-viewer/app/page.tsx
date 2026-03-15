import { Suspense } from 'react';
import { getLogDirs, getLogEntries } from '@/lib/logs';
import HomeClient from '@/components/HomeClient';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const logDirs = getLogDirs();

  // Resolve dir
  const dirParam = typeof params.dir === 'string' ? params.dir : undefined;
  const currentDir = dirParam && logDirs.some(d => d.name === dirParam) ? dirParam : logDirs[0]?.name || '';

  // Parse time filters
  const startStr = typeof params.start === 'string' ? params.start : undefined;
  const endStr = typeof params.end === 'string' ? params.end : undefined;
  const startTime = startStr ? new Date(startStr).getTime() : undefined;
  const endTime = endStr ? new Date(endStr).getTime() : undefined;

  // Parse search (supports multiple q params)
  const qRaw = params.q;
  const qArray = Array.isArray(qRaw) ? qRaw.filter(Boolean) : typeof qRaw === 'string' && qRaw ? [qRaw] : [];

  // Fetch logs on the server
  const logs = await getLogEntries(
    isNaN(startTime as number) ? undefined : startTime,
    isNaN(endTime as number) ? undefined : endTime,
    currentDir,
    qArray.length > 0 ? qArray : undefined,
  );

  return (
    <Suspense>
      <HomeClient
        logDirs={logDirs}
        initialLogs={logs}
        initialDir={currentDir}
        serverQ={qArray}
      />
    </Suspense>
  );
}

