import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/server/auth";
export default async function ProtectedPage(){await requireAuthenticatedUser();redirect("/home");}
