import React, { useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../navigation/types";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Screen from "../components/Screen";
import GlassButton from "../components/GlassButton";
import { Palette } from "../theme/colors";
import { useTheme } from "../theme/ThemeContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ONBOARDING_SLIDES = [
  {
    id: "1",
    icon: "dollar-sign",
    badge: "Smart Expense Splitting",
    title: "Split Flat Expenses Fairly",
    description:
      "Record room rent, groceries, wifi & utility bills. FlatSplit automatically calculates exact shares and tells you who owes whom.",
  },
  {
    id: "2",
    icon: "layers",
    badge: "Workload Fairness",
    title: "Shared Tasks & Workload",
    description:
      "Auto-assign tasks fairly, log completed work, swap duties with roommates, and track workload points in real-time!",
  },
  {
    id: "3",
    icon: "check-square",
    badge: "Democratic Flat Voting",
    title: "Group Polls & Voting",
    description:
      "Decide house rules, weekend plans, or big purchases together. Create multi-option polls and cast votes in real-time.",
  },
  {
    id: "4",
    icon: "calendar",
    badge: "Organized Expense Books",
    title: "Monthly Logs & Trip Books",
    description:
      "Keep flat expenses separate by month, trip, or event. Close books anytime to generate final settlement reports and export CSVs.",
  },
];

export default function OnboardingScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  async function completeOnboarding() {
    try {
      await AsyncStorage.setItem("@onboarding_seen", "true");
    } catch (e) {
      console.warn("Couldn't save onboarding state", e);
    }
    navigation.replace("CreateProfile");
  }

  function handleNext() {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      const nextIdx = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIdx, animated: true });
      setCurrentIndex(nextIdx);
    } else {
      completeOnboarding();
    }
  }

  return (
    <Screen edges={["top", "bottom"]}>
      {/* ── Top Header ── */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: colors.accentSoft }]}>
            <Feather name="home" size={18} color={colors.accent} />
          </View>
          <Text style={styles.brandName}>FlatSplit</Text>
        </View>

        <TouchableOpacity
          onPress={completeOnboarding}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Carousel Slider ── */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const newIdx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(newIdx);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Visual Feature Card */}
            <View style={[styles.illustrationCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
                <Feather name={item.icon as any} size={48} color={colors.accent} />
              </View>
              <View style={[styles.badge, { backgroundColor: colors.input }]}>
                <Text style={[styles.badgeText, { color: colors.accent }]}>{item.badge}</Text>
              </View>
            </View>

            {/* Slide Text */}
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{item.description}</Text>
            </View>
          </View>
        )}
      />

      {/* ── Footer / Controls ── */}
      <View style={styles.footer}>
        {/* Progress Dots */}
        <View style={styles.dotsRow}>
          {ONBOARDING_SLIDES.map((_, idx) => {
            const active = idx === currentIndex;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  active
                    ? { backgroundColor: colors.accent, width: 24 }
                    : { backgroundColor: colors.divider, width: 8 },
                ]}
              />
            );
          })}
        </View>

        {/* Primary Action Button */}
        <GlassButton
          label={currentIndex === ONBOARDING_SLIDES.length - 1 ? "Create Profile 🚀" : "Next →"}
          onPress={handleNext}
          style={styles.primaryBtn}
        />
      </View>
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 8,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    brandName: {
      fontSize: 20,
      fontWeight: "800",
      color: c.textPrimary,
      letterSpacing: -0.5,
    },
    skipText: {
      fontSize: 14,
      fontWeight: "700",
    },

    slide: {
      width: SCREEN_WIDTH,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    illustrationCard: {
      width: "100%",
      height: SCREEN_WIDTH * 0.62,
      borderRadius: 24,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 20,
      marginBottom: 28,
      gap: 16,
    },
    iconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 16,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "800",
    },

    textContainer: {
      alignItems: "center",
      paddingHorizontal: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 10,
    },
    description: {
      fontSize: 14,
      lineHeight: 22,
      textAlign: "center",
    },

    footer: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      gap: 16,
    },
    dotsRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginBottom: 8,
    },
    dot: {
      height: 8,
      borderRadius: 4,
    },
    primaryBtn: {
      width: "100%",
    },
    loginOption: {
      alignItems: "center",
      paddingVertical: 6,
    },
    loginText: {
      fontSize: 13,
    },
  });
}
