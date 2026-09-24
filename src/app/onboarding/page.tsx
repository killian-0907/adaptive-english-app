import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/auth";
export default async function OnboardingPage() { await requireAuthenticatedUser(); redirect("/assessment"); }
