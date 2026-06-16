CREATE INDEX "Participant_userId_deletedAt_idx" ON "Participant"("userId", "deletedAt");
CREATE INDEX "Participant_conversationId_deletedAt_joinedAt_idx" ON "Participant"("conversationId", "deletedAt", "joinedAt");

CREATE INDEX "Message_conversationId_deletedAt_createdAt_id_idx" ON "Message"("conversationId", "deletedAt", "createdAt" DESC, "id" DESC);
CREATE INDEX "Message_conversationId_deletedAt_senderId_createdAt_idx" ON "Message"("conversationId", "deletedAt", "senderId", "createdAt");
