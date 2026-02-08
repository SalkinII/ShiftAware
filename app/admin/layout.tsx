"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { CacheProvider } from "@/lib/cache/CacheProvider";
import { EventContextProvider } from "@/lib/contexts/EventContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <CacheProvider>
        <ToastProvider>
          <EventContextProvider isAdmin={true}>
            <div className="min-h-screen bg-gray-50 text-gray-900">
              <Header />
              <AdminSidebar />
              <main className="lg:pl-64 pt-16 min-h-screen">
                <div className="p-6 md:p-8 max-w-7xl mx-auto">{children}</div>
              </main>
            </div>
          </EventContextProvider>
        </ToastProvider>
      </CacheProvider>
    </ErrorBoundary>
  );
}
