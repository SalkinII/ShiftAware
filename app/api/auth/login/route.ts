import { NextResponse } from "next/server";
import { verifyLogin, createSession } from "@/lib/auth";
import { loginRateLimiter } from "@/lib/rate-limit";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

export async function POST(request: Request) {
  try {
    const clientIp = getClientIp(request);
    const rateCheck = loginRateLimiter.check(clientIp);

    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: "Too many login attempts. Please try again later.",
          code: "RATE_LIMITED",
          retryAfter: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body as { password?: string };

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 },
      );
    }

    const result = await verifyLogin(password);

    if (!result.valid) {
      loginRateLimiter.recordFailure(clientIp);
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    loginRateLimiter.reset(clientIp);
    await createSession(result.isAdmin);
    return NextResponse.json({
      success: true,
      isAdmin: result.isAdmin,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
