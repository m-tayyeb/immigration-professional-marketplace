-- Add an availability flag without removing or changing historical professional data.
ALTER TABLE "ProfessionalProfile"
ADD COLUMN "acceptingNewCases" BOOLEAN NOT NULL DEFAULT false;

-- Only Anna Laine's profile is assignable for new Finland MVP work.
UPDATE "ProfessionalProfile" AS profile
SET "acceptingNewCases" = true
FROM "User" AS app_user
WHERE profile."userId" = app_user."id"
  AND lower(app_user."email") = 'anna.laine@example.test';

-- Add only missing Finland MVP service assignments for Anna so exact service
-- matching works without removing or rewriting any existing assignment.
INSERT INTO "ProfessionalService" (
  "id",
  "professionalId",
  "serviceId",
  "price",
  "durationMinutes",
  "description"
)
SELECT
  'finland_mvp_' || lower(service."code"),
  profile."id",
  service."id",
  COALESCE(service."totalPrice", service."assessmentFee"),
  45,
  'Finland MVP support for ' || lower(service."name") || '.'
FROM "ProfessionalProfile" AS profile
JOIN "User" AS app_user ON profile."userId" = app_user."id"
CROSS JOIN "ImmigrationService" AS service
WHERE lower(app_user."email") = 'anna.laine@example.test'
  AND service."code" IN ('FIRST_RESIDENCE_PERMIT', 'RESIDENCE_PERMIT_RENEWAL')
ON CONFLICT ("professionalId", "serviceId") DO NOTHING;

CREATE INDEX "ProfessionalProfile_verificationStatus_acceptingNewCases_idx"
ON "ProfessionalProfile"("verificationStatus", "acceptingNewCases");
