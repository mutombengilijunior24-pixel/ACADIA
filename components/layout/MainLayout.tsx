"use client";

import { useState, type ReactNode } from "react";

import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import FeedbackWidget from "@/components/product/FeedbackWidget";

type MainLayoutProps = {
  children: ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar onMenuClick={() => setMobileNavOpen(true)} />

      <div className="flex">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

        <main
          className="min-w-0 flex-1"
          style={{
            background:
              "radial-gradient(ellipse at 70% 0%, #eef2ff 0%, #f6f8fc 50%, #f6f8fc 100%)",
          }}
        >
          {children}
        </main>
      </div>

      <FeedbackWidget />
    </div>
  );
}
