import { requireAuthenticatedUser } from "@/server/auth";
import { learningView } from "@/server/services/learning";
import { LearningClient } from "./ui";
export default async function LearningPage(){const user=await requireAuthenticatedUser();return <LearningClient initial={await learningView(user.id)}/>;}
