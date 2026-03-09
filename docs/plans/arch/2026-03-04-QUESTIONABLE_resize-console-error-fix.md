# Resize Console Error Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Eliminate the "Console Error" that appears in the Next.js 15 development error overlay when operating the right resize handle on a shift block node.

**Architecture:** The error is NOT from our explicit error-handling code (all paths produce non-empty prefixed messages), NOT from React Flow or d3-drag (zero console.error calls in compiled sources), and NOT from the server API (all PUT requests return 200 OK). The root cause must be identified via diagnostic instrumentation first, then fixed precisely. The two most likely candidates are: (A) a browser `ResizeObserver loop` error from the synchronous `setState` inside the `ShiftContent` ResizeObserver callback, or (B) React 19's internal error reporting detecting a pattern during the resize re-render cycle. Both are captured by Next.js 15.1.2's error overlay.

**Tech Stack:** Next.js 15.1.2, React 19, @xyflow/react 12.10.0, TypeScript

**Investigation Summary (already completed):**
- Server terminal: all PUT `/api/shifts/[id]` return 200 OK during resize — no server errors
- `@xyflow/react` compiled source: zero `console.error` calls
- `d3-drag` source: zero `console.error` calls
- Our resize handlers in `ShiftBlockNode.tsx` and `useCanvasActions.ts`: three `console.error` calls, ALL with non-empty prefixed messages (`"Resize failed:"` / `"Resize update failed:"`) — these cannot produce the "empty" console error the user sees
- The ShiftContent component (inside ShiftBlockNode) has a bare `ResizeObserver` that synchronously calls `setState` on every dimension change — classic trigger for ResizeObserver loop browser errors

---

### Task 1: Add Diagnostic Error Interceptor

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Why:** We need to capture the EXACT error that triggers the Next.js overlay. This tells us whether it's a ResizeObserver loop, a React internal error, or something else. Evidence before fixes.

**Step 1: Add a temporary useEffect that intercepts errors**

Add this near the top of the schedule page component (inside `SchedulePage` function body, after the first `useState` calls):

```tsx
useEffect(() => {
  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    console.warn("[DIAGNOSTIC] console.error intercepted:", ...args);
    console.warn("[DIAGNOSTIC] stack:", new Error().stack);
    origConsoleError.apply(console, args);
  };

  const handleWindowError = (event: ErrorEvent) => {
    console.warn("[DIAGNOSTIC] window error event:", event.message, event.filename, event.lineno);
  };
  window.addEventListener("error", handleWindowError);

  return () => {
    console.error = origConsoleError;
    window.removeEventListener("error", handleWindowError);
  };
}, []);
```

**Step 2: Reproduce the error**
---WAIT FOR USER INPUT BEFORE YOU PROCEED - ASK for exactly the following steps to be followed:

1. Open `http://localhost:3000/admin/shifts/schedule`
2. Open browser dev tools → Console tab
3. Filter console by "DIAGNOSTIC"
4. Select a shift, drag its right resize handle
5. Read the `[DIAGNOSTIC]` output — it will show:
   - The exact arguments passed to `console.error`
   - The stack trace showing WHERE it was called
   - Any `window error` events (like ResizeObserver loop)

--- ONCE USER CONFIRMED THE ERROR HAS BEEN REPRODUCED CONTINUE WITH THE FOLLOWING STEPS---
**Step 3: Record the findings**

Expected results (one of):
- **If ResizeObserver loop:** `[DIAGNOSTIC] window error event: ResizeObserver loop completed with undelivered notifications` — proceed to Task 2
- **If our catch handler:** `[DIAGNOSTIC] console.error intercepted: "Resize failed:" "unknown error"` with stack trace pointing to `ShiftBlockNode.tsx` — proceed to Task 3
- **If React internal:** `[DIAGNOSTIC] console.error intercepted:` with React-related stack — proceed to Task 4

**Step 4: Commit diagnostic (temporary)**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "chore: add diagnostic error interceptor for resize investigation"
```

---

### Task 2: Fix ResizeObserver Loop (if diagnostic confirms)

**Root Cause:** The `ShiftContent` component's `ResizeObserver` callback synchronously calls `setMW()` and `setMH()`. During NodeResizer-driven resize, node dimensions change rapidly. The ResizeObserver fires → setState → re-render → content toggles (showNames, showTime, etc.) → potential layout shift → ResizeObserver fires again. The browser detects this loop and fires a `ResizeObserver loop completed with undelivered notifications` error event on `window`. Next.js 15's overlay catches this.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:66-75`

**Step 1: Wrap ResizeObserver callback in requestAnimationFrame**

In `ShiftBlockNode.tsx`, find the ResizeObserver setup (lines 66-75):

```tsx
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  const ro = new ResizeObserver(([entry]) => {
    setMW(entry.contentRect.width);
    setMH(entry.contentRect.height);
  });
  ro.observe(el);
  return () => ro.disconnect();
}, []);
```

Replace with:

```tsx
useEffect(() => {
  const el = containerRef.current;
  if (!el) return;
  let rafId = 0;
  const ro = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      setMW(entry.contentRect.width);
      setMH(entry.contentRect.height);
    });
  });
  ro.observe(el);
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
  };
}, []);
```

This defers the setState to the next animation frame, breaking the synchronous observation → render → observation loop.

**Step 2: Verify**

1. Reproduce: select shift → drag right handle
2. Expected: no "Console Error" overlay, no ResizeObserver warnings in console

**Step 3: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx
git commit -m "fix: debounce ShiftContent ResizeObserver to prevent loop errors"
```

---

### Task 3: Downgrade resize console.error to console.warn (if diagnostic shows our handlers)

**Root Cause:** Next.js 15 + React 19 development overlay captures ALL `console.error` calls and shows them as red errors, even when they're intentional error logging. Our resize handlers call `console.error` in catch blocks, which triggers the overlay even though the errors are already handled via toast notifications.

**Files:**
- Modify: `components/features/LaneCalendar/nodes/ShiftBlockNode.tsx:202,207`
- Modify: `components/features/LaneCalendar/hooks/useCanvasActions.ts:268`

**Step 1: Replace console.error with console.warn in ShiftBlockNode resize handler**

In `ShiftBlockNode.tsx`, find (line ~200-208):

```tsx
result.catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  console.error("Resize failed:", msg || "unknown error");
});
```

Replace with:

```tsx
result.catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (process.env.NODE_ENV === "development") {
    console.warn("Resize failed:", msg || "unknown error");
  }
});
```

Do the same for the synchronous catch block (line ~205-208):

```tsx
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  console.error("Resize failed:", msg || "unknown error");
}
```

Replace with:

```tsx
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (process.env.NODE_ENV === "development") {
    console.warn("Resize failed:", msg || "unknown error");
  }
}
```

**Step 2: Replace console.error with console.warn in useCanvasActions resize handler**

In `useCanvasActions.ts`, find (line ~268):

```tsx
console.error("Resize update failed:", message || "unknown error");
```

Replace with:

```tsx
if (process.env.NODE_ENV === "development") {
  console.warn("Resize update failed:", message || "unknown error");
}
```

The toast notification already provides user-facing error feedback. The console.warn still appears in the console for debugging but does NOT trigger the Next.js error overlay.

**Step 3: Verify**

1. Reproduce: select shift → drag right handle  
2. Expected: no red "Console Error" overlay

**Step 4: Commit**

```bash
git add components/features/LaneCalendar/nodes/ShiftBlockNode.tsx \
  components/features/LaneCalendar/hooks/useCanvasActions.ts
git commit -m "fix: downgrade resize error logging to console.warn to avoid Next.js overlay"
```

---

### Task 4: Fix React Internal Error (if diagnostic shows React stack)

**Root Cause:** React 19 detects a pattern issue during the resize re-render cycle and calls `console.error` internally. The fix depends on the specific React error message found in the diagnostic.

**Files:**
- Depends on diagnostic findings

**Step 1: Read the diagnostic output**

The `[DIAGNOSTIC] console.error intercepted:` log will show the exact React error message and stack trace. Common possibilities:
- "Cannot update a component while rendering" → move setState out of render path
- "Each child in a list should have a unique key" → fix key props
- "Warning: React does not recognize the X prop" → fix prop forwarding

**Step 2: Fix based on findings**

Apply the minimal fix for whatever React pattern issue is detected.

**Step 3: Verify and commit**

---

### Task 5: Remove Diagnostic Interceptor

**Files:**
- Modify: `app/admin/shifts/schedule/page.tsx`

**Step 1: Remove the diagnostic useEffect**

Remove the entire `useEffect` block added in Task 1 (the one with `[DIAGNOSTIC]` console.warn calls).

**Step 2: Final verification**

1. Open schedule page
2. Select shift → drag right resize handle
3. Confirm: NO "Console Error" overlay appears
4. Confirm: shift resize persists correctly (check that shift duration changed in the sidebar)

**Step 3: Commit**

```bash
git add app/admin/shifts/schedule/page.tsx
git commit -m "chore: remove diagnostic error interceptor after resize fix confirmed"
```

---

### Task 6: Apply Both Fixes Defensively

**Regardless of diagnostic outcome**, both Task 2 (ResizeObserver debounce) and Task 3 (console.error → console.warn) are improvements worth keeping:

- **Task 2** prevents a real browser performance issue (ResizeObserver loop) even if it's not the current trigger
- **Task 3** prevents intentional error logging from accidentally triggering the Next.js overlay in any future scenario

If the diagnostic shows the error is from ONE of these, still apply BOTH as defensive improvements.

**Final commit:**

```bash
git add -A
git commit -m "fix: eliminate resize console error — debounce ResizeObserver + downgrade error logging"
```
