"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { CacheProvider } from "@/lib/cache/CacheProvider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <CacheProvider>
        <ToastProvider>
          <div className="min-h-screen bg-gray-50 text-gray-900">
            <Header />
            <Sidebar />
            <main className="lg:pl-64 pt-16 min-h-screen">
              <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
        </ToastProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
}
