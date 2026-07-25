import { useState } from "react"
import { NavigationContainer } from "@react-navigation/native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import LoginScreen from "./src/screens/LoginScreen"
import AppNavigator from "./src/navigation/AppNavigator"

export default function App() {
  const [user, setUser] = useState<any>(null)

  if (!user) return <LoginScreen onLogin={setUser} />

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
