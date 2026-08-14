import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { authenticate } from "../../lib/auth-actions";

export default function SignInPage() {
  return <main className="grid min-h-screen place-items-center bg-mist px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-soft"><Link href="/" className="font-bold text-ocean">Migrate</Link><h1 className="mt-5 text-3xl font-bold">Sign in</h1><p className="mt-2 text-slate-600">Open your cases and continue where you left off.</p><AuthForm action={authenticate} mode="sign-in" /><p className="mt-5 text-sm text-slate-600">New client? <Link className="font-semibold text-ocean" href="/sign-up">Create an account</Link></p></section></main>;
}
