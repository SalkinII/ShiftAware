import React from "react";
import "@testing-library/jest-dom/vitest";

// Vitest with jsdom needs React in scope for JSX when using preserve mode
(globalThis as unknown as { React: typeof React }).React = React;
