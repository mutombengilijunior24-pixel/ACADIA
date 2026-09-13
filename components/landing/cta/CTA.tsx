import CTAButtons from "./CTAButtons";
import CTAFeatures from "./CTAFeatures";
import Reveal from "../Reveal";

export default function CTA() {
  return (
    <section className="py-32 px-6">

      <Reveal
        className="
          relative
          overflow-hidden
          rounded-[48px]
          bg-gradient-to-br
          from-acadia-blue
          via-acadia-blue-dark
          to-acadia-navy
          px-10
          py-24
          shadow-2xl
        "
      >

        {/* Halo */}

        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-acadia-blue-light/20 blur-3xl" />

        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        {/* ACADIA */}

        <div
          className="
            absolute
            inset-0
            flex
            items-center
            justify-center
            text-[180px]
            font-black
            text-white/5
            select-none
            pointer-events-none
          "
        >
          ACADIA
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">

          <span className="rounded-full bg-white/10 px-6 py-2 text-sm font-semibold text-blue-100 backdrop-blur">
            Votre prochain mémoire commence ici
          </span>

          <h2 className="mt-10 text-5xl font-black leading-tight text-white lg:text-7xl">
            Chaque grand mémoire
            <br />
            commence par une simple idée.
          </h2>

          <p className="mx-auto mt-10 max-w-3xl text-xl leading-9 text-blue-100">
            Aujourd&apos;hui, transformez cette idée en une recherche
            scientifique structurée, rigoureuse et prête à être soutenue.
          </p>

          <CTAButtons />

          <p className="mt-10 text-lg text-blue-100">
            Version bêta, accessible gratuitement.
            <br />
            Le chercheur reste décisionnaire à chaque étape.
          </p>

          <CTAFeatures
            items={[
              "Commencez gratuitement",
              "Sans carte bancaire",
              "Spécialisé Sciences Économiques et de Gestion",
              "Export DOCX & PDF",
            ]}
          />

        </div>

      </Reveal>

    </section>
  );
}