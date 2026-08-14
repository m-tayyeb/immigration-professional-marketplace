"use client";

import { useActionState } from "react";
import type { AuthState } from "../lib/auth-actions";

export function AuthForm({ action, mode }: { action: (state: AuthState, data: FormData) => Promise<AuthState>; mode: "sign-in" | "sign-up" }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="mt-7 space-y-4">
    {mode === "sign-up" && <Field name="name" label="Full name" />}
    <Field name="email" label="Email" type="email" />
    <Field name="password" label="Password" type="password" minLength={8} />
    {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p>}
    <button disabled={pending} className="w-full rounded-lg bg-ocean px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
  </form>;
}

function Field({ name, label, type = "text", minLength }: { name: string; label: string; type?: string; minLength?: number }) {
  return <label className="block text-sm font-semibold">{label}<input name={name} type={type} minLength={minLength} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal" /></label>;
}
