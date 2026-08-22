import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { DocumentStudio } from "../../components/document-studio";
import { hasDocumentStudioEntitlement, studioCaseLabel } from "../../lib/document-studio";
import { prisma } from "../../lib/prisma";

export default async function DocumentStudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const caseWhere = session.user.role === "CLIENT" ? { clientId: session.user.id } : session.user.role === "PROFESSIONAL" ? { professional: { userId: session.user.id } } : {};
  const [payments, cases] = await Promise.all([session.user.role === "CLIENT" ? prisma.paymentRequest.findMany({ where: { case: { clientId: session.user.id } }, select: { stage: true, status: true } }) : Promise.resolve([]), prisma.case.findMany({ where: caseWhere, include: { service: true, client: { select: { name: true } } }, orderBy: { updatedAt: "desc" } })]);
  if (session.user.role === "CLIENT" && !hasDocumentStudioEntitlement(payments)) return <main className="min-h-screen bg-mist"><div className="mx-auto max-w-xl px-6 py-20"><div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><p className="text-4xl">Locked</p><h1 className="mt-4 text-2xl font-bold">Document Studio unlocks after your assessment payment</h1><p className="mt-3 text-slate-600">Once an assessment payment is successful, you can prepare and securely save final documents to your CaseWiser case.</p></div></div></main>;
  return <DocumentStudio role={session.user.role} cases={cases.map((item) => ({ id: item.id, label: studioCaseLabel({ id: item.id, service: item.service.name, clientName: item.client.name }, session.user.role) }))}/>;
}
