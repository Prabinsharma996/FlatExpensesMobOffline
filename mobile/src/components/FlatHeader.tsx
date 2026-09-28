import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { useFlat } from "../context/FlatContext";
import WifiSyncModal from "../offline/WifiSyncModal";

type Props = { title: string };

export default function FlatHeader({ title }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, mode, toggle } = useTheme();
  const navigation = useNavigation<any>();
  const { flatId, flatName } = useFlat();
  const [showSyncModal, setShowSyncModal] = useState(false);

  return (
    <>
      <View
        style={[
          styles.wrap,
          { paddingTop: insets.top + 10, backgroundColor: colors.card, borderBottomColor: colors.divider },
        ]}
      >
        <View style={styles.left}>
          <View style={[styles.logo, { backgroundColor: colors.accentSoft }]}>
            <Feather name="home" size={16} color={colors.accent} />
          </View>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
        </View>

        <View style={styles.right}>
          {/* Quick Wi-Fi Sync Button */}
          <TouchableOpacity
            onPress={() => setShowSyncModal(true)}
            style={[styles.syncPill, { backgroundColor: colors.accentSoft }]}
            activeOpacity={0.7}
          >
            <Feather name="wifi" size={14} color={colors.accent} />
            <Text style={[styles.syncPillText, { color: colors.accent }]}>Sync</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggle} style={styles.iconBtn} activeOpacity={0.7}>
            <Feather name={mode === "dark" ? "sun" : "moon"} size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.iconBtn} activeOpacity={0.7}>
            <Feather name="user" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <WifiSyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        flatId={flatId}
        flatName={flatName}
      />
    </>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({});
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 },
  logo: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
  syncPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  syncPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  iconBtn: { padding: 4 },
});
