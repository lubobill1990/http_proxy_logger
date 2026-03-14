import { NextRequest, NextResponse } from 'next/server';
import { getLogDetail } from '@/lib/logs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string[] }> }
) {
  const params = await context.params;
  const [minuteDir, requestDir] = params.id;
  const dir = request.nextUrl.searchParams.get('dir') || undefined;

  if (!minuteDir || !requestDir) {
    return NextResponse.json(
      { error: 'Invalid log ID' },
      { status: 400 }
    );
  }

  try {
    const detail = await getLogDetail(minuteDir, requestDir, dir);
    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching log detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch log detail' },
      { status: 500 }
    );
  }
}
