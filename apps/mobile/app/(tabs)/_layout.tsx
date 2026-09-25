import { Redirect, Tabs } from "expo-router";
import { useApp } from "../../src/context";
import { Busy, Page, ErrorNotice } from "../../src/ui";
export default function Layout() {
  const app = useApp();
  if (app.loading)
    return (
      <Page title="Adaptive English">
        <Busy />
      </Page>
    );
  if (!app.session) return <Redirect href="/auth/login" />;
  if (!app.boot || app.error)
    return (
      <Page title="Adaptive English">
        <ErrorNotice error={app.error} retry={app.refresh} />
        {!app.error && <Busy />}
      </Page>
    );
  if (app.boot && app.boot.entry !== "home")
    return (
      <Redirect
        href={app.boot.entry === "onboarding" ? "/onboarding" : "/assessment"}
      />
    );
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#246858",
        tabBarLabelStyle: { fontSize: 12 },
      }}
    >
      {[
        ["home", "Home"],
        ["learn", "Learn"],
        ["progress", "My English"],
        ["history", "History"],
        ["settings", "Settings"],
      ].map(([name, title]) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ title: app.text(title) }}
        />
      ))}
    </Tabs>
  );
}
