import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatAppointmentInTimeZone, localAppointmentToUtc } from "./assessment-intake";
import {
  appendAppointmentRevision,
  activeAppointmentForPurpose,
  appointmentConfirmationEffect,
  appointmentProposalEffect,
  assessmentPaymentAllowed,
  canClientManageAppointment,
  canCreateAppointmentForPurpose,
  canOfficiallyManageAppointment,
  canPartyAccessAppointment,
  canViewNotification,
  canWithdrawAssessment,
  parseConfirmationSource,
} from "./appointment-workflow";

test("direct professional booking records external client consent", () => {
  assert.equal(parseConfirmationSource("TELEPHONE"), "TELEPHONE");
  assert.equal(parseConfirmationSource("EXTERNAL_MESSAGE"), "EXTERNAL_MESSAGE");
  assert.equal(parseConfirmationSource("INVALID"), null);
});

test("direct assessment booking creates exactly one €100 payment effect", () => {
  assert.deepEqual(appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", false), { createAssessmentPayment: true, caseStatus: "AWAITING_ASSESSMENT_PAYMENT" });
  assert.deepEqual(appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", true), { createAssessmentPayment: false, caseStatus: "AWAITING_ASSESSMENT_PAYMENT" });
});

test("proposal creates no payment", () => {
  assert.deepEqual(appointmentProposalEffect(), { status: "PROPOSED", createAssessmentPayment: false });
});

test("client acceptance and professional acceptance of a counterproposal create one payment", () => {
  const clientAcceptance = appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", false);
  const professionalAcceptance = appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", false);
  assert.equal(clientAcceptance.createAssessmentPayment, true);
  assert.equal(professionalAcceptance.createAssessmentPayment, true);
});

test("multiple proposal cycles preserve revision history", () => {
  const first = { id: "professional-1", proposer: "professional" };
  const second = { id: "client-1", proposer: "client" };
  const third = { id: "professional-2", proposer: "professional" };
  const history = appendAppointmentRevision(appendAppointmentRevision(appendAppointmentRevision([], first), second), third);
  assert.deepEqual(history, [first, second, third]);
});

test("change request disables payment and reconfirmation re-enables existing payment without duplication", () => {
  assert.equal(assessmentPaymentAllowed("AWAITING_ASSESSMENT_PAYMENT", "CHANGE_REQUESTED"), false);
  assert.equal(assessmentPaymentAllowed("AWAITING_ASSESSMENT_PAYMENT", "CONFIRMED"), true);
  assert.equal(appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", true).createAssessmentPayment, false);
});

test("withdrawal blocks payment and progression", () => {
  assert.equal(canWithdrawAssessment("AWAITING_ASSESSMENT_REVIEW", false), true);
  assert.equal(canWithdrawAssessment("AWAITING_ASSESSMENT_PAYMENT", false), true);
  assert.equal(canWithdrawAssessment("ASSESSMENT_PAID", true), false);
  assert.equal(assessmentPaymentAllowed("ASSESSMENT_REQUEST_WITHDRAWN", "WITHDRAWN"), false);
});

test("final-file and supplementary appointments never create payment", () => {
  assert.equal(appointmentConfirmationEffect("FINAL_FILE_REVIEW", false).createAssessmentPayment, false);
  assert.equal(appointmentConfirmationEffect("SUPPLEMENTARY_REQUEST", false).createAssessmentPayment, false);
  assert.equal(appointmentConfirmationEffect("FINAL_FILE_REVIEW", false).caseStatus, null);
});

test("appointment authorization and notification privacy are scoped to case parties", () => {
  assert.equal(canOfficiallyManageAppointment({ id: "assigned", role: "PROFESSIONAL" }, "assigned"), true);
  assert.equal(canOfficiallyManageAppointment({ id: "other", role: "PROFESSIONAL" }, "assigned"), false);
  assert.equal(canClientManageAppointment({ id: "owner", role: "CLIENT" }, "owner"), true);
  assert.equal(canPartyAccessAppointment({ id: "stranger", role: "CLIENT" }, "owner", "assigned"), false);
  assert.equal(canViewNotification("owner", "owner"), true);
  assert.equal(canViewNotification("owner", "stranger"), false);
});

test("historical awaiting-payment cases without reusable appointments remain compatible", () => {
  assert.equal(assessmentPaymentAllowed("AWAITING_ASSESSMENT_PAYMENT", null), true);
});

test("UTC conversion, IANA display, and DST rejection remain enforced", () => {
  const utc = localAppointmentToUtc("2030-07-02T10:00", "Europe/Helsinki");
  assert.equal(utc?.toISOString(), "2030-07-02T07:00:00.000Z");
  assert.equal(formatAppointmentInTimeZone(utc!, "Europe/Helsinki"), "2030-07-02 10:00 (Europe/Helsinki)");
  assert.equal(localAppointmentToUtc("2026-03-29T03:30", "Europe/Helsinki"), null);
});

test("database and application reject two active appointments for the same case and purpose", () => {
  const appointments = [{ id: "active", purpose: "SUPPLEMENTARY_REQUEST" as const, status: "PROPOSED" as const }];
  assert.equal(canCreateAppointmentForPurpose(appointments, "SUPPLEMENTARY_REQUEST"), false);
  const migration = readFileSync(new URL("../prisma/migrations/20260818100000_case_appointment_agreement/migration.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE UNIQUE INDEX "CaseAppointment_one_active_per_case_purpose_key"/);
  assert.match(migration, /WHERE "status" IN \('PROPOSED', 'CHANGE_REQUESTED', 'CONFIRMED'\)/);
});

test("revisions reuse the current active appointment", () => {
  const appointments = [
    { id: "completed", purpose: "ASSESSMENT_CONSULTATION" as const, status: "COMPLETED" as const },
    { id: "current", purpose: "ASSESSMENT_CONSULTATION" as const, status: "CHANGE_REQUESTED" as const },
  ];
  assert.equal(activeAppointmentForPurpose(appointments, "ASSESSMENT_CONSULTATION")?.id, "current");
});

test("a new appointment can be created after an earlier appointment is completed or cancelled", () => {
  assert.equal(canCreateAppointmentForPurpose([{ purpose: "FINAL_FILE_REVIEW", status: "COMPLETED" }], "FINAL_FILE_REVIEW"), true);
  assert.equal(canCreateAppointmentForPurpose([{ purpose: "FINAL_FILE_REVIEW", status: "CANCELLED" }], "FINAL_FILE_REVIEW"), true);
});

test("multiple sequential supplementary-request appointments are supported", () => {
  const history = [
    { id: "supplementary-1", purpose: "SUPPLEMENTARY_REQUEST" as const, status: "COMPLETED" as const },
    { id: "supplementary-2", purpose: "SUPPLEMENTARY_REQUEST" as const, status: "CANCELLED" as const },
  ];
  assert.equal(canCreateAppointmentForPurpose(history, "SUPPLEMENTARY_REQUEST"), true);
  const next = [...history, { id: "supplementary-3", purpose: "SUPPLEMENTARY_REQUEST" as const, status: "PROPOSED" as const }];
  assert.equal(canCreateAppointmentForPurpose(next, "SUPPLEMENTARY_REQUEST"), false);
});

test("assessment payment remains unique across sequential assessment appointments", () => {
  assert.equal(appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", false).createAssessmentPayment, true);
  assert.equal(appointmentConfirmationEffect("ASSESSMENT_CONSULTATION", true).createAssessmentPayment, false);
});
