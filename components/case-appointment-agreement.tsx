import type { CaseAppointmentPurpose, CaseAppointmentStatus, ConsultationMethod, UserRole } from "@prisma/client";
import { acceptAppointmentProposal, addAppointmentMessage, bookConfirmedAppointment, counterproposeAppointment, proposeAppointment, requestAppointmentChange, withdrawAssessmentRequest } from "../lib/appointment-actions";
import { formatAppointmentInTimeZone } from "../lib/assessment-intake";

const methodLabels = { ONLINE: "Online", TELEPHONE: "Telephone", FACE_TO_FACE: "Face to face" } as const;
const statusLabels = { PROPOSED: "Proposal awaiting response", CHANGE_REQUESTED: "Change requested", CONFIRMED: "Confirmed", WITHDRAWN: "Withdrawn", CANCELLED: "Cancelled", COMPLETED: "Completed" } as const;

type Appointment = {
  id: string;
  purpose: CaseAppointmentPurpose;
  status: CaseAppointmentStatus;
  method: ConsultationMethod | null;
  appointmentAtUtc: Date | null;
  timeZone: string | null;
  instructions: string | null;
  professionalMessage: string | null;
  confirmationSource: string | null;
  confirmedAt: Date | null;
  revisions: { id: string; proposedById: string; method: ConsultationMethod; appointmentAtUtc: Date; timeZone: string; instructions: string; message: string | null; createdAt: Date; acceptedAt: Date | null }[];
  messages: { id: string; authorId: string; body: string; kind: string; createdAt: Date }[];
};

export function CaseAppointmentAgreement({ caseId, caseStatus, role, userId, clientId, professionalUserId, assessmentPaid, appointment, purpose = "ASSESSMENT_CONSULTATION", enabled = true }: {
  caseId: string;
  caseStatus: string;
  role: UserRole;
  userId: string;
  clientId: string;
  professionalUserId: string;
  assessmentPaid: boolean;
  appointment?: Appointment;
  purpose?: CaseAppointmentPurpose;
  enabled?: boolean;
}) {
  const professional = role === "ADMIN" || (role === "PROFESSIONAL" && userId === professionalUserId);
  const client = role === "CLIENT" && userId === clientId;
  const latest = appointment?.revisions[0];
  const openAssessment = purpose === "ASSESSMENT_CONSULTATION" && (caseStatus === "AWAITING_ASSESSMENT_REVIEW" || caseStatus === "AWAITING_ASSESSMENT_PAYMENT");
  const canPropose = purpose === "ASSESSMENT_CONSULTATION" ? openAssessment : enabled;

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><h2 className="text-lg font-bold">Assessment appointment agreement</h2>{appointment ? <div className="mt-4 space-y-5"><div className="rounded-xl bg-mist p-4"><p className="font-semibold">{statusLabels[appointment.status]}</p>{appointment.method && appointment.appointmentAtUtc && appointment.timeZone && <p className="mt-2">{methodLabels[appointment.method]} · {formatAppointmentInTimeZone(appointment.appointmentAtUtc, appointment.timeZone)}</p>}{appointment.instructions && <p className="mt-2 whitespace-pre-wrap text-sm">{appointment.instructions}</p>}{appointment.professionalMessage && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{appointment.professionalMessage}</p>}{appointment.confirmationSource && <p className="mt-2 text-xs text-slate-500">External consent recorded via {appointment.confirmationSource.replaceAll("_", " ").toLowerCase()}.</p>}</div><div><h3 className="font-bold">Proposal history</h3><div className="mt-2 space-y-2">{appointment.revisions.map((revision) => <div key={revision.id} className="rounded-lg border border-slate-200 p-3 text-sm"><p><strong>{revision.proposedById === clientId ? "Client" : "Professional"}:</strong> {methodLabels[revision.method]} · {formatAppointmentInTimeZone(revision.appointmentAtUtc, revision.timeZone)}</p><p className="mt-1 whitespace-pre-wrap">{revision.instructions}</p>{revision.message && <p className="mt-1 text-slate-600">{revision.message}</p>}<p className="mt-1 text-xs text-slate-400">{revision.acceptedAt ? "Accepted" : "Awaiting/replaced"} · {revision.createdAt.toLocaleString("en-FI")}</p></div>)}</div></div>{appointment.messages.length > 0 && <div><h3 className="font-bold">Appointment messages</h3><div className="mt-2 space-y-2">{appointment.messages.map((message) => <div key={message.id} className="rounded-lg bg-mist p-3 text-sm"><strong>{message.authorId === clientId ? "Client" : "Professional"}</strong><p className="whitespace-pre-wrap">{message.body}</p></div>)}</div></div>}</div> : <p className="mt-3 text-sm text-slate-600">No appointment has been proposed yet.</p>}

  {professional && canPropose && (!appointment || ["PROPOSED", "CHANGE_REQUESTED"].includes(appointment.status)) && <div className="mt-6 grid gap-5 lg:grid-cols-2"><AppointmentForm caseId={caseId} purpose={purpose} action={proposeAppointment} title={appointment ? "Send revised proposal" : "Send CaseWiser proposal"} submitLabel="Send proposal"/><AppointmentForm caseId={caseId} purpose={purpose} action={bookConfirmedAppointment} title="Book confirmed appointment" submitLabel="Record confirmed appointment" direct/></div>}

  {client && appointment?.status === "PROPOSED" && latest?.proposedById === professionalUserId && <div className="mt-6 grid gap-5 lg:grid-cols-2"><form action={acceptAppointmentProposal} className="rounded-xl border border-teal-200 p-4"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="appointmentId" value={appointment.id}/><h3 className="font-bold">Accept proposal</h3><p className="mt-2 text-sm text-slate-600">Acceptance confirms the appointment and makes the €100 assessment payment available.</p><button className="mt-4 rounded-lg bg-ocean px-4 py-2.5 font-semibold text-white">Accept appointment</button></form><AppointmentForm caseId={caseId} appointmentId={appointment.id} action={counterproposeAppointment} title="Propose another appointment" submitLabel="Send counterproposal"/></div>}

  {client && appointment?.status === "CHANGE_REQUESTED" && <div className="mt-6"><AppointmentForm caseId={caseId} appointmentId={appointment.id} action={counterproposeAppointment} title="Propose revised appointment details" submitLabel="Send counterproposal"/></div>}

  {professional && appointment?.status === "PROPOSED" && latest?.proposedById === clientId && <form action={acceptAppointmentProposal} className="mt-6 rounded-xl border border-teal-200 p-4"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="appointmentId" value={appointment.id}/><h3 className="font-bold">Client counterproposal</h3><button className="mt-3 rounded-lg bg-ocean px-4 py-2.5 font-semibold text-white">Accept client counterproposal</button></form>}

  {(client || professional) && appointment && !["WITHDRAWN", "CANCELLED", "COMPLETED"].includes(appointment.status) && <div className="mt-6 grid gap-5 lg:grid-cols-2"><form action={addAppointmentMessage} className="rounded-xl border border-slate-200 p-4"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="appointmentId" value={appointment.id}/><h3 className="font-bold">Appointment message</h3><textarea name="message" required rows={3} className="mt-3 w-full rounded-lg border border-slate-300 p-3"/><button className="mt-3 rounded-lg border border-slate-300 px-4 py-2 font-semibold">Send message</button></form>{appointment.status === "CONFIRMED" && <form action={requestAppointmentChange} className="rounded-xl border border-amber-200 p-4"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="appointmentId" value={appointment.id}/><h3 className="font-bold">Request a change</h3><textarea name="message" required rows={3} placeholder="Reason or requested correction" className="mt-3 w-full rounded-lg border border-slate-300 p-3"/><button className="mt-3 rounded-lg border border-amber-400 px-4 py-2 font-semibold text-amber-900">Request change</button></form>}</div>}

  {client && !assessmentPaid && openAssessment && <form action={withdrawAssessmentRequest} className="mt-6 rounded-xl border border-red-200 p-4"><input type="hidden" name="caseId" value={caseId}/><h3 className="font-bold">Withdraw assessment request</h3><textarea name="reason" rows={2} placeholder="Optional reason" className="mt-3 w-full rounded-lg border border-slate-300 p-3"/><button className="mt-3 rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700">Withdraw request</button></form>}</section>;
}

function AppointmentForm({ caseId, appointmentId, action, title, submitLabel, direct = false, purpose = "ASSESSMENT_CONSULTATION" }: { caseId: string; appointmentId?: string; action: (formData: FormData) => Promise<void>; title: string; submitLabel: string; direct?: boolean; purpose?: CaseAppointmentPurpose }) {
  return <form action={action} className="space-y-3 rounded-xl border border-slate-200 p-4"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="purpose" value={purpose}/>{appointmentId && <input type="hidden" name="appointmentId" value={appointmentId}/>}<h3 className="font-bold">{title}</h3><label className="block text-sm font-semibold">Method<select name="method" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="" disabled>Select method</option>{Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Local date and time<input name="localDateTime" type="datetime-local" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">IANA time zone<input name="timeZone" required placeholder="Europe/Helsinki" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"/></label><label className="block text-sm font-semibold">Method-specific instructions<textarea name="instructions" required rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label><label className="block text-sm font-semibold">Message <span className="font-normal text-slate-500">(optional)</span><textarea name="message" rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label>{direct && <><label className="block text-sm font-semibold">Confirmation source<select name="confirmationSource" required defaultValue="" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="" disabled>Select source</option><option value="TELEPHONE">Telephone</option><option value="EXTERNAL_MESSAGE">External message</option><option value="FACE_TO_FACE">Face to face</option><option value="OTHER">Other</option></select></label><label className="block text-sm font-semibold">Confirmation note <span className="font-normal text-slate-500">(optional)</span><textarea name="confirmationNote" rows={2} className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-normal"/></label></>}<button className="w-full rounded-lg bg-ocean px-4 py-2.5 font-semibold text-white">{submitLabel}</button></form>;
}
