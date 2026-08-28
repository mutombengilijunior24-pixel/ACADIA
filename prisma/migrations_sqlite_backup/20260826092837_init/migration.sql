-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "domain" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "studyLevel" TEXT,
    "program" TEXT,
    "institution" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "city" TEXT,
    "country" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisorProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "fullName" TEXT NOT NULL,
    "academicTitle" TEXT,
    "institution" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "domain" TEXT,
    "specialties" TEXT,
    "activeAcademicYear" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "professionalEmail" TEXT,
    "signature" TEXT,
    "activeCanevasId" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "researchType" TEXT,
    "level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "domain" TEXT,
    "university" TEXT,
    "location" TEXT,
    "description" TEXT,
    "researchData" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "instrument" TEXT,
    "dataset" TEXT,
    "annotations" TEXT,
    "bibliography" TEXT,
    "theoreticalFramework" TEXT,
    "exportHistory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisionCanevas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supervisorId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "faculty" TEXT,
    "department" TEXT,
    "workTypes" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "hypothesisRules" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupervisionCanevas_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisorInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "studentEmail" TEXT,
    "researchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "studentId" TEXT,
    CONSTRAINT "SupervisorInvitation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupervisionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "researchId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "SupervisionAssignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupervisionAssignment_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "researchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" TEXT NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "studentMessage" TEXT,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    "feedbackId" TEXT,
    "previousSubmissionId" TEXT,
    CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Submission_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "researchId" TEXT,
    "submissionId" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    CONSTRAINT "InboxMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InboxMessage_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedbackEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "globalEvaluation" TEXT NOT NULL,
    "sections" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    CONSTRAINT "FeedbackEntry_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Correction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "discussion" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "SupervisorBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "submissionId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL DEFAULT 'acadia',
    "status" TEXT NOT NULL DEFAULT 'generated',
    "overallState" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "inconsistencies" TEXT NOT NULL,
    "incompleteSections" TEXT NOT NULL,
    "importantQuestions" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "disclaimer" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "relatedResearchId" TEXT,
    "relatedSubmissionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "ResearchProject_ownerId_idx" ON "ResearchProject"("ownerId");

-- CreateIndex
CREATE INDEX "SupervisionCanevas_supervisorId_idx" ON "SupervisionCanevas"("supervisorId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisorInvitation_code_key" ON "SupervisorInvitation"("code");

-- CreateIndex
CREATE INDEX "SupervisorInvitation_supervisorId_idx" ON "SupervisorInvitation"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisionAssignment_supervisorId_idx" ON "SupervisionAssignment"("supervisorId");

-- CreateIndex
CREATE INDEX "SupervisionAssignment_studentId_idx" ON "SupervisionAssignment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionAssignment_studentId_supervisorId_status_key" ON "SupervisionAssignment"("studentId", "supervisorId", "status");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE INDEX "Submission_supervisorId_idx" ON "Submission"("supervisorId");

-- CreateIndex
CREATE INDEX "Submission_researchId_idx" ON "Submission"("researchId");

-- CreateIndex
CREATE INDEX "InboxMessage_recipientId_idx" ON "InboxMessage"("recipientId");

-- CreateIndex
CREATE INDEX "FeedbackEntry_submissionId_idx" ON "FeedbackEntry"("submissionId");

-- CreateIndex
CREATE INDEX "Correction_submissionId_idx" ON "Correction"("submissionId");

-- CreateIndex
CREATE INDEX "SupervisorBrief_submissionId_idx" ON "SupervisorBrief"("submissionId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
