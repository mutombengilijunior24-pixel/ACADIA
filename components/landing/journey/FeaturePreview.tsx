import { CheckCircle2 } from "lucide-react";

type Props = {
  items: string[];
};

export default function FeaturePreview({ items }: Props) {
  return (
    <div className="grid gap-4">

      {items.map((item) => (
        <div
          key={item}
          className="
            flex
            items-center
            gap-3
          "
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />

          <span>{item}</span>

        </div>
      ))}

    </div>
  );
}