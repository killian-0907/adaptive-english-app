import { signInAction, signUpAction } from "./actions";

type Props = { searchParams: Promise<{ error?: string; message?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-8">
      <h1 className="text-2xl font-semibold">Welcome to Adaptive English</h1>
      {params.error ? <p role="alert">{params.error}</p> : null}
      {params.message ? <p>{params.message}</p> : null}
      <form action={signInAction} className="flex flex-col gap-3">
        <h2 className="font-medium">Sign in</h2>
        <input className="border p-2" name="email" type="email" autoComplete="email" required aria-label="Email" placeholder="Email" />
        <input className="border p-2" name="password" type="password" autoComplete="current-password" required minLength={8} aria-label="Password" placeholder="Password" />
        <button className="border p-2" type="submit">Sign in</button>
      </form>
      <form action={signUpAction} className="flex flex-col gap-3">
        <h2 className="font-medium">Create account</h2>
        <input className="border p-2" name="email" type="email" autoComplete="email" required placeholder="Email" />
        <input className="border p-2" name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Password" />
        <button className="border p-2" type="submit">Sign up</button>
      </form>
    </main>
  );
}
