export default class AIEngine {
  async analyzeResearch(
    subject: string
  ) {
    return {
      detectedDomain: "",
      suggestions: [],
      subject,
    };
  }
}