"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConsultationRequest } from "./consultation-request";
import type { Professional } from "../lib/professional-data";

export function ProfessionalCard({ professional }: { professional: Professional }) {
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? undefined;

  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-teal-100 font-bold text-ocean">{professional.name.split(" ").map(n => n[0]).join("")}</div><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{professional.name}</h2><span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">✓ Verified</span></div><p className="text-sm text-slate-600">{professional.type} · {professional.jurisdiction}</p></div></div><div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-md bg-slate-100 px-2 py-1">{professional.experience} years&apos; experience</span><span className="rounded-md bg-slate-100 px-2 py-1">★ {professional.rating} ({professional.reviews})</span><span className="rounded-md bg-slate-100 px-2 py-1">From €{professional.price}</span></div><p className="mt-4 text-sm leading-6 text-slate-600">{professional.description}</p><div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Specializations</p><div className="mt-2 flex flex-wrap gap-2">{professional.specializations.map(item => <span className="rounded-full bg-[#EDF7F7] px-2.5 py-1 text-xs font-medium text-ocean" key={item}>{item}</span>)}</div><p className="mt-3 text-sm text-slate-600"><strong>Languages:</strong> {professional.languages.join(", ")}</p></div><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link href={`/professionals/${professional.id}`} className="rounded-lg border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold hover:bg-slate-50">View Profile</Link><ConsultationRequest professional={professional} service={service} /></div></article>;
}
