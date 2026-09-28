import React, { useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Text,
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AppStackParamList } from "../navigation/types";
import { useAuth } from "../context/AuthContext";
import { FlatApi } from "../api/endpoints";
import { apiErrorMessage } from "../api/client";
import { useTheme } from "../theme/ThemeContext";
import { Palette } from "../theme/colors";
import Screen from "../components/Screen";
import GlassCard from "../components/GlassCard";
import GlassInput from "../components/GlassInput";
import GlassButton from "../components/GlassButton";
import { Feather } from "@expo/vector-icons";
import { Flat, GroupType } from "../types";
import Chip from "../components/Chip";
import SegmentedControl from "../components/SegmentedControl";

type Props = NativeStackScreenProps<AppStackParamList, "Profile">;

const AVATAR_LIST = [
  "🦁", "🦊", "🐯", "🐼", "🐨", "🦄",
  "🦅", "🚀", "⚡", "👑", "💎", "🎯",
  "🎨", "🎧", "🍕", "🥑", "🌟", "☕",
];

const GROUP_ICON: Record<GroupType, keyof typeof Feather.glyphMap> = {
  FLAT: "home",
  TRIP: "compass",
  PARTY: "gift",
  OFFICE: "briefcase",
};

const GROUP_TYPES: { value: GroupType; label: string }[] = [
  { value: "FLAT", label: "Flat" },
  { value: "TRIP", label: "Trip" },
  { value: "PARTY", label: "Party" },
  { value: "OFFICE", label: "Office" },
];

export default function ProfileScreen({ navigation }: Props) {
  const { user, updateProfile, profiles, switchProfile, logout } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [flats, setFlats] = useState<Flat[]>([]);
  const [loadingFlats, setLoadingFlats] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [actionTab, setActionTab] = useState<"create" | "join">("create");
  const [flatName, setFlatName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("FLAT");
  const [creating, setCreating] = useState(false);

  // Edit profile state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");
  const [isChoosingAvatar, setIsChoosingAvatar] = useState(false);

  // Handle creating a flat
  async function handleCreateFlat() {
    const trimmedName = flatName.trim();
    if (!trimmedName) {
      Alert.alert("Error", "Please enter a flat name.");
      return;
    }

    setCreating(true);
    try {
      const { data } = await FlatApi.create(trimmedName, groupType);
      Alert.alert("Success", `Flat "${data.name}" created!\nShare invite code "${data.inviteCode}" with your roommates.`);
      setFlatName("");
      setGroupType("FLAT");
      navigation.navigate("FlatDetail", { flatId: data.id, flatName: data.name });
    } catch (err) {
      Alert.alert("Couldn't create flat", apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  // Load flats the user belongs to
  const loadFlats = useCallback(async () => {
    setLoadingFlats(true);
    try {
      const { data } = await FlatApi.list();
      setFlats(data);
    } catch (err) {
      Alert.alert("Error", "Could not load your flats.");
    } finally {
      setLoadingFlats(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFlats();
    }, [loadFlats])
  );

  // Handle joining another flat
  async function handleJoinFlat() {
    const trimmedCode = inviteCode.trim();
    if (!trimmedCode) {
      Alert.alert("Error", "Please enter an invite code.");
      return;
    }

    setJoining(true);
    try {
      const { data } = await FlatApi.join(trimmedCode);
      Alert.alert("Success", `You have successfully joined "${data.name}"!`);
      setInviteCode("");
      navigation.navigate("FlatDetail", { flatId: data.flatId, flatName: data.name });
    } catch (err) {
      Alert.alert("Couldn't join flat", apiErrorMessage(err));
    } finally {
      setJoining(false);
    }
  }

  async function handleSaveName() {
    if (!editName.trim()) {
      Alert.alert("Name Required", "Name cannot be blank.");
      return;
    }
    await updateProfile(editName.trim(), user?.avatar);
    setIsEditingName(false);
  }

  async function handleSelectAvatar(avatar: string) {
    await updateProfile(user?.name || "User", avatar);
    setIsChoosingAvatar(false);
  }

  return (
    <Screen edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* User Profile Header */}
          <GlassCard style={styles.profileCard}>
            <TouchableOpacity
              style={[styles.avatarContainer, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}
              onPress={() => setIsChoosingAvatar(!isChoosingAvatar)}
              activeOpacity={0.8}
            >
              <Text style={styles.avatarEmoji}>{user?.avatar || "🦁"}</Text>
              <View style={[styles.avatarEditBadge, { backgroundColor: colors.accent }]}>
                <Feather name="edit-2" size={10} color={colors.onAccent} />
              </View>
            </TouchableOpacity>

            {isEditingName ? (
              <View style={styles.nameEditRow}>
                <TextInput
                  style={[
                    styles.nameInput,
                    { color: colors.textPrimary, backgroundColor: colors.input, borderColor: colors.inputBorder },
                  ]}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.saveNameBtn, { backgroundColor: colors.accent }]}
                  onPress={handleSaveName}
                  activeOpacity={0.8}
                >
                  <Feather name="check" size={16} color={colors.onAccent} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.nameRow}
                onPress={() => {
                  setEditName(user?.name || "");
                  setIsEditingName(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name ?? "User"}</Text>
                <Feather name="edit-2" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <Text style={[styles.offlineTag, { color: colors.accent, backgroundColor: colors.accentSoft }]}>
              Offline Profile
            </Text>

            {/* Avatar Picker Accordion */}
            {isChoosingAvatar && (
              <View style={styles.avatarGridWrap}>
                <Text style={[styles.pickerTitle, { color: colors.textSecondary }]}>Pick your avatar:</Text>
                <View style={styles.avatarGrid}>
                  {AVATAR_LIST.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.avatarItem,
                        {
                          backgroundColor: user?.avatar === emoji ? colors.accentSoft : colors.input,
                          borderColor: user?.avatar === emoji ? colors.accent : colors.inputBorder,
                          borderWidth: user?.avatar === emoji ? 2 : 1,
                        },
                      ]}
                      onPress={() => handleSelectAvatar(emoji)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </GlassCard>

          {/* Switch Profile if multiple exist */}
          {profiles.length > 1 && (
            <GlassCard style={styles.switchCard}>
              <Text style={styles.sectionTitle}>Switch Profile</Text>
              <Text style={styles.sectionDescription}>Switch between users on this device:</Text>
              <View style={styles.profilesList}>
                {profiles.map((p) => {
                  const isActive = p.id === user?.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.profilePill,
                        {
                          backgroundColor: isActive ? colors.accentSoft : colors.input,
                          borderColor: isActive ? colors.accent : colors.inputBorder,
                        },
                      ]}
                      onPress={() => switchProfile(p.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={{ fontSize: 18 }}>{p.avatar || "👤"}</Text>
                      <Text
                        style={[
                          styles.profilePillName,
                          { color: isActive ? colors.accent : colors.textPrimary, fontWeight: isActive ? "800" : "600" },
                        ]}
                      >
                        {p.name} {isActive ? "(Current)" : ""}
                      </Text>
                      {isActive && <Feather name="check" size={16} color={colors.accent} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </GlassCard>
          )}

          {/* Create or Join Flat Card */}
          <GlassCard style={styles.card}>
            <SegmentedControl
              options={[
                { value: "create", label: "Create Flat" },
                { value: "join", label: "Join Flat" },
              ]}
              value={actionTab}
              onChange={setActionTab}
            />

            <View style={{ marginTop: 16 }}>
              {actionTab === "create" ? (
                <View>
                  <View style={styles.sectionHeader}>
                    <Feather name="plus-circle" size={18} color={colors.accent} />
                    <Text style={styles.sectionTitle}>Create New Flat</Text>
                  </View>
                  <Text style={styles.sectionDescription}>
                    Start a new flat group to track and split expenses with roommates.
                  </Text>

                  <Text style={styles.inputLabel}>Group Type</Text>
                  <View style={styles.chipsRow}>
                    {GROUP_TYPES.map((g) => (
                      <Chip
                        key={g.value}
                        label={g.label}
                        selected={groupType === g.value}
                        onPress={() => setGroupType(g.value)}
                      />
                    ))}
                  </View>

                  <Text style={styles.inputLabel}>Flat Name</Text>
                  <GlassInput
                    placeholder="e.g. Baker Street 221B"
                    value={flatName}
                    onChangeText={setFlatName}
                    style={styles.input}
                  />
                  <GlassButton
                    label="Create Flat Group"
                    onPress={handleCreateFlat}
                    loading={creating}
                    disabled={!flatName.trim()}
                    variant="primary"
                  />
                </View>
              ) : (
                <View>
                  <View style={styles.sectionHeader}>
                    <Feather name="log-in" size={18} color={colors.accent} />
                    <Text style={styles.sectionTitle}>Join Another Flat</Text>
                  </View>
                  <Text style={styles.sectionDescription}>
                    Enter an invite code shared by another flat owner to join their flat group.
                  </Text>
                  <GlassInput
                    placeholder="Invite Code (e.g. ABCD-1234)"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    value={inviteCode}
                    onChangeText={setInviteCode}
                    style={styles.input}
                  />
                  <GlassButton
                    label="Join Flat Group"
                    onPress={handleJoinFlat}
                    loading={joining}
                    disabled={!inviteCode.trim()}
                    variant="primary"
                  />
                </View>
              )}
            </View>
          </GlassCard>

          {/* User's Flats Section */}
          <View style={styles.flatsSection}>
            <View style={styles.sectionHeader}>
              <Feather name="home" size={18} color={colors.accent} />
              <Text style={styles.sectionTitle}>Your Current Flats</Text>
            </View>

            {loadingFlats && flats.length === 0 ? (
              <ActivityIndicator color={colors.accent} style={styles.loader} />
            ) : flats.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyText}>You are not in any flats yet.</Text>
              </GlassCard>
            ) : (
              flats.map((flat) => (
                <TouchableOpacity
                  key={flat.id}
                  activeOpacity={0.85}
                  onPress={() => navigation.navigate("FlatDetail", { flatId: flat.id, flatName: flat.name })}
                >
                  <GlassCard style={styles.flatCard}>
                    <View style={styles.flatIcon}>
                      <Feather name={GROUP_ICON[flat.groupType] || "home"} size={16} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.flatName}>{flat.name}</Text>
                      <Text style={styles.flatMeta}>
                        {flat.members.length} member{flat.members.length !== 1 ? "s" : ""} • Code: {flat.inviteCode}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color={colors.textSecondary} />
                  </GlassCard>
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Switch/New Profile Button */}
          <GlassButton
            label="Create New Profile on this Device"
            onPress={logout}
            variant="glass"
            style={styles.signOutButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    container: {
      padding: 20,
      paddingBottom: 40,
    },
    profileCard: {
      alignItems: "center",
      padding: 20,
      marginBottom: 20,
    },
    avatarContainer: {
      width: 76,
      height: 76,
      borderRadius: 38,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
      borderWidth: 2,
      position: "relative",
    },
    avatarEmoji: {
      fontSize: 38,
    },
    avatarEditBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    userName: {
      fontSize: 20,
      fontWeight: "800",
    },
    offlineTag: {
      fontSize: 11,
      fontWeight: "800",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      marginTop: 4,
    },
    nameEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 4,
    },
    nameInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 6,
      fontSize: 16,
      fontWeight: "700",
      minWidth: 160,
      textAlign: "center",
    },
    saveNameBtn: {
      padding: 8,
      borderRadius: 10,
    },
    avatarGridWrap: {
      marginTop: 16,
      width: "100%",
    },
    pickerTitle: {
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 8,
    },
    avatarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
    },
    avatarItem: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    switchCard: {
      marginBottom: 20,
      padding: 16,
    },
    profilesList: {
      gap: 8,
      marginTop: 8,
    },
    profilePill: {
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
    },
    profilePillName: {
      flex: 1,
      fontSize: 14,
    },
    card: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: c.textPrimary,
    },
    sectionDescription: {
      fontSize: 13,
      color: c.textSecondary,
      marginBottom: 14,
      lineHeight: 18,
    },
    input: {
      marginBottom: 12,
    },
    chipsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: 6,
    },
    flatsSection: {
      marginBottom: 24,
    },
    loader: {
      marginVertical: 20,
    },
    emptyCard: {
      padding: 20,
      alignItems: "center",
    },
    emptyText: {
      color: c.textSecondary,
      fontSize: 14,
    },
    flatCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 8,
    },
    flatIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    flatName: {
      fontSize: 15,
      fontWeight: "800",
      color: c.textPrimary,
    },
    flatMeta: {
      fontSize: 12,
      color: c.textSecondary,
      marginTop: 2,
    },
    signOutButton: {
      marginTop: 10,
    },
  });
}
