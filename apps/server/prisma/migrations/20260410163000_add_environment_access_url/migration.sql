-- Add accessUrl field to persist environment access address
ALTER TABLE "Environment" ADD COLUMN "accessUrl" TEXT;

-- Backfill existing environments from domain
UPDATE "Environment"
SET "accessUrl" = CASE
  WHEN "domain" IS NULL OR btrim("domain") = '' THEN NULL
  WHEN position('://' in btrim("domain")) > 0 THEN regexp_replace(btrim("domain"), '/+$', '') || '/'
  ELSE 'http://' || regexp_replace(btrim("domain"), '/+$', '') || '/'
END
WHERE "accessUrl" IS NULL;

