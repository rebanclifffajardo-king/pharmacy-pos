import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

/** A design-system button that navigates (renders a Next.js <Link>). */
export function LinkButton({ href, ...props }: Omit<ComponentProps<typeof Button>, "render" | "nativeButton"> & { href: string }) {
  return <Button nativeButton={false} render={<Link href={href} />} {...props} />;
}
