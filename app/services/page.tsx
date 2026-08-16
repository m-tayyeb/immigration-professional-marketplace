import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AppHeader } from "../../components/app-header";
import { countries, matters, euros } from "../../lib/case-workflow";
import { createCase } from "../../lib/case-actions";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (session.user.role !== "CLIENT") redirect("/professional");
  const [services, countryRecords] = await Promise.all([
    prisma.immigrationService.findMany({ where: { active: true, code: { in: ["FIRST_RESIDENCE_PERMIT", "RESIDENCE_PERMIT_RENEWAL", "OTHER"] } }, orderBy: { name: "asc" } }),
    prisma.country.findMany({ where: { name: { in: [...countries] } }, orderBy: { name: "asc" } }),
  ]);
  return <main className="min-h-screen bg-mist"><AppHeader role="CLIENT" /><div className="mx-auto max-w-3xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-widest text-ocean">New case</p><h1 className="mt-2 text-3xl font-bold">Choose your service</h1><p className="mt-3 text-slate-600">The €100 assessment is included in the total—not added on top—and becomes due only if the professional approves your request.</p><form action={createCase} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6"><fieldset><legend className="font-bold">Service</legend><div className="mt-3 grid gap-3">{services.map((service) => <label key={service.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name="serviceId" value={service.id} required className="mt-1"/><span><strong>{service.name}</strong><span className="block text-sm text-slate-600">{service.totalPrice ? `${euros(service.totalPrice)} total · €100 assessment then ${euros(Number(service.totalPrice) - Number(service.assessmentFee))} remaining` : "€100 assessment · remaining amount set after assessment"}</span></span></label>)}</div></fieldset><label className="block font-bold">Country<select name="countryId" required defaultValue={countryRecords.find((item) => item.code === "FI")?.id} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal">{countryRecords.map((country) => <option key={country.id} value={country.id}>{country.name}</option>)}</select></label><label className="block font-bold">Matter<select name="matterType" className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 font-normal">{matters.map((matter) => <option key={matter.value} value={matter.value}>{matter.label}</option>)}</select></label><label className="block font-bold">Describe the matter <span className="font-normal text-slate-500">(required when matter is Other)</span><textarea name="matterDescription" rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-3 font-normal" /></label><button className="w-full rounded-lg bg-ocean px-4 py-3 font-semibold text-white">Request assessment</button></form></div></main>;
}
