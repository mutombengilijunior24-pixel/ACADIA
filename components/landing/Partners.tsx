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

        <div className="text-center">

          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-600">
            Conçu pour la RDC
          </p>

          <h2 className="mt-4 text-4xl font-bold text-slate-900">
            Pensé pour les étudiants, chercheurs et universités
          </h2>

          <p className="mx-auto mt-5 max-w-3xl text-lg text-slate-600">
            ACADIA est développé pour répondre aux exigences
            académiques des principales universités de la
            République Démocratique du Congo.
          </p>

        </div>

        {/* Cartes universités */}

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">

          {universities.map((university) => (
            <div
              key={university}
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
                hover:border-blue-200
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
                  bg-blue-50
                  text-xl
                  font-bold
                  text-blue-600
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
          ))}

        </div>

      </div>

    </section>
  );
}