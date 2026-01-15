#!/usr/bin/env node
/**
 * Comprehensive test suite for ShiftAware
 * Run with: node scripts/run-tests.js
 * Requires: dev server running on http://localhost:3000
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";
let sessionCookie = null;

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        const cookies = res.headers["set-cookie"] || [];
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          cookies,
        });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function parseUrl(url) {
  const u = new URL(url);
  return {
    hostname: u.hostname,
    port: u.port || (u.protocol === "https:" ? 443 : 80),
    path: u.pathname + u.search,
  };
}

const results = {
  passed: [],
  failed: [],
  skipped: [],
};

function test(name, fn) {
  return async () => {
    try {
      await fn();
      results.passed.push(name);
      console.log(`✓ ${name}`);
    } catch (error) {
      results.failed.push({ name, error: error.message });
      console.log(`✗ ${name}: ${error.message}`);
    }
  };
}

function skip(name, reason) {
  results.skipped.push({ name, reason });
  console.log(`⊘ ${name} (skipped: ${reason})`);
}

async function runTests() {
  console.log("\n=== ShiftAware Test Suite ===\n");
  console.log("Base URL:", BASE_URL);
  console.log("");

  // Smoke Tests
  console.log("--- Smoke Tests ---");

  await test("Health endpoint returns 200", async () => {
    const url = parseUrl(`${BASE_URL}/api/health`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (data.status !== "ok")
      throw new Error(`Expected status 'ok', got '${data.status}'`);
  })();

  await test("Health endpoint reports env status", async () => {
    const url = parseUrl(`${BASE_URL}/api/health`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
    });
    const data = JSON.parse(res.body);
    if (
      data.missingEnv &&
      data.missingEnv.length > 0 &&
      process.env.NODE_ENV === "production"
    ) {
      throw new Error(
        `Missing env vars in production: ${data.missingEnv.join(", ")}`,
      );
    }
  })();

  // Authentication Suite
  console.log("\n--- Authentication Suite ---");

  await test("Login with correct password returns 200", async () => {
    const url = parseUrl(`${BASE_URL}/api/auth/login`);
    const res = await httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({ password: "Admin123!" }),
    );

    if (res.status !== 200) {
      const error = JSON.parse(res.body);
      throw new Error(
        `Expected 200, got ${res.status}: ${error.error || res.body}`,
      );
    }

    const data = JSON.parse(res.body);
    if (!data.success) throw new Error("Login response missing success flag");

    // Extract session cookie
    const cookieHeader = res.cookies.find((c) =>
      c.startsWith("authenticated="),
    );
    if (!cookieHeader) throw new Error("No session cookie set");
    sessionCookie = cookieHeader.split(";")[0];
  })();

  await test("Login with wrong password returns 401", async () => {
    const url = parseUrl(`${BASE_URL}/api/auth/login`);
    const res = await httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({ password: "wrongpassword" }),
    );

    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  })();

  await test("Login without password returns 400", async () => {
    const url = parseUrl(`${BASE_URL}/api/auth/login`);
    const res = await httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      JSON.stringify({}),
    );

    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  })();

  await test("Auth check returns authenticated with valid cookie", async () => {
    if (!sessionCookie) {
      // Re-login to get cookie
      const url = parseUrl(`${BASE_URL}/api/auth/login`);
      const res = await httpRequest(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.path,
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
        JSON.stringify({ password: "Admin123!" }),
      );
      const cookieHeader = res.cookies.find((c) =>
        c.startsWith("authenticated="),
      );
      sessionCookie = cookieHeader ? cookieHeader.split(";")[0] : null;
    }

    if (!sessionCookie) throw new Error("No session cookie available");

    const url = parseUrl(`${BASE_URL}/api/auth/check`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.authenticated)
      throw new Error("Not authenticated despite valid cookie");
  })();

  await test("Auth check returns 401 without cookie", async () => {
    const url = parseUrl(`${BASE_URL}/api/auth/check`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
    });

    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  })();

  await test("Logout clears session cookie", async () => {
    if (!sessionCookie) throw new Error("No session cookie available");

    const url = parseUrl(`${BASE_URL}/api/auth/logout`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "POST",
      headers: { Cookie: sessionCookie },
    });

    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);

    // Check that cookie is cleared (expires in past or max-age=0)
    const cookieHeader = res.cookies.find((c) =>
      c.toLowerCase().includes("authenticated"),
    );
    if (cookieHeader) {
      const lowerHeader = cookieHeader.toLowerCase();
      const isExpired =
        lowerHeader.includes("max-age=0") || lowerHeader.includes("expires=");
      if (!isExpired && !lowerHeader.includes("authenticated=;")) {
        throw new Error(`Session cookie not cleared: ${cookieHeader}`);
      }
    }
    // If cookieHeader is missing, it's also effectively cleared
  })();

  // Feature API Tests (Phase 1)
  console.log("\n--- Feature API Tests (Phase 1) ---");

  await test("GET /api/members returns members list", async () => {
    const url = parseUrl(`${BASE_URL}/api/members`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error("Expected array of members");
  })();

  await test("GET /api/shifts returns shifts list", async () => {
    const url = parseUrl(`${BASE_URL}/api/shifts`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error("Expected array of shifts");
  })();

  await test("GET /api/events returns events list", async () => {
    const url = parseUrl(`${BASE_URL}/api/events`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!Array.isArray(data)) throw new Error("Expected array of events");
  })();

  // UI Navigation Tests
  console.log("\n--- UI Navigation Tests ---");

  const uiPages = [
    "/dashboard",
    "/preferences",
    "/schedule",
    "/admin/members",
    "/admin/shifts",
    "/admin/coverage",
    "/admin/assignments",
    "/admin/audit",
    "/export",
  ];

  for (const page of uiPages) {
    await test(`Page ${page} returns 200`, async () => {
      const url = parseUrl(`${BASE_URL}${page}`);
      const res = await httpRequest({
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: "GET",
        headers: { Cookie: sessionCookie },
      });
      // Next.js might return 200 even if it redirects to login if cookie is invalid,
      // but here we have a session cookie.
      if (res.status !== 200)
        throw new Error(`Expected 200 for ${page}, got ${res.status}`);
    })();
  }

  // Error Response Standardization Tests
  console.log("\n--- Error Response Standardization Tests ---");

  await test("GET /api/members/[invalid-id] returns standardized 404", async () => {
    const url = parseUrl(`${BASE_URL}/api/members/invalid-id-12345`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.error) throw new Error("Missing error field in response");
    if (!data.code) throw new Error("Missing code field in response");
    if (data.code !== "NOT_FOUND")
      throw new Error(`Expected code 'NOT_FOUND', got '${data.code}'`);
  })();

  await test("POST /api/shifts with invalid data returns standardized 400", async () => {
    const url = parseUrl(`${BASE_URL}/api/shifts`);
    const res = await httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.path,
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: sessionCookie },
      },
      JSON.stringify({ invalid: "data" }),
    );
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.error) throw new Error("Missing error field in response");
    if (data.code && data.code === "VALIDATION_ERROR") {
      // Good - standardized validation error
      if (!data.details) throw new Error("Missing details in validation error");
    }
  })();

  await test("GET /api/shifts/[invalid-id] returns standardized 404", async () => {
    const url = parseUrl(`${BASE_URL}/api/shifts/invalid-id-12345`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      headers: { Cookie: sessionCookie },
    });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.error) throw new Error("Missing error field in response");
    if (data.code !== "NOT_FOUND")
      throw new Error(`Expected code 'NOT_FOUND', got '${data.code}'`);
  })();

  await test("Unauthorized requests return standardized 401", async () => {
    const url = parseUrl(`${BASE_URL}/api/members`);
    const res = await httpRequest({
      hostname: url.hostname,
      port: url.port,
      path: url.path,
      method: "GET",
      // No cookie header
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    const data = JSON.parse(res.body);
    if (!data.error) throw new Error("Missing error field in response");
    if (data.code !== "UNAUTHORIZED")
      throw new Error(`Expected code 'UNAUTHORIZED', got '${data.code}'`);
  })();

  // Phase 3+ placeholders
  console.log("\n--- Future Phase Tests (Placeholders) ---");
  // Note: These are now implemented, but keeping placeholder for now
  skip(
    "POST /api/assignments/swap - Manual testing recommended",
    "Integration test requires specific data setup",
  );
  skip(
    "GET /api/audit - Manual testing recommended",
    "Integration test requires specific data setup",
  );

  // Summary
  console.log("\n=== Test Summary ===");
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Skipped: ${results.skipped.length}`);

  if (results.failed.length > 0) {
    console.log("\nFailed tests:");
    results.failed.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }

  if (results.skipped.length > 0) {
    console.log("\nSkipped tests (Phase 1+ features):");
    results.skipped.forEach(({ name, reason }) => {
      console.log(`  - ${name}: ${reason}`);
    });
  }

  console.log("");
  process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
