import { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
};

export default function Card({ children }: CardProps) {
  return (
    <div className="rounded-2xl bg-white shadow-lg p-6 border border-gray-200">
      {children}
    </div>
  );
}