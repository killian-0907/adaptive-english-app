import { Stack, type ErrorBoundaryProps } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text, Pressable, View } from "react-native";
import { AppProvider } from "../src/context";
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 32 }}>
      <Text>
        Adaptive English could not open this screen. 无法打开此页面。 No se pudo
        abrir esta pantalla.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={{ padding: 20 }}
      >
        <Text>Try again / 重试 / Reintentar</Text>
      </Pressable>
    </View>
  );
}
export default function Root() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AppProvider>
    </SafeAreaProvider>
  );
}
