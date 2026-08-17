import Link from "next/link";
import { signOut } from "../auth";

export function AppHeader({ role }: { role: "CLIENT" | "PROFESSIONAL" | "ADMIN" }) {
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><Link href="/" className="text-xl font-bold text-ocean">Migrate</Link><nav className="flex items-center gap-4 text-sm font-semibold"><Link href={role === "CLIENT" ? "/dashboard" : "/professional"}>Dashboard</Link>{role === "CLIENT" && <><Link href="/profile">Contact profile</Link><Link href="/services">Start a case</Link></>}<form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="rounded-lg border border-slate-300 px-3 py-2">Sign out</button></form></nav></div></header>;
}
