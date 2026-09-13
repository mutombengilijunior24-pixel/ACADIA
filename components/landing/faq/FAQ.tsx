import { faq } from "../../../data/faq";
import FAQItem from "./FAQItem";
import Reveal from "../Reveal";

export default function FAQ() {
  return (
    <section id="faq" className="bg-gradient-to-b from-white to-slate-50 py-32">
      <div className="mx-auto max-w-5xl px-6">

        {/* Header */}

        <Reveal className="text-center">

          <span className="rounded-full bg-acadia-blue-50 px-5 py-2 text-sm font-semibold text-acadia-blue">
            QUESTIONS FRÉQUENTES
          </span>

          <h2 className="mt-8 text-5xl font-black leading-tight text-acadia-navy">
            Tout ce que vous devez savoir
            <br />
            avant de commencer.
          </h2>

          <p className="mx-auto mt-8 max-w-3xl text-xl leading-9 text-slate-600">
            Nous répondons aux questions les plus fréquentes afin de
            vous permettre d&apos;utiliser ACADIA en toute confiance.
          </p>

        </Reveal>

        {/* Questions */}

        <div className="mt-20 space-y-6">

          {faq.map((item, index) => (
            <Reveal key={item.question} delayMs={(index % 6) * 60}>
              <FAQItem
                question={item.question}
                answer={item.answer}
              />
            </Reveal>
          ))}

        </div>

      </div>
    </section>
  );
}