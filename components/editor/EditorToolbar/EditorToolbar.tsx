"use client";

import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  Save,
} from "lucide-react";

const buttons = [
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
];

export default function EditorToolbar() {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-3xl border bg-white p-4">
      {buttons.map((Icon, index) => (
        <button
          key={index}
          className="rounded-xl p-3 transition hover:bg-blue-50"
        >
          <Icon className="h-5 w-5 text-slate-700" />
        </button>
      ))}

      <div className="ml-auto">
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">
          <Save className="h-5 w-5" />
          Sauvegarder
        </button>
      </div>
    </div>
  );
}