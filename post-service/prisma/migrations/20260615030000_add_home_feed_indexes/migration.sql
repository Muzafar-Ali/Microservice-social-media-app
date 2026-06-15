CREATE INDEX "Post_createdAt_id_idx"
ON "Post"("createdAt" DESC, "id" DESC);

CREATE INDEX "Post_authorId_createdAt_id_idx"
ON "Post"("authorId", "createdAt" DESC, "id" DESC);
