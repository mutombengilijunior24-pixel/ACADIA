import Reveal from "./Reveal";

export default function Partners() {
  const universities = [
    "UNILU",
    "UNIKIN",
    "UNIKIS",
    "UPN",
    "UNIGOM",
    "UOM",
    "UNIKOL",
    "UNIKAM",
    "UPC",
    "UPL",
  ];

  return (
    <section className="bg-white py-20">

      <div className="mx-auto max-w-7xl px-6">

        {/* Titre */}

        <Reveal className="text-center">

          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-acadia-blue">
            Conçu pour la RDC
          </p>

          <h2 className="mt-4 text-4xl font-bold text-acadia-navy">
            Pensé pour les étudiants, chercheurs et universités
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">
            ACADIA est développé pour répondre aux exigences
            académiques des principales universités de la
            République Démocratique du Congo.
          </p>

        </Reveal>

        {/* Cartes universités */}

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">

          {universities.map((university, index) => (
            <Reveal key={university} delayMs={(index % 5) * 80}>
            <div
              className="
                rounded-2xl
                border
                border-slate-200
                bg-white
                p-8
                text-center
                shadow-sm
                transition-all
                duration-300
                hover:-translate-y-1
                hover:border-acadia-blue-100
                hover:shadow-xl
              "
            >
              <div
                className="
                  mx-auto
                  mb-5
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-acadia-blue-50
                  text-xl
                  font-bold
                  text-acadia-blue
                "
              >
                {university.substring(0, 2)}
              </div>

              <h3 className="font-bold text-slate-800">
                {university}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Compatible avec ACADIA
              </p>

            </div>
            </Reveal>
          ))}

        </div>

      </div>

    </section>
  );
}