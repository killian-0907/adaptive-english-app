import { Redirect } from "expo-router";
import { useApp } from "../src/context";
import { Page, Busy, ErrorNotice } from "../src/ui";
export default function Entry() {
  const app = useApp();
  if (app.loading || app.error)
    return (
      <Page title="Adaptive English">
        <ErrorNotice error={app.error} retry={app.refresh} />
        {app.loading && <Busy />}
      </Page>
    );
  if (!app.session) return <Redirect href="/auth/login" />;
  if (!app.boot)
    return (
      <Page title="Adaptive English">
        <Busy />
      </Page>
    );
  return (
    <Redirect
      href={
        app.boot.entry === "home"
          ? "/(tabs)/home"
          : app.boot.entry === "onboarding"
            ? "/onboarding"
            : "/assessment"
      }
    />
  );
}
