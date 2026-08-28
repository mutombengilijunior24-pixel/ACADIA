"use client";

import { X } from "lucide-react";

import PaymentBadge from "./PaymentBadge";
import UnlockButton from "./UnlockButton";
import FeaturePreview from "./FeaturePreview";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  price: string;
  features: string[];
};

export default function PricingModal({
  open,
  onClose,
  title,
  description,
  price,
  features,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-black/50
        p-6
        backdrop-blur-sm
      "
    >
      <div
        className="
          relative
          w-full
          max-w-2xl
          rounded-[36px]
          bg-white
          p-10
          shadow-2xl
        "
      >
        {/* Bouton fermer */}

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="
            absolute
            right-6
            top-6
            rounded-xl
            p-2
            transition
            hover:bg-slate-100
          "
        >
          <X className="h-5 w-5" />
        </button>

        {/* Badge de prix */}

        <PaymentBadge price={price} />

        {/* Titre */}

        <h2 className="mt-6 text-4xl font-black text-slate-900">
          {title}
        </h2>

        {/* Description */}

        <p className="mt-5 text-lg leading-8 text-slate-600">
          {description}
        </p>

        {/* Fonctionnalités */}

        <div className="mt-10">
          <FeaturePreview items={features} />
        </div>

        {/* CTA */}

        <div className="mt-12">
          <UnlockButton price={price}>
            Débloquer cette étape
          </UnlockButton>
        </div>
      </div>
    </div>
  );
}