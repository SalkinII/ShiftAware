import { NextResponse } from "next/server";
import { verifyLogin, createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
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
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    // Create session with appropriate role
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
