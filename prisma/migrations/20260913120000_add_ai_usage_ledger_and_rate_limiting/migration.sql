-- CreateTable
CREATE TABLE "AIUsageLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "projectId" TEXT,
    "anonymousSessionId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "inputTokens" INTEGER,
    "cachedInputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "actualCostUsd" DECIMAL(12,6),
    "latencyMs" INTEGER,
    "success" BOOLEAN NOT NULL,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "errorMessage" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIUsageLedger_userId_idx" ON "AIUsageLedger"("userId");

-- CreateIndex
CREATE INDEX "AIUsageLedger_projectId_idx" ON "AIUsageLedger"("projectId");

-- CreateIndex
CREATE INDEX "AIUsageLedger_anonymousSessionId_idx" ON "AIUsageLedger"("anonymousSessionId");

-- CreateIndex
CREATE INDEX "AIUsageLedger_operation_idx" ON "AIUsageLedger"("operation");

-- CreateIndex
CREATE INDEX "AIUsageLedger_createdAt_idx" ON "AIUsageLedger"("createdAt");

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimitCounter_windowStart_idx" ON "RateLimitCounter"("windowStart");

-- CreateTable
CREATE TABLE "GenericAnalysisCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "normalizedInput" TEXT NOT NULL,
    "resultJson" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenericAnalysisCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenericAnalysisCache_cacheKey_key" ON "GenericAnalysisCache"("cacheKey");

-- CreateIndex
CREATE INDEX "GenericAnalysisCache_operation_idx" ON "GenericAnalysisCache"("operation");
