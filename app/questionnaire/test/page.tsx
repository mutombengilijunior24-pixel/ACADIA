"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";
import { isDevEnvironment } from "@/lib/api/devOnlyRoute";

import { generateQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireEngine";

import {
  questionnaireTestResearch,
} from "@/lib/core/questionnaire/QuestionnaireTestData";

import QuestionnaireBuilder from "@/components/questionnaire/QuestionnaireBuilder";

export default function QuestionnaireTestPage() {
  if (!isDevEnvironment()) notFound();

  const questionnaire = useMemo(() => {
    return generateQuestionnaire(
      questionnaireTestResearch
    );
  }, []);

  return (
    <QuestionnaireBuilder
      questionnaire={questionnaire}
    />
  );
}