import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import Screen from "../components/Screen";
import GlassCard from "../components/GlassCard";
import GlassButton from "../components/GlassButton";
import { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";

const AVATAR_LIST = [
  "🦁", "🦊", "🐯", "🐼", "🐨", "🦄",
  "🦅", "🚀", "⚡", "👑", "💎", "🎯",
  "🎨", "🎧", "🍕", "🥑", "🌟", "☕",
];

export default function CreateProfileScreen() {
  const { createProfile, profiles, switchProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦁");
  const [loading, setLoading] = useState(false);

  async function handleCreateProfile() {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert("Name Required", "Please enter your name or nickname to continue.");
      return;
    }

    setLoading(true);
    try {
      await createProfile(cleanName, selectedAvatar);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to create profile.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectExistingProfile(userId: number) {
    try {
      await switchProfile(userId);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to switch profile.");
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          <View style={styles.brandWrap}>
            <View style={[styles.avatarPreview, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={styles.avatarPreviewEmoji}>{selectedAvatar}</Text>
            </View>
            <Text style={styles.brandTitle}>Welcome to FlatSplit</Text>
            <Text style={styles.brandTagline}>
              Choose your avatar & enter your name to start tracking expenses offline
            </Text>
          </View>

          {/* Create Profile Card */}
          <GlassCard style={styles.card}>
            <Text style={styles.cardTitle}>Set up your profile</Text>

            {/* Name Input */}
            <Text style={styles.inputLabel}>YOUR NAME / NICKNAME</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={18} color={colors.accent} style={styles.inputIcon} />
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.textPrimary,
                    backgroundColor: colors.input,
                    borderColor: colors.inputBorder,
                  },
                ]}
                placeholder="e.g. Alex, Sam, Prabin..."
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={30}
              />
            </View>

            {/* Avatar Grid Selection */}
            <Text style={[styles.inputLabel, { marginTop: 18 }]}>CHOOSE YOUR AVATAR</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_LIST.map((emoji) => {
                const isSelected = selectedAvatar === emoji;
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.avatarItem,
                      {
                        backgroundColor: isSelected ? colors.accentSoft : colors.input,
                        borderColor: isSelected ? colors.accent : colors.inputBorder,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => setSelectedAvatar(emoji)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.avatarEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <GlassButton
              label="Get Started 🚀"
              onPress={handleCreateProfile}
              loading={loading}
              disabled={!name.trim()}
              style={styles.submitBtn}
            />
          </GlassCard>

          {/* Existing Profiles on this Device */}
          {profiles.length > 0 && (
            <View style={styles.existingSection}>
              <Text style={styles.existingTitle}>Or switch to an existing profile:</Text>
              <View style={styles.profilesList}>
                {profiles.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[
                      styles.profilePill,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                    onPress={() => handleSelectExistingProfile(p.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.profilePillEmoji}>{p.avatar || "👤"}</Text>
                    <Text style={[styles.profilePillName, { color: colors.textPrimary }]}>
                      {p.name}
                    </Text>
                    <Feather name="chevron-right" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    scrollContainer: {
      flexGrow: 1,
      justifyContent: "center",
      padding: 24,
      paddingTop: 40,
      paddingBottom: 40,
    },
    brandWrap: {
      alignItems: "center",
      marginBottom: 24,
    },
    avatarPreview: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      marginBottom: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    avatarPreviewEmoji: {
      fontSize: 40,
    },
    brandTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    brandTagline: {
      textAlign: "center",
      color: c.textSecondary,
      marginTop: 6,
      fontSize: 13,
      lineHeight: 19,
      maxWidth: 280,
    },
    card: {
      padding: 20,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: c.textPrimary,
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textSecondary,
      letterSpacing: 0.5,
      marginBottom: 8,
    },
    inputWrap: {
      position: "relative",
      justifyContent: "center",
    },
    inputIcon: {
      position: "absolute",
      left: 14,
      zIndex: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: 14,
      paddingVertical: 14,
      paddingLeft: 44,
      paddingRight: 16,
      fontSize: 16,
      fontWeight: "600",
    },
    avatarGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "space-between",
    },
    avatarItem: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarEmoji: {
      fontSize: 24,
    },
    submitBtn: {
      marginTop: 22,
    },
    existingSection: {
      marginTop: 24,
      alignItems: "center",
    },
    existingTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: c.textSecondary,
      marginBottom: 12,
    },
    profilesList: {
      width: "100%",
      gap: 8,
    },
    profilePill: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 1,
      gap: 10,
    },
    profilePillEmoji: {
      fontSize: 20,
    },
    profilePillName: {
      flex: 1,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
