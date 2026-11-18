"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { signInAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";
import { Button, IconEye, IconEyeOff, Spinner, inputClass } from "./parts";

/** One password, one button. */
export function SignIn({ ready }: { ready: boolean }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="flex min-h-full items-center justify-center px-5 py-16">
      <form
        className="w-full max-w-[400px]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!password || busy) return;
          setBusy(true);
          setError(null);
          const res = await signInAction(password).catch(() => ({ ok: false as const, error: "Couldn't reach the shop. Check the internet." }));
          if (res.ok) window.location.reload();
          else {
            setError(res.error);
            setBusy(false);
          }
        }}
      >
        <Logo className="w-28 text-ink" />
        <h1 className="mt-10 text-[28px] leading-tight font-medium text-ink">Shop editor</h1>
        <p className="mt-2 text-[16px] text-ink-dim">
          {ready ? "Type the password to open it." : "The editor has no password yet. Set ADMIN_PASSWORD, then reload."}
        </p>

        <div className="relative mt-8">
          <input
            type={show ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            disabled={!ready}
            aria-label="Password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className={cn(inputClass, "h-16 pr-16 text-[20px]", error && "border-ink")}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide the password" : "Show the password"}
            className="absolute top-0 right-0 flex h-16 w-16 items-center justify-center text-ink-dim hover:text-ink"
          >
            {show ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[16px] font-medium text-ink">
            {error}
          </p>
        )}
        <Button tone="primary" size="lg" type="submit" disabled={!ready || !password || busy} className="mt-5 w-full">
          {busy && <Spinner />} Open
        </Button>
      </form>
    </main>
  );
}
