import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Input({
  label,
  ...props
}: InputProps) {
  return (
    <div className="flex flex-col gap-2 w-full">

      {label && (
        <label className="text-sm font-semibold text-gray-700">
          {label}
        </label>
      )}

      <input
        {...props}
        className="
          w-full
          rounded-xl
          border
          border-gray-300
          px-4
          py-3
          outline-none
          transition-all
          duration-200
          focus:border-blue-600
          focus:ring-4
          focus:ring-blue-100
        "
      />

    </div>
  );
}