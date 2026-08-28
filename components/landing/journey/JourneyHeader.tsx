export default function JourneyHeader() {
  return (
    <div className="mx-auto max-w-4xl text-center">

      <span className="rounded-full bg-blue-100 px-5 py-2 text-sm font-semibold text-blue-700">
        Continuez votre recherche
      </span>

      <h2 className="mt-8 text-5xl font-black leading-tight text-slate-900 lg:text-6xl">
        Votre mémoire avance
        <br />
        étape par étape.
      </h2>

      <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-slate-600">
        Commencez gratuitement.
        Débloquez uniquement les outils dont vous avez
        réellement besoin, au moment où vous en avez besoin.
      </p>

      <p className="mt-8 text-lg font-medium text-blue-600">
        Chaque étape débloquée vous rapproche un peu plus
        de votre soutenance.
      </p>

    </div>
  );
}