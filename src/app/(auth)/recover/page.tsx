import type { Metadata } from "next";
import { RecoverForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function RecoverPage() {
  return <main><RecoverForm /></main>;
}
