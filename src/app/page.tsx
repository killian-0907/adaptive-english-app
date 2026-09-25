import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/server/auth";

export default async function HomePage() {
  if(await getAuthenticatedUser())redirect("/home");
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Adaptive English</h1>
      <p>Find a comfortable starting point for useful, everyday English. 从适合你的起点开始。</p>
      <div className="flex gap-4">
        <Link className="underline" href="/assessment">Get started / 开始学习</Link>
        <Link className="underline" href="/login">Sign in</Link>
      </div>
    </main>
  );
}
