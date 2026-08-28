import { introductionPrompt } from "../prompts/introduction";

export function buildIntroductionPrompt(data: {
  title: string;
  university: string;
  faculty: string;
  department: string;
  level: string;
}) {
  return `
${introductionPrompt}

Titre :
${data.title}

Université :
${data.university}

Faculté :
${data.faculty}

Département :
${data.department}

Niveau :
${data.level}
`;
}