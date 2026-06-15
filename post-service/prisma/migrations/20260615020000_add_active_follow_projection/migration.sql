CREATE TABLE "ActiveFollow" (
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    "followedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveFollow_pkey" PRIMARY KEY ("followerId", "followeeId")
);

CREATE INDEX "ActiveFollow_followerId_followedAt_idx"
ON "ActiveFollow"("followerId", "followedAt" DESC);

CREATE INDEX "ActiveFollow_followeeId_idx"
ON "ActiveFollow"("followeeId");
