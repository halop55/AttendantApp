import { View, Text, StyleSheet } from "react-native";

function formatTime(value) {
  if (!value) return "Chưa có";

  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getAttendanceStatus(today) {
  if (!today?.checkin_at) {
    return {
      label: "Chưa check-in",
      tone: styles.neutralPill,
      text: "Nhân viên chưa bắt đầu ca làm hôm nay.",
    };
  }

  if (!today.checkout_at) {
    return {
      label: "Đang làm việc",
      tone: styles.activePill,
      text: "Ca làm đang được ghi nhận.",
    };
  }

  return {
    label: "Đã hoàn tất",
    tone: styles.donePill,
    text: "Nhân viên đã check-out trong ngày.",
  };
}

function DetailRow({ label, value }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function StatusCard({ today }) {
  const status = getAttendanceStatus(today);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Trạng thái hôm nay</Text>
          <Text style={styles.statusText}>{status.text}</Text>
        </View>
        <View style={[styles.pill, status.tone]}>
          <Text style={styles.pillText}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <DetailRow
        label="Check-in"
        value={formatTime(today?.checkin_at)}
      />
      <DetailRow
        label="Check-out"
        value={formatTime(today?.checkout_at)}
      />
      <DetailRow label="Email" value={today?.employee_email || "Chưa có"} />
      <DetailRow label="Ghi chú" value={today?.note || "Không có"} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  statusText: {
    color: "#64748B",
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  neutralPill: {
    backgroundColor: "#E2E8F0",
  },
  activePill: {
    backgroundColor: "#DCFCE7",
  },
  donePill: {
    backgroundColor: "#DBEAFE",
  },
  pillText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "800",
  },
  divider: {
    backgroundColor: "#E2E8F0",
    height: 1,
    marginVertical: 14,
  },
  detailRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  detailLabel: {
    color: "#64748B",
    fontSize: 13,
    minWidth: 78,
  },
  detailValue: {
    color: "#0F172A",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
});
