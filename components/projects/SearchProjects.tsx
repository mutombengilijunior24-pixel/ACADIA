"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function SearchProjects({
  value,
  onChange,
}: Props) {
  return (
    <input
      type="text"
      placeholder="Rechercher un projet..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-blue-600"
    />
  );
}