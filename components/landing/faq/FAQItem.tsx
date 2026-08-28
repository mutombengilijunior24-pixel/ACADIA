"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Props = {
  question: string;
  answer: string;
};

export default function FAQItem({
  question,
  answer,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`
        overflow-hidden
        rounded-3xl
        border
        transition-all
        duration-300

        ${
          open
            ? "border-blue-200 bg-blue-50 shadow-lg"
            : "border-slate-200 bg-white hover:border-blue-200 hover:shadow-md"
        }
      `}
    >
      <button
        onClick={() => setOpen(!open)}
        className="
          flex
          w-full
          items-center
          justify-between
          px-8
          py-7
          text-left
        "
      >
        <h3 className="text-xl font-bold text-slate-900">
          {question}
        </h3>

        <ChevronDown
          className={`
            h-6
            w-6
            text-blue-600
            transition-transform
            duration-300

            ${open ? "rotate-180" : ""}
          `}
        />
      </button>

      <div
        className={`
          overflow-hidden
          transition-all
          duration-300

          ${
            open
              ? "max-h-96 opacity-100"
              : "max-h-0 opacity-0"
          }
        `}
      >
        <div className="px-8 pb-8">
          <p className="leading-8 text-slate-600">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}