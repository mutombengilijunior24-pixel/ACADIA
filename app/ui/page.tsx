"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { isDevEnvironment } from "@/lib/api/devOnlyRoute";

import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import Loader from "../../components/ui/Loader";
import Modal from "../../components/ui/Modal";

export default function UIPage() {
  if (!isDevEnvironment()) notFound();

  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-slate-100 p-10">
      <Card>
        <h1 className="text-3xl font-bold mb-8">
          ACADIA UI KIT
        </h1>

        <div className="space-y-8">

          {/* Boutons */}
          <div className="flex gap-4 flex-wrap">
            <Button>Commencer</Button>

            <Button variant="secondary">
              Modifier
            </Button>

            <Button variant="danger">
              Supprimer
            </Button>

            <Button onClick={() => setOpen(true)}>
              Ouvrir le Modal
            </Button>
          </div>

          {/* Badges */}
          <div className="flex gap-4 flex-wrap">
            <Badge variant="success">
              Terminé
            </Badge>

            <Badge variant="warning">
              Brouillon
            </Badge>

            <Badge variant="danger">
              Erreur
            </Badge>

            <Badge>
              En cours
            </Badge>
          </div>

          {/* Loader */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">
              Loader
            </h2>

            <Loader />
          </div>

          {/* Inputs */}
          <Input
            label="Titre du mémoire"
            placeholder="Ex : L'influence des réseaux sociaux..."
          />

          <Input
            label="Email"
            type="email"
            placeholder="nom@email.com"
          />

          <Input
            label="Mot de passe"
            type="password"
            placeholder="********"
          />

        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={open}
        title="Bienvenue sur ACADIA"
        onClose={() => setOpen(false)}
      >
        <p className="mb-6 text-gray-600">
          Félicitations ! Tu es en train de construire ACADIA.
        </p>

        <Button onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </Modal>
    </main>
  );
}