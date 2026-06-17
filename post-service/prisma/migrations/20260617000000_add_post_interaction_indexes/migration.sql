CREATE INDEX "PostLike_postId_createdAt_userId_idx" ON "PostLike"("postId", "createdAt" DESC, "userId" DESC);
CREATE INDEX "PostComment_postId_createdAt_id_idx" ON "PostComment"("postId", "createdAt" DESC, "id" DESC);
