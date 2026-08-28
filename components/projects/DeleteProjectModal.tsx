"use client";

import { Trash2, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
};

export default function DeleteProjectModal({
  open,
  onClose,
  onDelete,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">

      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b p-6">

          <h2 className="text-xl font-bold">
            Supprimer le projet
          </h2>

          <button onClick={onClose}>
            <X />
          </button>

        </div>

        <div className="p-6 text-center">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
            <Trash2 className="h-10 w-10 text-red-600" />
          </div>

          <p className="mt-6 text-slate-600">
            Cette action est irréversible.
          </p>

        </div>

        <div className="flex justify-end gap-3 border-t p-6">

          <button
            onClick={onClose}
            className="rounded-xl border px-5 py-3"
          >
            Annuler
          </button>

          <button
            onClick={onDelete}
            className="rounded-xl bg-red-600 px-5 py-3 text-white hover:bg-red-700"
          >
            Supprimer
          </button>

        </div>

      </div>

    </div>
  );
}