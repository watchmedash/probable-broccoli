import type { Metadata } from "next";
import { SignUpForm } from "@/components/AuthForms";

export const metadata: Metadata = { title: "Sign up", description: "Join Nakodu with just a username and a password.", alternates: { canonical: "/signup" } };

export default function SignUpPage() {
  return <main><SignUpForm /></main>;
}
