ALTER TABLE "Conversation" ADD COLUMN "directKey" TEXT;

WITH direct_participants AS (
  SELECT
    c.id AS "conversationId",
    ARRAY_AGG(p."userId" ORDER BY p."userId") AS "userIds",
    COUNT(*) AS "participantCount"
  FROM "Conversation" c
  JOIN "Participant" p ON p."conversationId" = c.id
  WHERE c.type = 'DIRECT'
    AND p."deletedAt" IS NULL
  GROUP BY c.id
),
valid_direct_conversations AS (
  SELECT
    "conversationId",
    "userIds"[1] || ':' || "userIds"[2] AS "directKey"
  FROM direct_participants
  WHERE "participantCount" = 2
),
unique_direct_keys AS (
  SELECT "directKey"
  FROM valid_direct_conversations
  GROUP BY "directKey"
  HAVING COUNT(*) = 1
)
UPDATE "Conversation" c
SET "directKey" = vdc."directKey"
FROM valid_direct_conversations vdc
JOIN unique_direct_keys udk ON udk."directKey" = vdc."directKey"
WHERE c.id = vdc."conversationId";

CREATE UNIQUE INDEX "Conversation_directKey_key" ON "Conversation"("directKey");
