type Props = {
  price: string;
};

export default function PaymentBadge({ price }: Props) {
  return (
    <div
      className="
        inline-flex
        items-center
        rounded-full
        border
        border-emerald-300
        bg-emerald-50
        px-4
        py-2
        text-sm
        font-bold
        text-emerald-700
      "
    >
      À partir de {price}
    </div>
  );
}