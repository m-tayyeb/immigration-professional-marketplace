"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProfessionalCard } from "./professional-card";
import type { Professional } from "../lib/professional-data";

const selectClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function ProfessionalResults({ professionals }: { professionals: Professional[] }) {
  return <Suspense fallback={<main className="min-h-screen bg-mist" />}><ResultsContent professionals={professionals} /></Suspense>;
}

function ResultsContent({ professionals }: { professionals: Professional[] }) {
  const params = useSearchParams();
  const country = params.get("country") || "";
  const service = params.get("service") || "";
  const [type, setType] = useState("All");
  const [language, setLanguage] = useState("All");
  const [experience, setExperience] = useState("All");
  const [price, setPrice] = useState("All");
  const [rating, setRating] = useState("All");
  const [specialization, setSpecialization] = useState("All");
  const [sort, setSort] = useState("recommended");
  const matches = useMemo(() => professionals.filter((professional) =>
    professional.practiceCountries.includes(country) &&
    (!service || professional.specializations.includes(service)) &&
    (type === "All" || professional.type === type) &&
    (language === "All" || professional.languages.includes(language)) &&
    (experience === "All" || professional.experience >= Number(experience)) &&
    (price === "All" || professional.price <= Number(price)) &&
    (rating === "All" || professional.rating >= Number(rating)) &&
    (specialization === "All" || professional.specializations.includes(specialization)),
  ).sort((a, b) => sort === "rating" ? b.rating - a.rating : sort === "experience" ? b.experience - a.experience : sort === "price" ? a.price - b.price : (b.rating * 20 + b.experience) - (a.rating * 20 + a.experience)), [professionals, country, service, type, language, experience, price, rating, specialization, sort]);

  if (!country || !service) return <main><Header /><section className="mx-auto max-w-3xl px-6 py-24 text-center"><p className="text-sm font-bold uppercase tracking-[.18em] text-ocean">Start your search</p><h1 className="mt-3 text-3xl font-bold">Choose a destination and service first</h1><p className="mt-4 text-slate-600">We need both details to show the most relevant immigration professionals.</p><Link href="/" className="mt-7 inline-block rounded-lg bg-ocean px-5 py-3 font-semibold text-white">Return to search</Link></section></main>;

  return <main className="min-h-screen bg-mist"><Header /><section className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-6 py-10 lg:px-8"><Link href="/" className="text-sm font-semibold text-ocean">← Edit search</Link><p className="mt-5 text-sm font-bold uppercase tracking-[.18em] text-ocean">Professional matches</p><h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Immigration professionals for {country}</h1><p className="mt-3 text-slate-600">Support with <strong>{service}</strong> · <strong>{matches.length}</strong> matching professionals</p></div></section><div className="mx-auto grid max-w-7xl gap-7 px-6 py-8 lg:grid-cols-[270px_1fr] lg:px-8"><aside className="h-fit rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Filter results</h2><div className="mt-4 space-y-4"><Filter label="Professional type" value={type} set={setType} options={["All", "Immigration Lawyer", "Accredited Immigration Advisor"]} /><Filter label="Language" value={language} set={setLanguage} options={["All", "English", "Finnish", "Swedish", "French", "German", "Arabic", "Mandarin", "Hindi"]} /><Filter label="Experience" value={experience} set={setExperience} options={["All", "5", "10", "15"]} suffix="+ years" /><Filter label="Starting price" value={price} set={setPrice} options={["All", "100", "150", "200"]} prefix="Up to €" /><Filter label="Rating" value={rating} set={setRating} options={["All", "4.5", "4.7", "4.8"]} suffix="+ stars" /><Filter label="Specialization" value={specialization} set={setSpecialization} options={["All", "Work visas", "Student visas", "Family reunification", "Residence permits", "Permanent residence", "Citizenship"]} /></div></aside><section><div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm text-slate-600">Showing {matches.length} professionals</p><label className="text-sm font-semibold">Sort <select value={sort} onChange={(event) => setSort(event.target.value)} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="experience">Most experienced</option><option value="price">Lowest price</option></select></label></div><div className="grid gap-4 xl:grid-cols-2">{matches.map((professional) => <ProfessionalCard professional={professional} key={professional.profileId} />)}</div>{!matches.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="font-bold">No exact matches</h2><p className="mt-2 text-sm text-slate-600">Try widening a filter to see available professionals.</p></div>}</section></div></main>;
}

function Filter({ label, value, set, options, prefix = "", suffix = "" }: { label: string; value: string; set: (value: string) => void; options: string[]; prefix?: string; suffix?: string }) {
  return <label className="block text-sm font-semibold">{label}<select value={value} onChange={(event) => set(event.target.value)} className={selectClass}>{options.map((option) => <option key={option} value={option}>{option === "All" ? option : `${prefix}${option}${suffix}`}</option>)}</select></label>;
}

function Header() {
  return <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8"><Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight"><span className="grid h-8 w-8 place-items-center rounded-lg bg-ocean text-sm text-white">M</span>Migrate</Link><Link href="/" className="text-sm font-semibold text-slate-600 hover:text-ocean">New search</Link></header>;
}
