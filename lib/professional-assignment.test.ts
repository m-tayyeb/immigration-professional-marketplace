import assert from "node:assert/strict";
import test from "node:test";
import { acceptsNewFinlandMvpCases, annaLaineSeedEmail, caseAccessWhere, isFinlandMvpAssignableServiceCode, professionalEligibilityWhere, selectProfessionalForAssignment } from "./professional-assignment";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const anna = { id: "anna", createdAt, verificationStatus: "VERIFIED" as const, acceptingNewCases: true, countries: [{ countryId: "finland" }], services: [{ serviceId: "RESIDENCE_PERMIT_RENEWAL" }, { serviceId: "FIRST_RESIDENCE_PERMIT" }] };
const inactiveDummy = { id: "dummy", createdAt: new Date("2025-01-01T00:00:00.000Z"), verificationStatus: "VERIFIED" as const, acceptingNewCases: false, countries: [{ countryId: "finland" }], services: [{ serviceId: "RESIDENCE_PERMIT_RENEWAL" }] };

test("the Finland MVP seed marks only Anna as accepting new cases", () => {
  assert.equal(acceptsNewFinlandMvpCases(annaLaineSeedEmail), true);
  assert.equal(acceptsNewFinlandMvpCases("mikael.soder@example.test"), false);
});

test("an eligible Finland request assigns Anna from the active candidate set", () => {
  assert.equal(selectProfessionalForAssignment([anna], "finland", "RESIDENCE_PERMIT_RENEWAL")?.id, "anna");
  assert.equal(selectProfessionalForAssignment([anna], "finland", "FIRST_RESIDENCE_PERMIT")?.id, "anna");
});

test("an inactive dummy cannot receive a new automatic assignment", () => {
  assert.equal(selectProfessionalForAssignment([inactiveDummy, anna], "finland", "RESIDENCE_PERMIT_RENEWAL")?.id, "anna");
  assert.equal(selectProfessionalForAssignment([inactiveDummy], "finland", "RESIDENCE_PERMIT_RENEWAL"), null);
});

test("assignment requires the selected service", () => {
  assert.equal(selectProfessionalForAssignment([anna], "finland", "unsupported-service"), null);
});

test("OTHER is not an assignable Finland MVP service", () => {
  assert.equal(isFinlandMvpAssignableServiceCode("FIRST_RESIDENCE_PERMIT"), true);
  assert.equal(isFinlandMvpAssignableServiceCode("RESIDENCE_PERMIT_RENEWAL"), true);
  assert.equal(isFinlandMvpAssignableServiceCode("OTHER"), false);
});

test("consultation eligibility rejects inactive professionals and requires exact country and service", () => {
  assert.deepEqual(professionalEligibilityWhere("finland", "RESIDENCE_PERMIT_RENEWAL"), {
    verificationStatus: "VERIFIED",
    acceptingNewCases: true,
    countries: { some: { countryId: "finland" } },
    services: { some: { serviceId: "RESIDENCE_PERMIT_RENEWAL" } },
  });
  assert.equal(selectProfessionalForAssignment([inactiveDummy], "finland", "RESIDENCE_PERMIT_RENEWAL"), null);
  assert.equal(selectProfessionalForAssignment([anna], "sweden", "RESIDENCE_PERMIT_RENEWAL"), null);
  assert.equal(selectProfessionalForAssignment([anna], "finland", "OTHER"), null);
});

test("historical professional case access does not depend on current availability", () => {
  assert.deepEqual(caseAccessWhere("case-1", { id: "dummy-user", role: "PROFESSIONAL" }), {
    id: "case-1",
    professional: { userId: "dummy-user" },
  });
});
