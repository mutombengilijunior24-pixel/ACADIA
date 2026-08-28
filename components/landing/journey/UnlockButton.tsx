"use client";

import { Lock, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  price: string;
  children: ReactNode;
};

export default function UnlockButton({
  price,
  children,
}: Props) {
  return (
    <button
      type="button"
      className="
        group
        flex
        w-full
        items-center
        justify-between
        gap-4
        rounded-2xl
        bg-slate-900
        px-6
        py-4
        font-semibold
        text-white
        transition-all
        duration-300
        hover:bg-blue-600
      "
    >
      <span className="flex items-center gap-3">
        <Lock className="h-5 w-5" />

        <span>{children}</span>
      </span>

      <span className="flex items-center gap-2 text-sm font-bold">
        {price}

        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  );
}