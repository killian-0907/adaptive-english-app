import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireE2EEnv() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Auth E2E requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the local Supabase stack.",
    );
  }
}

test("sign up, profile trigger, sign out, protected route, and sign in work", async ({ page }) => {
  requireE2EEnv();

  const email = `foundation-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const password = "FoundationTest123!";
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  let createdUserId: string | undefined;

  try {
    await page.goto("/protected");
    await expect(page).toHaveURL(/\/login\?next=%2Fprotected|\/login\?next=\/protected/);

    await page.getByRole("heading", { name: "Authentication test" }).waitFor();
    const signUpForm = page.getByRole("heading", { name: "Create test account" }).locator("..");
    await signUpForm.getByPlaceholder("Email").fill(email);
    await signUpForm.getByPlaceholder("Password").fill(password);
    await signUpForm.getByRole("button", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/login\?message=/);
    await expect(page.getByText(/Account created/i)).toBeVisible();

    const { data: listedUsers, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    expect(listError).toBeNull();
    const createdUser = listedUsers.users.find((user) => user.email === email);
    expect(createdUser, "new Supabase Auth user should exist").toBeTruthy();
    createdUserId = createdUser!.id;

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", createdUserId)
      .single();
    expect(profileError).toBeNull();
    expect(profile?.user_id).toBe(createdUserId);

    // Local Supabase has email confirmations disabled, so sign-up creates a session.
    await page.goto("/protected");
    await expect(page.getByRole("heading", { name: "Protected route" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/protected");
    await expect(page).toHaveURL(/\/login\?next=%2Fprotected|\/login\?next=\/protected/);

    const signInForm = page.getByRole("heading", { name: "Sign in" }).locator("..");
    await signInForm.getByPlaceholder("Email").fill(email);
    await signInForm.getByPlaceholder("Password").fill(password);
    await signInForm.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/protected$/);
    await expect(page.getByText(email)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    if (createdUserId) {
      const { error } = await admin.auth.admin.deleteUser(createdUserId);
      expect(error).toBeNull();
    }
  }
});
