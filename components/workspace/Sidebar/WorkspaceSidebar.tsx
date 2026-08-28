"use client";

import Link from "next/link";

import {
  LayoutDashboard,
  BookOpen,
  Brain,
  Library,
  BarChart3,
  FileOutput,
} from "lucide-react";

const items = [
  {
    label: "Vue générale",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Éditeur",
    href: "/dashboard/projects/1/editor",
    icon: BookOpen,
  },
  {
    label: "Assistant IA",
    href: "/dashboard/projects/1/editor",
    icon: Brain,
  },
  {
    label: "Bibliographie",
    href: "/dashboard/projects/1/editor",
    icon: Library,
  },
  {
    label: "Statistiques",
    href: "/dashboard/projects/1/editor",
    icon: BarChart3,
  },
  {
    label: "Exporter",
    href: "/dashboard/projects/1/editor",
    icon: FileOutput,
  },
];

export default function WorkspaceSidebar() {
  return (
    <aside className="rounded-3xl border bg-white p-6">
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 transition hover:bg-blue-50"
            >
              <Icon className="h-5 w-5 text-blue-600" />

              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}