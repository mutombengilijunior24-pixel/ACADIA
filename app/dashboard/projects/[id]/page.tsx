"use client";

import EditorToolbar from "@/components/editor/EditorToolbar/EditorToolbar";
import RichTextEditor from "@/components/editor/Editor/RichTextEditor";
import AIPanel from "@/components/editor/AIPanel/AIPanel";
import ReferencesPanel from "@/components/editor/References/ReferencesPanel";
import CommentsPanel from "@/components/editor/Comments/CommentsPanel";
import VersionHistory from "@/components/editor/VersionHistory/VersionHistory";

export default function ProjectWorkspacePage() {
  return (
    <main className="grid gap-8 lg:grid-cols-12 p-8">

      <div className="space-y-6 lg:col-span-8">
        <EditorToolbar />
        <RichTextEditor />
      </div>

      <div className="space-y-6 lg:col-span-4">
        <AIPanel />
        <ReferencesPanel />
        <CommentsPanel />
        <VersionHistory />
      </div>

    </main>
  );
}