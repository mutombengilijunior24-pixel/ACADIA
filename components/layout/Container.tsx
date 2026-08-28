import { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
};

export default function Container({
  children,
}: ContainerProps) {
  return (
    <div
      className="
        w-full
        max-w-7xl
        mx-auto
        px-8
        py-8
      "
    >
      {children}
    </div>
  );
}