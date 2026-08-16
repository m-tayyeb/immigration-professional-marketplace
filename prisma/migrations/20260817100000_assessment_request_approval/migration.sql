-- Add opening assessment-review states without rewriting historical cases.
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'AWAITING_ASSESSMENT_REVIEW';
ALTER TYPE "CaseStatus" ADD VALUE IF NOT EXISTS 'ASSESSMENT_REQUEST_DECLINED';

-- Only newly created cases use the professional-review opening state.
ALTER TABLE "Case"
ALTER COLUMN "status" SET DEFAULT 'AWAITING_ASSESSMENT_REVIEW';
