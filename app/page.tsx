"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth < 768) {
      router.replace("/mobile");
    }
  }, [router]);
  return <Dashboard />;
}