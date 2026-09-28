import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/types";
import { FlatApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { Flat, GroupType } from "../types";
import { useAuth } from "../context/AuthContext";
import { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";
import Screen from "../components/Screen";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import FlatOnboardingForm from "../components/FlatOnboardingForm";
import WifiSyncModal from "../offline/WifiSyncModal";

type Props = NativeStackScreenProps<AppStackParamList, "Flats">;

const GROUP_ICON: Record<GroupType, keyof typeof Feather.glyphMap> = {
  FLAT: "home",
  TRIP: "compass",
  PARTY: "gift",
  OFFICE: "briefcase",
};

export default function FlatsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await FlatApi.list();
      setFlats(data);
    } catch (err) {
      Alert.alert("Couldn't load flats", apiErrorMessage(err));
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleCreate(name: string, groupType: GroupType) {
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await FlatApi.create(name, groupType);
      Alert.alert("Flat created", `Share invite code "${data.inviteCode}" with your roommates.`);
      navigation.replace("FlatDetail", { flatId: data.id, flatName: data.name });
    } catch (err) {
      Alert.alert("Couldn't create flat", apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(inviteCode: string) {
    if (!inviteCode) return;
    setJoining(true);
    try {
      const { data } = await FlatApi.join(inviteCode);
      navigation.replace("FlatDetail", { flatId: data.flatId, flatName: data.name });
    } catch (err) {
      Alert.alert("Couldn't join flat", apiErrorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  const profileButton = (
    <TouchableOpacity onPress={() => navigation.navigate("Profile")} style={styles.signOut} activeOpacity={0.7}>
      <Feather name="user" size={16} color={colors.accent} />
      <Text style={[styles.signOutText, { color: colors.accent }]}>Profile</Text>
    </TouchableOpacity>
  );

  if (!loaded) {
    return (
      <Screen edges={["top", "bottom"]}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 60 }} />
      </Screen>
    );
  }

  if (flats.length === 0) {
    return (
      <Screen edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.onboardingContent}>
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => setShowSyncModal(true)}
              style={[styles.syncHeaderBtn, { backgroundColor: colors.accentSoft }]}
              activeOpacity={0.7}
            >
              <Feather name="wifi" size={14} color={colors.accent} />
              <Text style={[styles.syncHeaderBtnText, { color: colors.accent }]}>Wi-Fi Sync</Text>
            </TouchableOpacity>
            {profileButton}
          </View>
          <Text style={styles.welcomeTitle}>Welcome to{"\n"}FlatSplit</Text>
          <Text style={styles.welcomeSubtitle}>
            100% Offline with Local Wi-Fi Sync. Create a flat or sync with your flatmates.
          </Text>
          <FlatOnboardingForm creating={creating} joining={joining} onCreate={handleCreate} onJoin={handleJoin} />
        </ScrollView>

        <WifiSyncModal
          visible={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onSyncComplete={load}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name ?? "there"} 👋</Text>
          <Text style={styles.subGreeting}>Your flats (Offline & Local Wi-Fi Sync)</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity
            onPress={() => setShowSyncModal(true)}
            style={[styles.syncHeaderBtn, { backgroundColor: colors.accentSoft }]}
            activeOpacity={0.7}
          >
            <Feather name="wifi" size={14} color={colors.accent} />
            <Text style={[styles.syncHeaderBtnText, { color: colors.accent }]}>Wi-Fi Sync</Text>
          </TouchableOpacity>
          {profileButton}
        </View>
      </View>

      <View style={styles.actionsRow}>
        <GlassButton label="Create Flat" icon="＋" onPress={() => navigation.navigate("CreateFlat")} style={styles.actionButton} />
        <GlassButton
          label="Join Flat"
          icon="🔑"
          variant="glass"
          onPress={() => navigation.navigate("CreateFlat", { initialTab: "join" })}
          style={styles.actionButton}
        />
      </View>

      <FlatList
        data={flats}
        keyExtractor={(f) => String(f.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("FlatDetail", { flatId: item.id, flatName: item.name })}
          >
            <GlassCard style={styles.flatCard}>
              <View style={styles.flatIcon}>
                <Feather name={GROUP_ICON[item.groupType]} size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.flatName}>{item.name}</Text>
                <Text style={styles.flatMeta}>
                  {item.members.length} member{item.members.length !== 1 ? "s" : ""}
                </Text>
                <View style={styles.codeBadge}>
                  <Text style={styles.codeBadgeText}>Invite code: {item.inviteCode}</Text>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>
        )}
      />

      <WifiSyncModal
        visible={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={load}
      />
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    signOut: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
    signOutText: { color: c.textSecondary, fontWeight: "700", fontSize: 13 },
    syncHeaderBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },
    syncHeaderBtnText: {
      fontSize: 12,
      fontWeight: "800",
    },

    onboardingContent: { padding: 20, paddingBottom: 40 },
    welcomeTitle: { fontSize: 30, fontWeight: "800", color: c.textPrimary, textAlign: "center", marginTop: 8, lineHeight: 36 },
    welcomeSubtitle: {
      fontSize: 14,
      color: c.textSecondary,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 28,
      lineHeight: 20,
      paddingHorizontal: 10,
    },

    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 8 },
    greeting: { fontSize: 24, fontWeight: "800", color: c.textPrimary },
    subGreeting: { fontSize: 13, color: c.textSecondary, marginTop: 2 },

    actionsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 20, marginBottom: 8 },
    actionButton: { flex: 1 },

    list: { padding: 20, paddingTop: 12, paddingBottom: 40, gap: 12 },

    flatCard: { flexDirection: "row", alignItems: "center", gap: 14 },
    flatIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" },
    flatName: { fontSize: 17, fontWeight: "800", color: c.textPrimary },
    flatMeta: { color: c.textSecondary, marginTop: 2, fontSize: 13 },
    codeBadge: { alignSelf: "flex-start", backgroundColor: c.accentSoft, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginTop: 8 },
    codeBadgeText: { color: c.accent, fontWeight: "700", fontSize: 12 },
  });
}
