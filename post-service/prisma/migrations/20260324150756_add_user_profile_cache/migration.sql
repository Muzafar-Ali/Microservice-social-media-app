-- CreateTable
CREATE TABLE "UserProfileCache" (
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfileCache_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "UserProfileCache_username_idx" ON "UserProfileCache"("username");
