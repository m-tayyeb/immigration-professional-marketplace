import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AppHeader } from "../../components/app-header";
import { formatAppointmentInTimeZone } from "../../lib/assessment-intake";
import { nextAction, progressFromChecklist, statusLabels } from "../../lib/case-workflow";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role !== "CLIENT") redirect("/professional");
  const cases = await prisma.case.findMany({ where: { clientId: session.user.id }, include: { service: true, professional: { include: { user: true } }, checklist: true, appointments: { where: { purpose: "ASSESSMENT_CONSULTATION" }, orderBy: { updatedAt: "desc" } } }, orderBy: { updatedAt: "desc" } });
  return <main className="min-h-screen bg-mist"><AppHeader role="CLIENT" /><div className="mx-auto max-w-7xl px-6 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-widest text-ocean">Client dashboard</p><h1 className="mt-2 text-3xl font-bold">Your cases</h1></div><Link href="/services" className="rounded-lg bg-ocean px-4 py-3 font-semibold text-white">Start a new case</Link></div><div className="mt-8 grid gap-4">{cases.map((item) => { const progress = progressFromChecklist(item.checklist); const appointment = item.appointments[0]; return <Link key={item.id} href={`/cases/${item.id}`} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-ocean"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-sm text-slate-500">{item.service.name}</p><h2 className="mt-1 text-xl font-bold">{statusLabels[item.status]}</h2><p className="mt-2 text-sm text-slate-600">Professional: {item.professional.user.name}</p>{appointment?.appointmentAtUtc && appointment.timeZone && <p className="mt-2 text-sm font-semibold text-teal-800">Appointment ({appointment.status.replaceAll("_", " ").toLowerCase()}): {formatAppointmentInTimeZone(appointment.appointmentAtUtc, appointment.timeZone)}</p>}</div><div className="min-w-48"><div className="flex justify-between text-sm"><span>Progress</span><strong>{progress}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-600" style={{ width: `${progress}%` }}/></div></div></div><p className="mt-5 rounded-lg bg-mist p-3 text-sm"><strong>Next action:</strong> {nextAction(item.status, "CLIENT")}</p></Link>; })}{!cases.length && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-xl font-bold">No cases yet</h2><p className="mt-2 text-slate-600">Choose a service to begin with a €100 assessment.</p></div>}</div></div></main>;
}
