import JourneyHeader from "./JourneyHeader";
import JourneyProgress from "./JourneyProgress";
import JourneyCarousel from "./JourneyCarousel";
import PremiumCard from "./PremiumCard";

export default function ResearchJourney() {
  return (
    <section
      id="workflow"
      className="
        relative
        overflow-hidden
        bg-gradient-to-b
        from-slate-50
        via-white
        to-slate-100
        py-32
      "
    >
      <div className="mx-auto max-w-7xl px-6">

        {/* En-tête */}
        <JourneyHeader />

        {/* Barre de progression */}
        <JourneyProgress />

        {/* Carrousel des étapes */}
        <div className="mt-16">
          <JourneyCarousel />
        </div>

        {/* Carte Premium */}
        <div className="mt-24">
          <PremiumCard />
        </div>

      </div>
    </section>
  );
}