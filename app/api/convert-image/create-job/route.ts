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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const cors = getCorsHeaders(request);

  try {
    const { ext } = (await request.json()) as { ext?: string };
    const inputFormat = ext?.toLowerCase();

    if (!inputFormat || !['ai', 'psd'].includes(inputFormat)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only AI and PSD files are supported.' },
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

    const jobConfig: any = {
      tasks: {
        'upload-file': { operation: 'import/upload' },
        'convert-file': {
          operation: 'convert',
          input: 'upload-file',
          input_format: inputFormat,
          output_format: 'png',
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      },
    };

    if (inputFormat === 'psd') {
      jobConfig.tasks['convert-file'].flatten = true;
    }

    // AI files are PDF containers; routing through an explicit AI→PDF→PNG
    // chain is far more reliable than asking CloudConvert to go ai→png in one
    // hop, which often hangs or yields an empty export.
    if (inputFormat === 'ai') {
      jobConfig.tasks = {
        'upload-file': { operation: 'import/upload' },
        'convert-to-pdf': {
          operation: 'convert',
          input: 'upload-file',
          input_format: 'ai',
          output_format: 'pdf',
        },
        'convert-file': {
          operation: 'convert',
          input: 'convert-to-pdf',
          input_format: 'pdf',
          output_format: 'png',
          pixel_density: 150,
          alpha: true,
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      };
    }

    let job;
    try {
      job = await cloudConvert.jobs.create(jobConfig);
    } catch (createError: any) {
      console.error('CloudConvert job creation failed:', createError);
      return NextResponse.json(
        {
          success: false,
          error: `CloudConvert job creation failed: ${createError.message || 'Unknown error'}`,
          details: createError.response?.data || null,
        },
        { status: 422, headers: cors }
      );
    }

    const uploadTask = job.tasks?.find((t) => t.name === 'upload-file');
    if (!uploadTask || !uploadTask.result?.form) {
      return NextResponse.json(
        { success: false, error: 'Upload task form missing in job response' },
        { status: 500, headers: cors }
      );
    }

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        uploadForm: {
          url: uploadTask.result.form.url,
          parameters: uploadTask.result.form.parameters,
        },
      },
      { headers: cors }
    );
  } catch (error) {
    console.error('create-job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500, headers: cors }
    );
  }
}
