-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_surveyId_respondentKey_key" ON "SurveyResponse"("surveyId", "respondentKey");

