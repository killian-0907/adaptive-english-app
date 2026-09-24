import { requireAuthenticatedUser } from "@/server/auth";
import { AssessmentClient } from "./ui";
import { assessmentView } from "@/server/services/assessment";
export default async function AssessmentPage() {
  const user=await requireAuthenticatedUser();
  return <AssessmentClient initialView={await assessmentView(user.id)}/>;
}
