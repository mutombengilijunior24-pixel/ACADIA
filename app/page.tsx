import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Partners from "@/components/landing/Partners";
import Stats from "@/components/landing/Stats";
import Features from "@/components/landing/Features";
import AcadiaBrain from "@/components/landing/AcadiaBrain";
import ResearchJourney from "@/components/landing/journey/ResearchJourney";
import Demo from "@/components/landing/Demo";
import ForWhom from "@/components/landing/ForWhom";
import FAQ from "@/components/landing/faq/FAQ";
import CTA from "@/components/landing/cta/CTA";
import Footer from "@/components/landing/footer/Footer";

// ============================================================
// P13 — La landing devient la route racine (auparavant un texte
// MVP minimal). /landing redirige désormais vers / (voir
// app/landing/page.tsx) pour ne pas casser un lien existant.
//
// Testimonials.tsx n'est volontairement plus monté ici : les
// témoignages affichés avant P13 étaient attribués à des personnes
// fictives ("Junior K.", "Sarah M.", "Pr. Patrick N.") présentées
// comme de vrais retours utilisateurs — jamais un faux témoignage
// affiché comme réel. À réintégrer avec de vrais témoignages une
// fois disponibles.
// ============================================================

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Partners />
      <Stats />
      <Features />
      <AcadiaBrain />
      <ResearchJourney />
      <Demo />
      <ForWhom />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
