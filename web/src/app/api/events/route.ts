import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { eventBus } from "@/lib/events";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // SSE is authenticated: every subscriber must present a session/Bearer token.
  // Events carry a userId envelope and clients ignore other users' events, so a
  // shared in-process bus cannot leak one user's ledger into another session.
  // Note: the in-memory bus only fans out within this server instance; use
  // polling/revalidation for multi-instance Workers until a real pub/sub exists.
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = auth.userId;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ time: Date.now(), userId })}\n\n`));

      const unsubscribe = eventBus.subscribe((event) => {
        try {
          const data = event.data as any;
          // Only forward this user's events (plus connection keepalives).
          if (data && typeof data === "object" && "userId" in data && (data as any).userId !== userId) {
            return;
          }
          const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch (_: unknown) {
          // Controller might be closed
        }
      });

      // Keepalive heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch (_: unknown) {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch (_: unknown) {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
