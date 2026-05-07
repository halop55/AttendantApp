import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import StatusCard from "../src/components/StatusCard";
import {
  API_URL,
  checkIn,
  checkOut,
  formatApiError,
  getTodayAttendance,
  healthCheck,
  setAuthToken,
} from "../src/services/api";
import {
  getCurrentEmployeeToken,
  logoutEmployee,
  subscribeAuthState,
} from "../src/services/authServices";

function ActionButton({ label, onPress, variant = "primary", disabled, busy }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        buttonVariants[variant],
        (disabled || busy) && styles.disabledButton,
        pressed && !disabled && !busy && styles.pressedButton,
      ]}
    >
      {busy ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.actionButtonText}>{label}</Text>
      )}
    </Pressable>
  );
}

function LoadingScreen({ text }) {
  return (
    <View style={styles.loadingScreen}>
      <StatusBar style="dark" />
      <ActivityIndicator color="#1677FF" size="large" />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

function SystemStatus({ status, message }) {
  const isOnline = status === "online";
  const isChecking = status === "checking";

  return (
    <View style={styles.systemPanel}>
      <View style={styles.systemHeader}>
        <View style={styles.systemTextColumn}>
          <Text style={styles.sectionLabel}>Kết nối backend</Text>
          <Text style={styles.apiUrl}>{API_URL}</Text>
        </View>
        <View
          style={[
            styles.connectionPill,
            isOnline && styles.onlinePill,
            !isOnline && !isChecking && styles.offlinePill,
          ]}
        >
          <Text style={styles.connectionText}>
            {isChecking ? "Đang kiểm tra" : isOnline ? "Online" : "Offline"}
          </Text>
        </View>
      </View>
      <Text style={styles.systemMessage}>{message}</Text>
    </View>
  );
}

export default function AttendanceDashboard() {
  const [employee, setEmployee] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [note, setNote] = useState("");
  const [today, setToday] = useState(null);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [backendMessage, setBackendMessage] = useState("Đang kiểm tra API");
  const [loadingAction, setLoadingAction] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    []
  );

  const refreshEmployeeToken = useCallback(async () => {
    const token = await getCurrentEmployeeToken();

    if (!token) {
      setAuthToken("");
      router.replace("/login");
      throw new Error("Vui lòng đăng nhập lại.");
    }

    setAuthToken(token);
    return token;
  }, []);

  const testBackend = useCallback(async ({ showAlert = false } = {}) => {
    setBackendStatus("checking");

    try {
      const result = await healthCheck();
      const message = result.message || "Attendance API is running";
      setBackendStatus("online");
      setBackendMessage(message);

      if (showAlert) {
        Alert.alert("Backend OK", message);
      }
    } catch (error) {
      const message = formatApiError(error);
      setBackendStatus("offline");
      setBackendMessage(message);

      if (showAlert) {
        Alert.alert("Lỗi backend", message);
      }
    }
  }, []);

  const loadToday = useCallback(
    async ({ showAlert = false, spinner = false } = {}) => {
      if (spinner) {
        setLoadingAction("refresh");
      }

      try {
        await refreshEmployeeToken();
        const result = await getTodayAttendance();
        setToday(result.data);
      } catch (error) {
        const message = formatApiError(error);

        if (showAlert) {
          Alert.alert("Lỗi tải dữ liệu", message);
        }
      } finally {
        if (spinner) {
          setLoadingAction("");
        }
      }
    },
    [refreshEmployeeToken]
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([testBackend(), loadToday()]);
    setRefreshing(false);
  }, [loadToday, testBackend]);

  const runAttendanceAction = useCallback(
    async (action, successTitle, successMessage, errorTitle, actionName) => {
      setLoadingAction(actionName);

      try {
        await refreshEmployeeToken();
        const result = await action(note);
        setToday(result.data);
        setNote("");
        Alert.alert(successTitle, successMessage);
      } catch (error) {
        Alert.alert(errorTitle, formatApiError(error));
      } finally {
        setLoadingAction("");
      }
    },
    [note, refreshEmployeeToken]
  );

  const handleLogout = useCallback(async () => {
    try {
      setLoadingAction("logout");
      await logoutEmployee();
      setAuthToken("");
      setToday(null);
      router.replace("/login");
    } catch (error) {
      Alert.alert("Đăng xuất thất bại", formatApiError(error));
    } finally {
      setLoadingAction("");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeAuthState(async (nextEmployee) => {
      if (!mounted) return;

      setEmployee(nextEmployee);
      setAuthReady(true);

      if (!nextEmployee) {
        setAuthToken("");
        setToday(null);
        router.replace("/login");
        return;
      }

      try {
        const token = await getCurrentEmployeeToken(true);
        if (mounted) {
          setAuthToken(token);
        }
      } catch (_error) {
        setAuthToken("");
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authReady && employee) {
      refreshAll();
    }
  }, [authReady, employee, refreshAll]);

  useEffect(() => {
    return () => {
      setAuthToken("");
    };
  }, []);

  if (!authReady) {
    return <LoadingScreen text="Đang kiểm tra đăng nhập" />;
  }

  if (!employee) {
    return <LoadingScreen text="Đang chuyển tới trang đăng nhập" />;
  }

  const isBusy = Boolean(loadingAction);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTitleColumn}>
              <Text style={styles.companyLabel}>Company Attendance</Text>
              <Text style={styles.title}>Chấm công nhân viên</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={loadingAction === "logout"}
              onPress={handleLogout}
              style={({ pressed }) => [
                styles.logoutButton,
                pressed && styles.pressedLink,
              ]}
            >
              <Text style={styles.logoutButtonText}>
                {loadingAction === "logout" ? "Đang thoát" : "Đăng xuất"}
              </Text>
            </Pressable>
          </View>
          <Text style={styles.dateText}>{todayLabel}</Text>
          <View style={styles.employeePill}>
            <Text style={styles.employeePillLabel}>Nhân viên</Text>
            <Text style={styles.employeePillText}>{employee.email}</Text>
          </View>
        </View>

        <SystemStatus status={backendStatus} message={backendMessage} />

        <StatusCard today={today} />

        <View style={styles.formPanel}>
          <Text style={styles.sectionLabel}>Ghi nhận ca làm</Text>
          <TextInput
            multiline
            onChangeText={setNote}
            placeholder="Ghi chú ca làm"
            placeholderTextColor="#94A3B8"
            style={styles.noteInput}
            textAlignVertical="top"
            value={note}
          />

          <View style={styles.buttonGrid}>
            <ActionButton
              busy={loadingAction === "checkIn"}
              disabled={isBusy}
              label="Check-in"
              onPress={() =>
                runAttendanceAction(
                  checkIn,
                  "Check-in",
                  "Đã ghi nhận giờ vào.",
                  "Check-in thất bại",
                  "checkIn"
                )
              }
            />
            <ActionButton
              busy={loadingAction === "checkOut"}
              disabled={isBusy}
              label="Check-out"
              onPress={() =>
                runAttendanceAction(
                  checkOut,
                  "Check-out",
                  "Đã ghi nhận giờ ra.",
                  "Check-out thất bại",
                  "checkOut"
                )
              }
              variant="warning"
            />
          </View>

          <ActionButton
            busy={loadingAction === "refresh"}
            disabled={isBusy}
            label="Tải lại dữ liệu"
            onPress={() => loadToday({ showAlert: true, spinner: true })}
            variant="secondary"
          />
        </View>

        <View style={styles.accountPanel}>
          <Text style={styles.sectionLabel}>Tài khoản Firebase</Text>
          <Text style={styles.accountText}>
            Email đăng nhập này được gửi lên backend bằng Firebase ID token để
            mỗi nhân viên có dữ liệu điểm danh riêng.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => testBackend({ showAlert: true })}
            style={({ pressed }) => [
              styles.linkButton,
              pressed && styles.pressedLink,
            ]}
          >
            <Text style={styles.linkButtonText}>Kiểm tra backend</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F6F7F9",
    flex: 1,
  },
  loadingScreen: {
    alignItems: "center",
    backgroundColor: "#F3F7FF",
    flex: 1,
    justifyContent: "center",
    padding: 22,
  },
  loadingText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 14,
    textAlign: "center",
  },
  content: {
    alignSelf: "center",
    maxWidth: 720,
    padding: 20,
    paddingBottom: 36,
    width: "100%",
  },
  header: {
    marginBottom: 18,
    marginTop: 34,
  },
  headerTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  headerTitleColumn: {
    flex: 1,
  },
  companyLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: "#0F172A",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 36,
  },
  logoutButton: {
    backgroundColor: "#E8F0FE",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  logoutButtonText: {
    color: "#1677FF",
    fontSize: 13,
    fontWeight: "900",
  },
  dateText: {
    color: "#64748B",
    fontSize: 15,
    marginTop: 6,
    textTransform: "capitalize",
  },
  employeePill: {
    alignItems: "flex-start",
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#DCE6F5",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  employeePillLabel: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },
  employeePillText: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "900",
  },
  systemPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  systemHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  systemTextColumn: {
    flex: 1,
  },
  sectionLabel: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  apiUrl: {
    color: "#64748B",
    flexShrink: 1,
    fontSize: 12,
  },
  connectionPill: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  onlinePill: {
    backgroundColor: "#DCFCE7",
  },
  offlinePill: {
    backgroundColor: "#FEE2E2",
  },
  connectionText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
  },
  systemMessage: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  formPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  noteInput: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0F172A",
    fontSize: 15,
    minHeight: 92,
    padding: 12,
  },
  buttonGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  primaryButton: {
    backgroundColor: "#047857",
  },
  warningButton: {
    backgroundColor: "#C2410C",
  },
  secondaryButton: {
    backgroundColor: "#334155",
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    opacity: 0.86,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  accountPanel: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  accountText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },
  linkButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  pressedLink: {
    opacity: 0.7,
  },
  linkButtonText: {
    color: "#0F766E",
    fontSize: 14,
    fontWeight: "800",
  },
});

const buttonVariants = {
  primary: styles.primaryButton,
  secondary: styles.secondaryButton,
  warning: styles.warningButton,
};
