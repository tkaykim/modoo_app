import { NextRequest, NextResponse } from 'next/server';
import { reportError } from '@/lib/notifications/error-mail';

// Wrap an App Router route handler so that any thrown error is automatically
// reported to /lib/notifications/error-mail before returning a 500.
//
// Usage:
//   export const POST = withErrorReporting(async (req) => { ... });
//
// The wrapper preserves the original handler's signature and never swallows
// the user-visible response — it only adds reporting.
type RouteHandler<C> = (req: NextRequest, ctx: C) => Promise<Response> | Response;

export function withErrorReporting<C = unknown>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      // Fire-and-forget — do not delay the 500 response on email.
      reportError({
        message: `[API 500] ${message}`,
        stack,
        url: req.url,
        userAgent: req.headers.get('user-agent') || undefined,
        source: 'api',
        context: { method: req.method },
      }).catch((reportErr) => {
        console.error('[with-error-reporting] reportError failed:', reportErr);
      });

      console.error(`[API 500] ${req.method} ${req.url}:`, err);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}
