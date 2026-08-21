import Link from "next/link";
import { auth, signOut } from "../auth";
import { markNotificationRead } from "../lib/appointment-actions";
import { prisma } from "../lib/prisma";

type Role = "CLIENT" | "PROFESSIONAL" | "ADMIN";

export async function AppHeader({ role }: { role: Role }) {
  const session = await auth();
  const [notifications, unreadCount] = session?.user?.id
    ? await Promise.all([
      prisma.notification.findMany({ where: { userId: session.user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
      prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
    ])
    : [[], 0];
  const caseHref = (caseId: string) => role === "CLIENT" ? `/cases/${caseId}` : `/professional/cases/${caseId}`;
  return <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"><Link href="/" className="text-xl font-bold text-ocean">Migrate</Link><nav className="flex items-center gap-4 text-sm font-semibold"><Link href={role === "CLIENT" ? "/dashboard" : "/professional"}>Dashboard</Link>{role === "CLIENT" && <><Link href="/profile">Contact profile</Link><Link href="/services">Start a case</Link></>}<details className="relative"><summary className="relative list-none cursor-pointer rounded-lg border border-slate-300 px-3 py-2 pr-4 text-lg leading-none" aria-label="Notifications">&#128276;{unreadCount > 0 && <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs leading-5 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span>}</summary><div className="absolute right-0 z-20 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><p className="px-2 pb-2 text-sm font-bold">Notifications</p>{notifications.length ? <div className="max-h-96 space-y-2 overflow-y-auto">{notifications.map((notification) => <div key={notification.id} className={`rounded-lg p-3 text-sm ${notification.readAt ? "bg-slate-50" : "bg-teal-50"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold">{notification.title}</p><p className="mt-1 line-clamp-2 text-slate-600">{notification.message}</p><p className="mt-1 text-xs text-slate-400">{notification.createdAt.toLocaleString("en-FI")}</p>{notification.caseId && <Link href={caseHref(notification.caseId)} className="mt-2 inline-block font-semibold text-ocean">Open case</Link>}</div>{!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id}/><button className="whitespace-nowrap text-xs font-semibold text-ocean">Mark read</button></form>}</div></div>)}</div> : <p className="px-2 py-4 text-sm text-slate-500">No notifications yet.</p>}</div></details><form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="rounded-lg border border-slate-300 px-3 py-2">Sign out</button></form></nav></div></header>;
}
