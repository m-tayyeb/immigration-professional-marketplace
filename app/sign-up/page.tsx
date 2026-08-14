import Link from "next/link";
import { AuthForm } from "../../components/auth-form";
import { createAccount } from "../../lib/auth-actions";

export default function SignUpPage() {
  return <main className="grid min-h-screen place-items-center bg-mist px-5"><section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-soft"><Link href="/" className="font-bold text-ocean">Migrate</Link><h1 className="mt-5 text-3xl font-bold">Create your client account</h1><p className="mt-2 text-slate-600">Your cases and private documents stay linked to this account.</p><AuthForm action={createAccount} mode="sign-up" /><p className="mt-5 text-sm text-slate-600">Already registered? <Link className="font-semibold text-ocean" href="/sign-in">Sign in</Link></p></section></main>;
}
