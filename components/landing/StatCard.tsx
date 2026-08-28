"use client";

import { useEffect, useRef, useState } from "react";
import {
  GraduationCap,
  Building2,
  FileText,
  Zap,
} from "lucide-react";

type Props = {
  icon: string;
  value: number;
  suffix: string;
  title: string;
  description: string;
  color: string;
};

export default function StatCard({
  icon,
  value,
  suffix,
  title,
  description,
  color,
}: Props) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const icons = {
    graduation: GraduationCap,
    building: Building2,
    file: FileText,
    zap: Zap,
  };

  const Icon = icons[icon as keyof typeof icons];

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setCount(0);
          return;
        }

        let current = 0;
        const duration = 1500;
        const step = Math.ceil(value / (duration / 16));

        interval = setInterval(() => {
          current += step;

          if (current >= value) {
            current = value;

            if (interval) {
              clearInterval(interval);
            }
          }

          setCount(current);
        }, 16);
      },
      {
        threshold: 0.4,
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();

      if (interval) {
        clearInterval(interval);
      }
    };
  }, [value]);

  return (
    <div
      ref={ref}
      className="
        rounded-3xl
        border
        border-slate-200
        bg-white
        p-8
        shadow-sm
        transition-all
        duration-300
        hover:-translate-y-2
        hover:shadow-xl
      "
    >
      <div
        className={`
          flex
          h-16
          w-16
          items-center
          justify-center
          rounded-2xl
          ${color}
        `}
      >
        {Icon && <Icon className="h-8 w-8" />}
      </div>

      <h2 className="mt-8 text-5xl font-black text-slate-900">
        {count}
        {suffix}
      </h2>

      <h3 className="mt-4 text-xl font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-3 leading-7 text-slate-500">
        {description}
      </p>
    </div>
  );
}