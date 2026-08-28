export interface AssistantStep {
  id: string;

  title: string;

  description: string;

  component: string;

  required: boolean;
}

export interface AssistantState {
  currentStep: number;

  completed: boolean;

  loading: boolean;

  data: Record<string, unknown>;
}

export default class SmartAssistantEngine {

}