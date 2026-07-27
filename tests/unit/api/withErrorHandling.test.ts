/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { withErrorHandling } from "@/lib/api/withErrorHandling";
import { RepositoryError } from "@/lib/repositories/base.repository";
import { ZodError, z } from "zod";

describe("withErrorHandling", () => {
  it("passes through successful responses", async () => {
    const handler = withErrorHandling(async () => Response.json({ data: "ok" }, { status: 200 }));
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(200);
  });

  it("maps RepositoryError NOT_FOUND to 404", async () => {
    const handler = withErrorHandling(async () => {
      throw new RepositoryError("NOT_FOUND", "Thing not found");
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(404);
  });

  it("maps RepositoryError DUPLICATE to 409", async () => {
    const handler = withErrorHandling(async () => {
      throw new RepositoryError("DUPLICATE", "Already exists");
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(409);
  });

  it("maps StatusGuardError (by name) to 409", async () => {
    const handler = withErrorHandling(async () => {
      const err = new Error("Action not allowed");
      err.name = "StatusGuardError";
      throw err;
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(409);
  });

  it("maps ZodError to 400", async () => {
    const handler = withErrorHandling(async () => {
      z.string().parse(123);
      return Response.json({});
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(400);
  });

  it("maps unknown errors to 500", async () => {
    const handler = withErrorHandling(async () => {
      throw new Error("Something unexpected");
    });
    const res = await handler(new Request("http://localhost/api/test"));
    expect(res.status).toBe(500);
  });
});
