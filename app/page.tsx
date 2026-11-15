import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Partners from "@/components/landing/Partners";
import Stats from "@/components/landing/Stats";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import AcadiaBrain from "@/components/landing/AcadiaBrain";
import ForWhom from "@/components/landing/ForWhom";
import FAQ from "@/components/landing/faq/FAQ";
import CTA from "@/components/landing/cta/CTA";
import Footer from "@/components/landing/footer/Footer";

// ============================================================
// Page d'accueil — recentrée le 2026-11-14 sur la récolte et
// l'interprétation des données (sciences économiques et de gestion).
// Retirés : l'analyse du sujet par l'IA (coûteuse en crédits), le
// carrousel d'étapes (sujet, variables, hypothèses, méthodologie…) et
// la vidéo de démonstration de l'ancien parcours.
//
// Testimonials.tsx n'est volontairement pas monté : jamais un faux
// témoignage affiché comme réel. À réintégrer avec de vrais témoignages.
// ============================================================

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Partners />
      <HowItWorks />
      <Stats />
      <Features />
      <AcadiaBrain />
      <ForWhom />
      <FAQ />
      <CTA />
      <Footer />
    </>
  );
}
