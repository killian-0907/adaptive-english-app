import { requireAuthenticatedUser } from "@/server/auth";
import { signOutAction } from "@/app/login/actions";

export default async function ProtectedPage() {
  const user = await requireAuthenticatedUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Protected route</h1>
      <p>Signed in as {user.email ?? user.id}.</p>
      <form action={signOutAction}><button className="border p-2" type="submit">Sign out</button></form>
    </main>
  );
}
