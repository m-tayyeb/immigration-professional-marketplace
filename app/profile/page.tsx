import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { AppHeader } from "../../components/app-header";
import { updateClientProfile } from "../../lib/client-profile-actions";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.role !== "CLIENT") redirect("/professional");
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { clientProfile: true } });
  if (!user) redirect("/sign-in");
  return <main className="min-h-screen bg-mist"><AppHeader role="CLIENT" /><div className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm font-bold uppercase tracking-widest text-ocean">Client profile</p><h1 className="mt-2 text-3xl font-bold">Contact information</h1><p className="mt-3 text-slate-600">Complete these details before requesting an assessment. Your account email cannot be changed here.</p><form action={updateClientProfile} className="mt-8 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2"><ProfileField name="name" label="Full name" defaultValue={user.name}/><ProfileField name="email" label="Account email" type="email" defaultValue={user.email} disabled/><ProfileField name="telephone" label="Telephone with country code" type="tel" defaultValue={user.clientProfile?.telephone} placeholder="+358 40 123 4567"/><ProfileField name="addressLine" label="Address line" defaultValue={user.clientProfile?.addressLine}/><ProfileField name="city" label="City" defaultValue={user.clientProfile?.city}/><ProfileField name="postalCode" label="Postal code" defaultValue={user.clientProfile?.postalCode}/><ProfileField name="country" label="Country" defaultValue={user.clientProfile?.country}/><button className="rounded-lg bg-ocean px-4 py-3 font-semibold text-white sm:col-span-2">Save contact information</button></form></div></main>;
}

function ProfileField({ name, label, type = "text", defaultValue, placeholder, disabled = false }: { name: string; label: string; type?: string; defaultValue?: string; placeholder?: string; disabled?: boolean }) {
  return <label className="text-sm font-semibold">{label}<input name={name} type={type} required={!disabled} disabled={disabled} defaultValue={defaultValue} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal disabled:bg-slate-100"/></label>;
}
