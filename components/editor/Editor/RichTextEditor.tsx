"use client";

export default function RichTextEditor() {
  return (
    <div className="min-h-[700px] rounded-3xl border bg-white p-8">
      <textarea
        placeholder="Commencez à rédiger votre mémoire..."
        className="h-[620px] w-full resize-none border-none outline-none"
      />
    </div>
  );
}