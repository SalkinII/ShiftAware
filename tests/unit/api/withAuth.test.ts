/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { withAuth } from "@/lib/api/withAuth";

vi.mock("@/lib/auth", () => ({
  isAuthenticated: vi.fn(),
}));

describe("withAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(false);
    const handler = withAuth(async () => Response.json({ data: "ok" }, { status: 200 }));
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("calls through to handler when authenticated", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    const handler = withAuth(async () => Response.json({ data: "ok" }, { status: 200 }));
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(200);
  });

  it("passes request and context to handler", async () => {
    const { isAuthenticated } = await import("@/lib/auth");
    vi.mocked(isAuthenticated).mockResolvedValue(true);
    let capturedReq: Request | undefined;
    const handler = withAuth(async (req) => {
      capturedReq = req;
      return Response.json({ data: "ok" });
    });
    const req = new Request("http://localhost/api/test");
    await handler(req);
    expect(capturedReq).toBe(req);
  });
});
