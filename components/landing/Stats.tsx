import { stats } from "../../data/stats";

export default function Stats() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6">

        <h2 className="text-4xl font-bold text-center">
          ACADIA en chiffres
        </h2>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          {stats.map((stat) => (
            <div
              key={stat.title}
              className="rounded-3xl border bg-white p-8"
            >
              <h3 className="text-5xl font-black text-blue-600">
                {stat.value}
                {stat.suffix}
              </h3>

              <h4 className="mt-4 text-xl font-bold">
                {stat.title}
              </h4>

              <p className="mt-3 text-slate-600">
                {stat.description}
              </p>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}