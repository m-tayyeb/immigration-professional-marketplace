import assert from "node:assert/strict";
import test from "node:test";
import {
  appointmentFields,
  assessmentPaymentFields,
  assessmentRequestFields,
  canDecideAssessmentRequest,
  caseContactSnapshot,
  clientCanSeeAppointment,
  formatAppointmentInTimeZone,
  isCompleteClientContact,
  localAppointmentToUtc,
  validateAppointmentInput,
} from "./assessment-intake";
import { assessmentRequestDecisionStatus, canPayAssessmentFee, statusAfterPayment } from "./case-workflow";

const completeContact = {
  name: "Test Client",
  email: "client@example.test",
  profile: { telephone: "+358401234567", addressLine: "1 Test Street", city: "Helsinki", postalCode: "00100", country: "Finland" },
};

const appointment = {
  method: "ONLINE" as const,
  appointmentAtUtc: new Date("2030-01-02T08:00:00.000Z"),
  timeZone: "Europe/Helsinki",
  instructions: "Use the TEST meeting link.",
  professionalMessage: "Please join five minutes early.",
};

test("incomplete client contact profile cannot submit an assessment request", () => {
  assert.equal(isCompleteClientContact({ ...completeContact, profile: null }), false);
  assert.equal(isCompleteClientContact({ ...completeContact, profile: { ...completeContact.profile, telephone: "0401234567" } }), false);
});

test("complete client contact profile can submit", () => {
  assert.equal(isCompleteClientContact(completeContact), true);
});

test("assessment request stores intake details, preferred method, review status, and no payment", () => {
  const fields = assessmentRequestFields({
    situationDescription: "TEST renewal situation",
    preferredConsultationMethod: "TELEPHONE",
    preferredAvailability: "Weekday afternoons",
    relevantDeadline: new Date("2030-02-01T00:00:00.000Z"),
    additionalMessage: "TEST only",
  });
  assert.equal(fields.situationDescription, "TEST renewal situation");
  assert.equal(fields.preferredConsultationMethod, "TELEPHONE");
  assert.equal(fields.status, "AWAITING_ASSESSMENT_REVIEW");
  assert.equal("payments" in fields, false);
});

test("unauthorized professional cannot approve an assigned case", () => {
  assert.equal(canDecideAssessmentRequest({ id: "other", role: "PROFESSIONAL" }, "assigned", "AWAITING_ASSESSMENT_REVIEW"), false);
  assert.equal(canDecideAssessmentRequest({ id: "assigned", role: "PROFESSIONAL" }, "assigned", "AWAITING_ASSESSMENT_REVIEW"), true);
  assert.equal(canDecideAssessmentRequest({ id: "admin", role: "ADMIN" }, "assigned", "AWAITING_ASSESSMENT_REVIEW"), true);
});

test("approval requires appointment date, time zone, method, and method-specific instructions", () => {
  assert.equal(validateAppointmentInput(appointment), true);
  assert.equal(validateAppointmentInput({ ...appointment, method: null }), false);
  assert.equal(validateAppointmentInput({ ...appointment, appointmentAtUtc: null }), false);
  assert.equal(validateAppointmentInput({ ...appointment, timeZone: "" }), false);
  assert.equal(validateAppointmentInput({ ...appointment, instructions: "" }), false);
});

test("approval saves appointment details and requests one €100 pending assessment payment", () => {
  const saved = appointmentFields(appointment);
  const payment = assessmentPaymentFields(100);
  assert.equal(saved.confirmedConsultationMethod, "ONLINE");
  assert.equal(saved.appointmentTimeZone, "Europe/Helsinki");
  assert.deepEqual(payment, { stage: "ASSESSMENT", amount: 100, status: "PENDING" });
});

test("repeated approval is rejected before another appointment or payment can be created", () => {
  assert.equal(assessmentRequestDecisionStatus("AWAITING_ASSESSMENT_REVIEW", "APPROVE"), "AWAITING_ASSESSMENT_PAYMENT");
  assert.equal(assessmentRequestDecisionStatus("AWAITING_ASSESSMENT_PAYMENT", "APPROVE"), null);
});

test("client sees complete appointment details before paying", () => {
  assert.equal(clientCanSeeAppointment({ status: "AWAITING_ASSESSMENT_PAYMENT", ...appointmentFields(appointment) }), true);
});

test("declined requests cannot be paid", () => {
  assert.equal(canPayAssessmentFee("ASSESSMENT_REQUEST_DECLINED"), false);
});

test("historical awaiting-payment and paid cases remain compatible", () => {
  assert.equal(canPayAssessmentFee("AWAITING_ASSESSMENT_PAYMENT"), true);
  assert.equal(statusAfterPayment("ASSESSMENT"), "ASSESSMENT_PAID");
});

test("profile edits do not alter an existing case contact snapshot", () => {
  const profile = { ...completeContact.profile };
  const firstCaseSnapshot = caseContactSnapshot({ ...completeContact, profile });
  profile.city = "Espoo";
  profile.telephone = "+358501112222";
  assert.equal(firstCaseSnapshot.city, "Helsinki");
  assert.equal(firstCaseSnapshot.telephone, "+358401234567");
});

test("future cases receive updated profile details", () => {
  const profile = { ...completeContact.profile };
  const firstCaseSnapshot = caseContactSnapshot({ ...completeContact, profile });
  profile.city = "Espoo";
  const futureCaseSnapshot = caseContactSnapshot({ ...completeContact, profile });
  assert.equal(firstCaseSnapshot.city, "Helsinki");
  assert.equal(futureCaseSnapshot.city, "Espoo");
});

test("appointment conversion produces the correct UTC instant", () => {
  assert.equal(localAppointmentToUtc("2030-01-02T10:00", "Europe/Helsinki")?.toISOString(), "2030-01-02T08:00:00.000Z");
  assert.equal(localAppointmentToUtc("2030-07-02T10:00", "Europe/Helsinki")?.toISOString(), "2030-07-02T07:00:00.000Z");
});

test("invalid and DST-nonexistent local appointment times are rejected", () => {
  assert.equal(localAppointmentToUtc("2030-02-30T10:00", "Europe/Helsinki"), null);
  assert.equal(localAppointmentToUtc("2030-01-02T10:00", "Not/A_Time_Zone"), null);
  assert.equal(localAppointmentToUtc("2026-03-29T03:30", "Europe/Helsinki"), null);
});

test("appointment display uses the stored IANA zone", () => {
  assert.equal(formatAppointmentInTimeZone(new Date("2030-07-02T07:00:00.000Z"), "Europe/Helsinki"), "2030-07-02 10:00 (Europe/Helsinki)");
});
