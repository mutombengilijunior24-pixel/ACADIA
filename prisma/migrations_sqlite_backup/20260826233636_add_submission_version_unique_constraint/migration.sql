-- CreateIndex
CREATE UNIQUE INDEX "Submission_researchId_studentId_version_key" ON "Submission"("researchId", "studentId", "version");
