import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/components/layout/login-screen";
import { LoadingScreen } from "@/components/layout/hydration-gate";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <LoginScreen />
    </Suspense>
  );
}
