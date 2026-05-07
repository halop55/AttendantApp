import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAuthErrorMessage,
  loginEmployee,
  subscribeAuthState,
} from "../src/services/authServices";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return subscribeAuthState((employee) => {
      if (employee) {
        router.replace("/");
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập email và mật khẩu.");
      return;
    }

    try {
      setLoading(true);
      await loginEmployee(email, password);
      router.replace("/");
    } catch (error) {
      Alert.alert("Đăng nhập thất bại", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.kicker}>Employee Portal</Text>
          <Text style={styles.title}>Đăng nhập chấm công</Text>
          <Text style={styles.subtitle}>
            Nhân viên đăng nhập bằng email công ty để check-in và check-out theo
            tài khoản cá nhân.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="employee@company.com"
            placeholderTextColor="#94A3B8"
            style={styles.input}
            value={email}
          />

          <Text style={styles.label}>Mật khẩu</Text>
          <TextInput
            onChangeText={setPassword}
            placeholder="Nhập mật khẩu"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            style={styles.input}
            value={password}
          />

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.primaryButton,
              loading && styles.disabledButton,
              pressed && !loading && styles.pressedButton,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Vào trang điểm danh</Text>
            )}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => router.push("/register")}
            style={({ pressed }) => [
              styles.linkButton,
              pressed && styles.pressedLink,
            ]}
          >
            <Text style={styles.linkText}>Tạo tài khoản nhân viên</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F3F7FF",
    flex: 1,
  },
  keyboardView: {
    alignSelf: "center",
    flex: 1,
    justifyContent: "center",
    maxWidth: 620,
    padding: 22,
    width: "100%",
  },
  header: {
    marginBottom: 24,
  },
  kicker: {
    color: "#1677FF",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 23,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE6F5",
    borderRadius: 8,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  label: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 10,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderColor: "#DCE6F5",
    borderRadius: 8,
    borderWidth: 1,
    color: "#111827",
    fontSize: 15,
    marginBottom: 18,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#1677FF",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 4,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
  pressedButton: {
    opacity: 0.86,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  linkButton: {
    alignItems: "center",
    borderRadius: 8,
    marginTop: 16,
    paddingVertical: 10,
  },
  pressedLink: {
    opacity: 0.7,
  },
  linkText: {
    color: "#1677FF",
    fontSize: 14,
    fontWeight: "800",
  },
});
