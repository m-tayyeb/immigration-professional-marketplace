import type { DocumentRequirementStatus, UserRole } from "@prisma/client";
import { confirmDocumentCollection, createDocumentRequirement, markFileReady, reviewRequirementDocument, sendDocumentReminder, uploadRequirementDocument } from "../lib/document-actions";
import { requestRemainingPayment } from "../lib/case-actions";

const labels: Record<DocumentRequirementStatus, string> = { REQUESTED: "Requested", RECEIVED: "Received — awaiting review", ACCEPTED: "Accepted", REPLACEMENT_REQUIRED: "Replacement required" };

export function DocumentCollection({ caseId, role, requirements, completion, remainingPayment, fileReadyAt, canManage }: {
  caseId: string;
  role: UserRole;
  requirements: { id: string; title: string; description: string | null; status: DocumentRequirementStatus; active: boolean; documents: { id: string; fileName: string; uploadActor: string | null; externalSourceNote: string | null; createdAt: Date }[] }[];
  completion: { confirmedAt: Date } | null;
  remainingPayment: { status: string } | undefined;
  fileReadyAt: Date | null;
  canManage: boolean;
}) {
  const outstanding = requirements.some((item) => item.active && item.status !== "ACCEPTED");
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><h2 className="text-lg font-bold">Required documents</h2>
    <div className="mt-4 space-y-4">{requirements.map((requirement) => <article key={requirement.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{requirement.title}</h3>{requirement.description && <p className="text-sm text-slate-600">{requirement.description}</p>}</div><span className="text-sm font-semibold text-ocean">{labels[requirement.status]}</span></div>
      <div className="mt-3 space-y-1">{requirement.documents.map((document) => <p key={document.id} className="text-sm"><a className="font-semibold text-ocean" href={`/api/documents/${document.id}`}>{document.fileName}</a> · uploaded by {document.uploadActor?.toLowerCase() ?? "historical uploader"}{document.externalSourceNote ? ` · ${document.externalSourceNote}` : ""}</p>)}</div>
      {requirement.active && requirement.status !== "ACCEPTED" && <form action={uploadRequirementDocument} className="mt-4 flex flex-wrap items-end gap-2"><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="requirementId" value={requirement.id}/><input type="file" name="file" required className="text-sm"/>{canManage && <input name="externalSourceNote" placeholder="External source, e.g. Email" className="rounded-lg border px-3 py-2 text-sm"/>}<button className="rounded-lg border px-3 py-2 text-sm font-semibold">Upload against requirement</button></form>}
      {canManage && requirement.status === "RECEIVED" && <div className="mt-3 flex gap-2"><form action={reviewRequirementDocument}><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="requirementId" value={requirement.id}/><input type="hidden" name="decision" value="ACCEPTED"/><button className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white">Accept</button></form><form action={reviewRequirementDocument}><input type="hidden" name="caseId" value={caseId}/><input type="hidden" name="requirementId" value={requirement.id}/><input type="hidden" name="decision" value="REPLACEMENT_REQUIRED"/><button className="rounded-lg border border-amber-400 px-3 py-2 text-sm font-semibold">Request replacement</button></form></div>}
    </article>)}{!requirements.length && <p className="text-sm text-slate-500">No document requirements have been created.</p>}</div>
    {canManage && <div className="mt-5 grid gap-4 md:grid-cols-2"><form action={createDocumentRequirement} className="space-y-2 rounded-xl border p-4"><input type="hidden" name="caseId" value={caseId}/><h3 className="font-bold">Add required document</h3><input name="title" required placeholder="Document name" className="w-full rounded-lg border px-3 py-2"/><textarea name="description" placeholder="Optional instructions" className="w-full rounded-lg border p-3"/><button className="rounded-lg bg-ink px-3 py-2 font-semibold text-white">Request document</button></form>
      <div className="space-y-3 rounded-xl border p-4">{outstanding && <form action={sendDocumentReminder}><input type="hidden" name="caseId" value={caseId}/><button className="rounded-lg border px-3 py-2 font-semibold">Send document reminder</button></form>}{!completion && <form action={confirmDocumentCollection}><input type="hidden" name="caseId" value={caseId}/><button disabled={!requirements.length || outstanding} className="rounded-lg bg-ocean px-3 py-2 font-semibold text-white disabled:opacity-40">Confirm all required documents received</button></form>}{completion && <p className="text-sm font-semibold text-teal-800">Documents confirmed complete on {completion.confirmedAt.toLocaleString("en-FI")}.</p>}
      {completion && !remainingPayment && <form action={requestRemainingPayment}><input type="hidden" name="caseId" value={caseId}/><button className="rounded-lg bg-ocean px-3 py-2 font-semibold text-white">Request remaining payment</button></form>}
      {remainingPayment?.status === "PAID" && !fileReadyAt && <form action={markFileReady}><input type="hidden" name="caseId" value={caseId}/><button className="rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white">Mark file ready for final review</button></form>}{fileReadyAt && <p className="text-sm font-semibold text-teal-800">File ready since {fileReadyAt.toLocaleString("en-FI")}.</p>}</div></div>}
    {role === "CLIENT" && completion && <p className="mt-4 text-sm font-semibold text-teal-800">The professional confirmed that all required documents were received.</p>}
  </section>;
}
