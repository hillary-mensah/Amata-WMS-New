"use client";

import { redirect } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Sidebar, Header } from "@/components/layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar />
      <div className="flex-1 ml-[280px]">
        <Header />
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
