import { stats } from "../../data/stats";
import Reveal from "./Reveal";

export default function Stats() {
  return (
    <section className="py-24 bg-slate-50">
      <div className="mx-auto max-w-7xl px-6">

        <Reveal>
          <h2 className="text-center text-4xl font-bold text-acadia-navy">
            ACADIA en chiffres
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

          {stats.map((stat, index) => (
            <Reveal key={stat.title} delayMs={(index % 4) * 100}>
            <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-acadia-blue/10 blur-3xl" />

              <h3 className="relative z-10 text-5xl font-black text-acadia-blue">
                {stat.value}
                {stat.suffix}
              </h3>

              <h4 className="relative z-10 mt-4 text-xl font-bold text-acadia-navy">
                {stat.title}
              </h4>

              <p className="relative z-10 mt-3 text-slate-600">
                {stat.description}
              </p>
            </div>
            </Reveal>
          ))}

        </div>

      </div>
    </section>
  );
}