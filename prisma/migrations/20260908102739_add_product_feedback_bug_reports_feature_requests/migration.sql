-- CreateTable
CREATE TABLE "ProductFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page" TEXT,
    "step" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "page" TEXT NOT NULL,
    "step" TEXT,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "page" TEXT,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFeedback_userId_idx" ON "ProductFeedback"("userId");

-- CreateIndex
CREATE INDEX "ProductFeedback_type_idx" ON "ProductFeedback"("type");

-- CreateIndex
CREATE INDEX "ProductFeedback_createdAt_idx" ON "ProductFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "BugReport_userId_idx" ON "BugReport"("userId");

-- CreateIndex
CREATE INDEX "BugReport_status_idx" ON "BugReport"("status");

-- CreateIndex
CREATE INDEX "BugReport_severity_idx" ON "BugReport"("severity");

-- CreateIndex
CREATE INDEX "BugReport_createdAt_idx" ON "BugReport"("createdAt");

-- CreateIndex
CREATE INDEX "FeatureRequest_userId_idx" ON "FeatureRequest"("userId");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_idx" ON "FeatureRequest"("status");

-- CreateIndex
CREATE INDEX "FeatureRequest_createdAt_idx" ON "FeatureRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductFeedback" ADD CONSTRAINT "ProductFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReport" ADD CONSTRAINT "BugReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

