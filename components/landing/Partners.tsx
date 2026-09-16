import Reveal from "./Reveal";

type University = {
  code: string;
  caption: string;
  logoSrc?: string;
};

const FEATURED_UNIVERSITIES: University[] = [
  { code: "UNILU", caption: "Université de Lubumbashi", logoSrc: "/logos/unilu.jpg" },
  { code: "UNIKIN", caption: "Université de Kinshasa", logoSrc: "/logos/unikin.png" },
  { code: "UPL", caption: "Université Protestante de Lubumbashi", logoSrc: "/logos/upl.png" },
  { code: "UNH", caption: "Université Nouveaux Horizons", logoSrc: "/logos/unh.png" },
];

const OTHER_UNIVERSITIES: University[] = [
  { code: "UNIKIS", caption: "Université de Kisangani" },
  { code: "UPN", caption: "Université Pédagogique Nationale" },
  { code: "UNIGOM", caption: "Université de Goma" },
  { code: "UOM", caption: "Université Officielle de Mbujimayi" },
  { code: "UNIKOL", caption: "Université de Kolwezi", logoSrc: "/logos/unikol.png" },
  { code: "UNIKAM", caption: "Université de Kamina" },
  { code: "UPC", caption: "Université Protestante au Congo" },
];

function UniversityBadge({ university }: { university: University }) {
  if (university.logoSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={university.logoSrc}
        alt={`Logo ${university.caption}`}
        className="mx-auto mb-5 h-16 w-16 object-contain"
      />
    );
  }
  return (
    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-acadia-blue-50 text-xl font-bold text-acadia-blue">
      {university.code.substring(0, 2)}
    </div>
  );
}

export default function Partners() {
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

        {/* Universités phares */}

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

          {FEATURED_UNIVERSITIES.map((university, index) => (
            <Reveal key={university.code} delayMs={(index % 4) * 80}>
              <div
                className="
                  rounded-3xl
                  border
                  border-slate-200
                  bg-white
                  p-10
                  text-center
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-1
                  hover:border-acadia-blue-100
                  hover:shadow-xl
                "
              >
                <UniversityBadge university={university} />

                <h3 className="text-lg font-bold text-slate-800">
                  {university.code}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {university.caption}
                </p>

              </div>
            </Reveal>
          ))}

        </div>

        {/* Autres établissements */}

        <Reveal className="mt-16 text-center text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
          Et bien d&apos;autres établissements à travers la RDC
        </Reveal>

        <div className="mt-6 grid gap-4 grid-cols-3 sm:grid-cols-4 lg:grid-cols-7">

          {OTHER_UNIVERSITIES.map((university, index) => (
            <Reveal key={university.code} delayMs={(index % 7) * 60}>
              <div
                className="
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  p-4
                  text-center
                  shadow-sm
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:border-acadia-blue-100
                  hover:shadow-md
                "
              >
                {university.logoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={university.logoSrc}
                    alt={`Logo ${university.caption}`}
                    className="mx-auto mb-2 h-10 w-10 object-contain"
                  />
                ) : (
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-acadia-blue-50 text-sm font-bold text-acadia-blue">
                    {university.code.substring(0, 2)}
                  </div>
                )}

                <p className="text-xs font-semibold text-slate-600">
                  {university.code}
                </p>

              </div>
            </Reveal>
          ))}

        </div>

      </div>

    </section>
  );
}