import { AssistantStep } from "../assistant/SmartAssistantEngine";

export default class WorkflowEngine {
  constructor(
    private steps: AssistantStep[]
  ) {}

  getSteps() {
    return this.steps;
  }

  getStep(index: number) {
    return this.steps[index];
  }

  totalSteps() {
    return this.steps.length;
  }
}