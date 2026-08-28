type BadgeProps = {
  children: React.ReactNode;
  variant?: "success" | "warning" | "danger" | "info";
};

export default function Badge({
  children,
  variant = "info",
}: BadgeProps) {
  const variants = {
    success: "bg-green-100 text-green-700",
    warning: "bg-yellow-100 text-yellow-700",
    danger: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  return (
    <span
      className={`
        inline-flex
        items-center
        rounded-full
        px-4
        py-2
        text-sm
        font-semibold
        ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}