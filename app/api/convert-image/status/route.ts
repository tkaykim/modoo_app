import { NextRequest, NextResponse } from 'next/server';
import CloudConvert from 'cloudconvert';

const ALLOWED_ORIGINS = [
  'https://modoouniform.com',
  'https://admin.modoogoods.com',
  'http://localhost:3000',
  'http://localhost:3001',
];

function getCorsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.vercel.app');
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function GET(request: NextRequest) {
  const cors = getCorsHeaders(request);

  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json(
        { success: false, error: 'jobId is required' },
        { status: 400, headers: cors }
      );
    }

    const apiKey = process.env.CLOUDCONVERT_API_KEY || process.env.NEXT_PUBLIC_CLOUDCONVERT_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'CloudConvert API key is not configured' },
        { status: 500, headers: cors }
      );
    }

    const cloudConvert = new CloudConvert(apiKey);
    const job = await cloudConvert.jobs.get(jobId);

    if (job.status === 'finished') {
      const exportTask = job.tasks?.find(
        (t) => t.name === 'export-file' && t.status === 'finished'
      );
      const pngUrl = exportTask?.result?.files?.[0]?.url;

      if (!pngUrl) {
        return NextResponse.json(
          { success: false, status: 'error', error: 'Export URL not found' },
          { status: 500, headers: cors }
        );
      }

      return NextResponse.json(
        { success: true, status: 'finished', pngUrl },
        { headers: cors }
      );
    }

    if (job.status === 'error') {
      const failed = job.tasks?.find((t) => t.status === 'error');
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: failed?.message || 'Job failed',
          code: failed?.code || null,
        },
        { status: 200, headers: cors }
      );
    }

    // CloudConvert sometimes leaves individual tasks in 'error'/'cancelled'
    // while the job stays in 'waiting'/'processing'. Surface that as an error
    // immediately instead of polling until the 3-minute client timeout.
    const failedTask = job.tasks?.find((t) =>
      ['error', 'cancelled'].includes(t.status as string)
    );
    if (failedTask) {
      return NextResponse.json(
        {
          success: false,
          status: 'error',
          error: failedTask.message || `Task ${failedTask.name} failed`,
          code: failedTask.code || null,
        },
        { headers: cors }
      );
    }

    return NextResponse.json(
      { success: true, status: 'processing', jobStatus: job.status },
      { headers: cors }
    );
  } catch (error) {
    console.error('status error:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: cors }
    );
  }
}
