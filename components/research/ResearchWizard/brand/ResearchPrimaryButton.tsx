"use client";

import type { ReactNode } from "react";

interface ResearchPrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  size?: "md" | "lg";
  className?: string;
}

export default function ResearchPrimaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
  size = "md",
  className = "",
}: ResearchPrimaryButtonProps) {
  const sizing =
    size === "lg" ? "px-8 py-5 text-base sm:text-lg" : "px-6 py-2.5 text-sm";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2.5 rounded-xl font-semibold text-white transition-all duration-150 focus-visible:ring-2 focus-visible:ring-acadia-blue/40 focus-visible:outline-none active:scale-[0.98] ${sizing} ${
        disabled ? "cursor-not-allowed opacity-50" : "hover:brightness-110"
      } ${className}`}
      style={{
        background: disabled
          ? "#93b0fb"
          : "linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)",
        boxShadow: disabled ? "none" : "0 4px 14px 0 rgba(37,84,235,0.28)",
      }}
    >
      {children}
    </button>
  );
}
