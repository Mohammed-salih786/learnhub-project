"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={logout}
      disabled={isLoading}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isLoading ? "Logging out..." : "Log out"}
    </Button>
  );
}
