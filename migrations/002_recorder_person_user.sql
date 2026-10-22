-- 002_recorder_person_user
-- Idempotent migration (safe to re-run)

ALTER TABLE "StockInRecorder" ADD COLUMN "personUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "StockOutRecorder" ADD COLUMN "personUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "ReturnRecorder" ADD COLUMN "personUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "NonReturnableRecorder" ADD COLUMN "personUserId" INTEGER REFERENCES "User"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "StockInRecorder_personUserId_idx" ON "StockInRecorder"("personUserId");
CREATE INDEX IF NOT EXISTS "StockOutRecorder_personUserId_idx" ON "StockOutRecorder"("personUserId");
CREATE INDEX IF NOT EXISTS "ReturnRecorder_personUserId_idx" ON "ReturnRecorder"("personUserId");
CREATE INDEX IF NOT EXISTS "NonReturnableRecorder_personUserId_idx" ON "NonReturnableRecorder"("personUserId");
