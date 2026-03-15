import { getLogDetail, getLogDirs } from '@/lib/logs';
import LlmCallDetail from '@/components/LlmCallDetail';

export default async function LlmPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [minuteDir, requestDir] = id;
  const dir = typeof query.dir === 'string' ? query.dir : undefined;

  if (!minuteDir || !requestDir) {
    return <div className="p-8 text-red-500">Invalid log ID</div>;
  }

  try {
    const detail = await getLogDetail(minuteDir, requestDir, dir);
    return <LlmCallDetail log={detail} dir={dir} />;
  } catch (error) {
    return <div className="p-8 text-red-500">Failed to load log detail: {String(error)}</div>;
  }
}
