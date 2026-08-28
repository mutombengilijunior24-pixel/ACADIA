type Props = {
  items: string[];
};

export default function CTAFeatures({ items }: Props) {
  return (
    <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item}
          className="
            rounded-2xl
            border
            border-white/10
            bg-white/10
            px-5
            py-4
            text-center
            text-sm
            font-semibold
            text-white
            backdrop-blur
          "
        >
          ✓ {item}
        </div>
      ))}
    </div>
  );
}