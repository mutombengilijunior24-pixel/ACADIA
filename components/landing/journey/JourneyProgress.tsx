export default function JourneyProgress() {
  return (
    <div className="mx-auto mt-20 max-w-5xl">

      <div className="mb-4 flex items-center justify-between">

        <div>

          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">
            Votre parcours académique
          </p>

          <h3 className="mt-2 text-2xl font-bold">
            Commencez aujourd'hui.
          </h3>

        </div>

        <div className="text-right">

          <p className="text-3xl font-black text-blue-600">
            15%
          </p>

          <p className="text-slate-500">
            1 étape sur 7
          </p>

        </div>

      </div>

      <div className="h-4 overflow-hidden rounded-full bg-slate-200">

        <div
          className="
            h-full
            w-[15%]
            rounded-full
            bg-gradient-to-r
            from-blue-600
            to-violet-600
          "
        />

      </div>

    </div>
  );
}