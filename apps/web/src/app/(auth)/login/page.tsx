"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { validateLoginAttempt } from "@/lib/auth";

const methodOptions = [
  { value: "phone-otp", label: "Phone OTP" },
  { value: "email-otp", label: "Email OTP" },
  { value: "google", label: "Google" }
] as const;

const roleOptions = [
  { value: "student", label: "Student" },
  { value: "instructor", label: "Instructor" },
  { value: "admin", label: "Admin" }
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [nextRoute, setNextRoute] = useState<Route>("/student");
  const [method, setMethod] = useState<(typeof methodOptions)[number]["value"]>("phone-otp");
  const [role, setRole] = useState<(typeof roleOptions)[number]["value"]>("student");
  const [formState, setFormState] = useState({ phone: "", email: "", fullName: "" });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incomingRoute = params.get("next") ?? "/student";
    setNextRoute(incomingRoute as Route);
  }, []);

  const getLoginPayload = () => {
    const credentials =
      method === "phone-otp"
        ? { phone: formState.phone }
        : method === "email-otp"
          ? { email: formState.email }
          : {
              ...(formState.email ? { email: formState.email } : {}),
              ...(formState.fullName ? { fullName: formState.fullName } : {})
            };

    return validateLoginAttempt({ method, ...credentials, role });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = getLoginPayload();

      const requestResponse = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const requestData = await requestResponse.json();
      if (!requestResponse.ok || !requestData.ok) {
        throw new Error(requestData.error ?? "Unable to send OTP.");
      }

      setIsOtpSent(true);
      setDemoOtp(requestData.demoOtp ?? null);
      setOtp("");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Validation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const payload = getLoginPayload();

      const response = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          code: otp,
          role
        })
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Invalid OTP verification.");
      }

      const requestedRoute = String(nextRoute);
      const rolePrefix = `/${role}`;
      const protectedPrefixes = ["/student", "/instructor", "/admin"];
      const requestedProtectedRoute = protectedPrefixes.some(
        (prefix) => requestedRoute === prefix || requestedRoute.startsWith(`${prefix}/`)
      );
      const destination =
        requestedProtectedRoute && !(requestedRoute === rolePrefix || requestedRoute.startsWith(`${rolePrefix}/`))
          ? (rolePrefix as Route)
          : nextRoute;
      router.push(destination);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md p-6 shadow-soft">
        <div className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">LearnHub</p>
          <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
        </div>

        <div className="mb-5 flex gap-2 rounded-xl bg-muted p-1">
          {methodOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                method === option.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setMethod(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Continue as</p>
          <div className="grid grid-cols-3 gap-2">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  role === option.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
                onClick={() => setRole(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          {method === "phone-otp" ? (
            <Input
              type="tel"
              placeholder="Phone number"
              value={formState.phone}
              onChange={(event) => setFormState((current) => ({ ...current, phone: event.target.value }))}
            />
          ) : null}

          {method === "email-otp" ? (
            <Input
              type="email"
              placeholder="Email address"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
            />
          ) : null}

          {method === "google" ? (
            <>
              <Input
                type="email"
                placeholder="Email address"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              />
              <Input
                type="text"
                placeholder="Full name"
                value={formState.fullName}
                onChange={(event) => setFormState((current) => ({ ...current, fullName: event.target.value }))}
              />
            </>
          ) : null}

          {isOtpSent ? (
            <Input
              type="text"
              inputMode="numeric"
              placeholder="Enter OTP"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
            />
          ) : null}

          {demoOtp ? (
            <p className="text-sm text-muted-foreground">
              Local development OTP: <span className="font-semibold text-foreground">{demoOtp}</span>
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!isOtpSent ? (
            <Button className="w-full" type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : method === "google" ? "Continue with Google" : "Send OTP"}
            </Button>
          ) : (
            <Button className="w-full" type="button" onClick={verifyOtp} disabled={isLoading || otp.length < 4}>
              {isLoading ? "Verifying..." : "Verify OTP"}
            </Button>
          )}
        </form>
      </Card>
    </main>
  );
}
