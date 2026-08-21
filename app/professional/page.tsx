import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AppHeader } from "../../components/app-header";
import { euros, progressFromChecklist, statusLabels } from "../../lib/case-workflow";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfessionalDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role === "CLIENT") redirect("/dashboard");
  const cases = await prisma.case.findMany({ where: session.user.role === "PROFESSIONAL" ? { professional: { userId: session.user.id } } : {}, include: { client: true, service: true, payments: true, checklist: true }, orderBy: { updatedAt: "desc" } });
  const clients = new Set(cases.map((item) => item.clientId)).size;
  return <main className="min-h-screen bg-mist"><AppHeader role={session.user.role}/><div className="mx-auto max-w-7xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-widest text-ocean">Professional dashboard</p><h1 className="mt-2 text-3xl font-bold">Case operations</h1><div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="Clients" value={clients}/><Stat label="Active cases" value={cases.filter((item) => !["COMPLETED", "CANCELLED"].includes(item.status)).length}/><Stat label="Completed" value={cases.filter((item) => item.status === "COMPLETED").length}/></div><div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><Th>Client</Th><Th>Service</Th><Th>Status</Th><Th>Payment</Th><Th>Progress</Th><Th>Actions</Th></tr></thead><tbody>{cases.map((item) => { const assessment = item.payments.find((payment) => payment.stage === "ASSESSMENT"); const remaining = item.payments.find((payment) => payment.stage === "REMAINING_BALANCE"); return <tr key={item.id} className="border-t border-slate-100"><Td><strong>{item.client.name}</strong><br/><span className="text-slate-500">{item.client.email}</span></Td><Td>{item.service.name}</Td><Td>{statusLabels[item.status]}</Td><Td>Assessment: {assessment?.status.toLowerCase() ?? "not requested"}<br/>{remaining ? `${euros(remaining.amount)}: ${remaining.status.toLowerCase()}` : "Balance not requested"}</Td><Td>{progressFromChecklist(item.checklist)}%</Td><Td><Link href={`/professional/cases/${item.id}`} className="font-semibold text-ocean">Open case →</Link></Td></tr>; })}</tbody></table>{!cases.length && <p className="p-8 text-center text-slate-500">No assigned cases.</p>}</div></div></main>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>; }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 font-semibold">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-4 align-top">{children}</td>; }
