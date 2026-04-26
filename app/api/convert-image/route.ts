import { NextRequest, NextResponse } from 'next/server';

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      error:
        'This endpoint has been replaced. Use /api/convert-image/create-job and /api/convert-image/status.',
    },
    { status: 410, headers: getCorsHeaders(request) }
  );
}
