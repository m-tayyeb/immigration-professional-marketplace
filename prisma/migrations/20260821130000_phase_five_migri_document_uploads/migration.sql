-- Phase 5.1: flag uploaded Migri decision reports before official review.
ALTER TABLE "CaseDocument" ADD COLUMN "migriDecisionReport" BOOLEAN NOT NULL DEFAULT false;
