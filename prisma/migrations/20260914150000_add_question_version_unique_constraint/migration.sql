-- CreateIndex
CREATE UNIQUE INDEX "Question_assignmentId_groupKey_version_key" ON "Question"("assignmentId", "groupKey", "version");
