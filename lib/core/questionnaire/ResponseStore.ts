import fs from "fs";
import path from "path";

export type QuestionnaireResponseAnswer = {
  questionId: string;
  value: string | string[] | number | null;
};

export type QuestionnaireResponse = {
  id: string;
  questionnaireId: string;
  submittedAt: string;
  answers: QuestionnaireResponseAnswer[];
};

const DATA_DIRECTORY = path.join(
  process.cwd(),
  "data"
);

const DATA_FILE = path.join(
  DATA_DIRECTORY,
  "questionnaire-responses.json"
);

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIRECTORY)) {
    fs.mkdirSync(DATA_DIRECTORY, {
      recursive: true,
    });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      "[]",
      "utf-8"
    );
  }
}

function readResponses(): QuestionnaireResponse[] {
  ensureDataFile();

  try {
    const content = fs.readFileSync(
      DATA_FILE,
      "utf-8"
    );

    return JSON.parse(content);
  } catch {
    return [];
  }
}

function writeResponses(
  responses: QuestionnaireResponse[]
) {
  ensureDataFile();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      responses,
      null,
      2
    ),
    "utf-8"
  );
}

export function saveQuestionnaireResponse(
  response: QuestionnaireResponse
) {
  const responses = readResponses();

  responses.push(response);

  writeResponses(responses);

  return response;
}

export function getQuestionnaireResponses(
  questionnaireId: string
) {
  const responses = readResponses();

  return responses.filter(
    (response) =>
      response.questionnaireId ===
      questionnaireId
  );
}

export function getQuestionnaireResponseCount(
  questionnaireId: string
) {
  return getQuestionnaireResponses(
    questionnaireId
  ).length;
}