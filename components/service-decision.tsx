import { agreeToProceed, doNotProceed } from "../lib/case-actions";
import { euros } from "../lib/case-workflow";
import { deriveServiceAgreementAmounts } from "../lib/service-agreement";

type Agreement = {
  decision: "PROCEED" | "DO_NOT_PROCEED";
  decidedAt: Date;
  assessmentPaidAmount: unknown | null;
  totalServiceAmount: unknown | null;
  remainingAmountAcknowledged: unknown | null;
  financialObligationConfirmed: boolean;
};

export function ServiceDecision({ caseId, professionalView, status, clientDecision, assessmentReleased, assessmentPaidAmount, totalServiceAmount, agreement }: {
  caseId: string;
  professionalView: boolean;
  status: string;
  clientDecision: "PROCEED" | "DO_NOT_PROCEED" | null;
  assessmentReleased: boolean;
  assessmentPaidAmount: number;
  totalServiceAmount: number | null;
  agreement: Agreement | null;
}) {
  if (!assessmentReleased) return null;
  if (clientDecision === "PROCEED") return <DecisionConfirmation professionalView={professionalView} agreement={agreement}/>;
  if (clientDecision === "DO_NOT_PROCEED") return <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"><h2 className="text-xl font-bold">Service continuation declined</h2><p className="mt-2 text-slate-600">The client chose not to proceed after the assessment. No remaining service-fee obligation was created.</p>{agreement && <p className="mt-3 text-sm text-slate-500">Recorded on {agreement.decidedAt.toLocaleString("en-FI")}.</p>}</section>;
  if (status !== "AWAITING_CLIENT_DECISION") return null;
  if (professionalView) return <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"><h2 className="text-xl font-bold">Client service decision</h2><p className="mt-2 text-slate-600">Waiting for the client to confirm whether they want to proceed.</p></section>;

  const amounts = deriveServiceAgreementAmounts(totalServiceAmount, assessmentPaidAmount);
  return <section className="rounded-2xl border-2 border-teal-300 bg-white p-6 lg:col-span-2"><p className="text-sm font-bold uppercase tracking-widest text-ocean">Binding service decision</p><h2 className="mt-2 text-2xl font-bold">Proceed with professional service</h2>{amounts ? <><div className="mt-5 space-y-3 leading-7 text-slate-700"><p>You have already paid <strong>{euros(amounts.assessmentPaidAmount)}</strong> for your assessment.</p><p>By proceeding, you authorize the professional to continue preparing your case under the selected CaseWiser service.</p><p>The standard service price is <strong>{euros(amounts.totalServiceAmount)}</strong> in total. Your assessment payment is included in this amount, leaving <strong>{euros(amounts.remainingAmountAcknowledged)} remaining</strong>.</p><p>The remaining amount will become payable later in the workflow according to the CaseWiser payment process.</p></div><form action={agreeToProceed} className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4"><input type="hidden" name="caseId" value={caseId}/><label className="flex items-start gap-3 font-semibold text-teal-950"><input type="checkbox" name="financialAcknowledgement" required className="mt-1"/><span>I confirm that I want to proceed with this service and understand that {euros(amounts.remainingAmountAcknowledged)} remains payable as part of the agreed {euros(amounts.totalServiceAmount)} service fee.</span></label><button className="mt-4 rounded-lg bg-ocean px-5 py-3 font-semibold text-white">Proceed with service</button></form></> : <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-900">The service total must be configured before a binding Proceed decision can be recorded.</p>}<form action={doNotProceed} className="mt-5 border-t border-slate-200 pt-5"><input type="hidden" name="caseId" value={caseId}/><p className="text-sm text-slate-600">If you do not want the professional to continue, you can stop the case without creating a remaining service-fee obligation.</p><button className="mt-3 rounded-lg border border-slate-300 px-5 py-3 font-semibold">Do not proceed</button></form></section>;
}

function DecisionConfirmation({ professionalView, agreement }: { professionalView: boolean; agreement: Agreement | null }) {
  if (!agreement || agreement.decision !== "PROCEED" || agreement.assessmentPaidAmount === null || agreement.totalServiceAmount === null || agreement.remainingAmountAcknowledged === null) return <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"><h2 className="text-xl font-bold">Service continuation confirmed</h2><p className="mt-2 text-slate-600">This is a historical Proceed decision. Detailed financial acknowledgement evidence was not recorded by the earlier workflow.</p></section>;
  return <section className="rounded-2xl border border-teal-300 bg-teal-50 p-6 lg:col-span-2"><h2 className="text-xl font-bold">{professionalView ? "Client formally agreed to proceed" : "Service continuation confirmed"}</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><DecisionField label="Total agreed service fee" value={euros(agreement.totalServiceAmount as { toString(): string })}/><DecisionField label="Assessment already paid" value={euros(agreement.assessmentPaidAmount as { toString(): string })}/><DecisionField label="Remaining service fee" value={euros(agreement.remainingAmountAcknowledged as { toString(): string })}/><DecisionField label="Confirmed on" value={agreement.decidedAt.toLocaleString("en-FI")}/></dl></section>;
}

function DecisionField({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>; }
