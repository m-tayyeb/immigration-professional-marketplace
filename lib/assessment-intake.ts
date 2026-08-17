import type { CaseStatus, ConsultationMethod } from "@prisma/client";

export const consultationMethods = ["ONLINE", "TELEPHONE", "FACE_TO_FACE"] as const;

export type ClientContact = {
  name: string;
  email: string;
  profile: null | {
    telephone: string;
    addressLine: string;
    city: string;
    postalCode: string;
    country: string;
  };
};

export function isCompleteClientContact(contact: ClientContact) {
  const profile = contact.profile;
  return Boolean(
    contact.name.trim()
    && /^\S+@\S+\.\S+$/.test(contact.email)
    && profile
    && /^\+[1-9]\d{6,14}$/.test(profile.telephone.replace(/[\s()-]/g, ""))
    && profile.addressLine.trim()
    && profile.city.trim()
    && profile.postalCode.trim()
    && profile.country.trim(),
  );
}

export function parseConsultationMethod(value: FormDataEntryValue | null): ConsultationMethod | null {
  const method = String(value ?? "");
  return consultationMethods.includes(method as ConsultationMethod) ? method as ConsultationMethod : null;
}

export function parseOptionalDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export type AppointmentInput = {
  method: ConsultationMethod | null;
  appointmentAtUtc: Date | null;
  timeZone: string;
  instructions: string;
  professionalMessage: string;
};

export function isValidTimeZone(value: string) {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validateAppointmentInput(input: AppointmentInput) {
  if (!input.method || !input.appointmentAtUtc || Number.isNaN(input.appointmentAtUtc.getTime())) return false;
  if (!isValidTimeZone(input.timeZone) || !input.instructions.trim()) return false;
  return true;
}

type LocalDateTimeParts = { year: number; month: number; day: number; hour: number; minute: number };

function parseLocalDateTime(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day || utc.getUTCHours() !== hour || utc.getUTCMinutes() !== minute) return null;
  return { year, month, day, hour, minute };
}

function partsInTimeZone(date: Date, timeZone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function sameLocalDateTime(left: LocalDateTimeParts, right: LocalDateTimeParts) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute;
}

export function localAppointmentToUtc(localDateTime: string, timeZone: string): Date | null {
  const requested = parseLocalDateTime(localDateTime);
  if (!requested || !isValidTimeZone(timeZone)) return null;
  const naiveUtc = Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute);
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(naiveUtc + hours * 60 * 60 * 1000);
    const local = partsInTimeZone(sample, timeZone);
    offsets.add(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - sample.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(naiveUtc - offset))
    .filter((candidate) => sameLocalDateTime(partsInTimeZone(candidate, timeZone), requested));
  return matches.length === 1 ? matches[0] : null;
}

export function formatAppointmentInTimeZone(appointmentAtUtc: Date, timeZone: string) {
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid appointment time zone.");
  const local = partsInTimeZone(appointmentAtUtc, timeZone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${local.year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)} (${timeZone})`;
}

export function caseContactSnapshot(contact: ClientContact) {
  if (!isCompleteClientContact(contact) || !contact.profile) throw new Error("Incomplete client contact details.");
  return {
    fullName: contact.name.trim(),
    email: contact.email.trim().toLowerCase(),
    telephone: contact.profile.telephone.trim(),
    addressLine: contact.profile.addressLine.trim(),
    city: contact.profile.city.trim(),
    postalCode: contact.profile.postalCode.trim(),
    country: contact.profile.country.trim(),
  };
}

export function assessmentRequestFields(input: {
  situationDescription: string;
  preferredConsultationMethod: ConsultationMethod;
  preferredAvailability: string;
  relevantDeadline: Date | null;
  additionalMessage: string;
}) {
  return {
    situationDescription: input.situationDescription,
    preferredConsultationMethod: input.preferredConsultationMethod,
    preferredAvailability: input.preferredAvailability || null,
    relevantDeadline: input.relevantDeadline,
    additionalMessage: input.additionalMessage || null,
    status: "AWAITING_ASSESSMENT_REVIEW" as const,
  };
}

export function appointmentFields(input: AppointmentInput) {
  if (!validateAppointmentInput(input)) throw new Error("Invalid appointment details.");
  return {
    confirmedConsultationMethod: input.method!,
    appointmentAtUtc: input.appointmentAtUtc!,
    appointmentTimeZone: input.timeZone,
    appointmentInstructions: input.instructions,
    professionalMessage: input.professionalMessage || null,
  };
}

export function assessmentPaymentFields<T>(amount: T) {
  return { stage: "ASSESSMENT" as const, amount, status: "PENDING" as const };
}

export function canDecideAssessmentRequest(
  user: { id: string; role: "CLIENT" | "PROFESSIONAL" | "ADMIN" },
  assignedProfessionalUserId: string,
  status: CaseStatus,
) {
  if (status !== "AWAITING_ASSESSMENT_REVIEW") return false;
  return user.role === "ADMIN" || (user.role === "PROFESSIONAL" && user.id === assignedProfessionalUserId);
}

export function clientCanSeeAppointment(caseRecord: {
  status: CaseStatus;
  confirmedConsultationMethod: ConsultationMethod | null;
  appointmentAtUtc: Date | null;
  appointmentTimeZone: string | null;
  appointmentInstructions: string | null;
}) {
  return caseRecord.status === "AWAITING_ASSESSMENT_PAYMENT"
    && Boolean(caseRecord.confirmedConsultationMethod && caseRecord.appointmentAtUtc && caseRecord.appointmentTimeZone && caseRecord.appointmentInstructions);
}
