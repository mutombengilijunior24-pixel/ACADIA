import { openai } from "./client";

async function testOpenAI() {
  try {
    const response = await openai.responses.create({
      model: "gpt-5.6",
      input:
        "Réponds uniquement par : ACADIA EST CONNECTÉ À OPENAI.",
    });

    console.log("======================================");
    console.log("ACADIA — TEST OPENAI");
    console.log("======================================");
    console.log(response.output_text);
    console.log("======================================");
  } catch (error) {
    console.error("ERREUR OPENAI :", error);
  }
}

testOpenAI();