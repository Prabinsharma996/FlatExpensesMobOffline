import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, G, Path, Text as SvgText } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { TaskApi } from "../api/endpoints";
import { useTheme } from "../theme/ThemeContext";
import { Palette } from "../theme/colors";
import { FlatMember, TaskDifficulty } from "../types";
import GlassButton from "./GlassButton";
import GlassCard from "./GlassCard";

type Props = {
  visible: boolean;
  flatId: number;
  members: FlatMember[];
  onClose: () => void;
  onCreated: () => void;
};

type SpinParticipant = {
  id: string;
  name: string;
  isGuest: boolean;
  userId?: number;
};

const QUICK_FUN_TASKS = [
  { title: "Toilet Cleaning 🚽", category: "Bathroom", difficulty: "HARD" },
  { title: "Wash All Dishes 🍽️", category: "Dishes", difficulty: "MEDIUM" },
  { title: "Take Out Garbage 🗑️", category: "Garbage", difficulty: "EASY" },
  { title: "Deep Clean Kitchen 🧹", category: "Cleaning", difficulty: "HARD" },
  { title: "Cook Surprise Dinner 🍳", category: "Cooking", difficulty: "MEDIUM" },
  { title: "Water House Plants 🌱", category: "Plants", difficulty: "EASY" },
];

const VIBRANT_WHEEL_COLORS = [
  "#FF4757", // Coral Red
  "#2ED573", // Emerald Green
  "#FFA502", // Electric Amber
  "#1E90FF", // Royal Blue
  "#9B5DE5", // Bright Purple
  "#FF007F", // Hot Pink
  "#00D2D3", // Turquoise
  "#FF6B6B", // Pastel Red
  "#70A1FF", // Sky Blue
  "#5352ED", // Indigo
  "#FF7F50", // Coral
  "#00B894", // Mint Green
];

const MEMBER_EMOJIS = ["👑", "⚡", "🎯", "🌟", "🔥", "🚀", "💎", "🏆", "🦄", "🍀"];

function createPieSlicePath(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number) {
  const angleDiff = endAngleDeg - startAngleDeg;
  if (angleDiff >= 359.99) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  const startRad = (startAngleDeg - 90) * (Math.PI / 180);
  const endRad = (endAngleDeg - 90) * (Math.PI / 180);

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArcFlag = angleDiff > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
}

export default function TaskSpinWheelModal({
  visible,
  flatId,
  members,
  onClose,
  onCreated,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [taskTitle, setTaskTitle] = useState("Toilet Cleaning 🚽");
  const [category, setCategory] = useState("Bathroom");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("HARD");

  const [extraMembers, setExtraMembers] = useState<string[]>([]);
  const [excludedUserIds, setExcludedUserIds] = useState<number[]>([]);
  const [newGuestName, setNewGuestName] = useState("");

  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState<SpinParticipant | null>(null);
  const [saving, setSaving] = useState(false);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const [currentRotationAngle, setCurrentRotationAngle] = useState(0);

  const allSpinParticipants = useMemo<SpinParticipant[]>(() => {
    const base: SpinParticipant[] = (
      members && members.length > 0
        ? members
        : [{ userId: 1, user: { id: 1, name: "Someone", email: "" }, role: "MEMBER" }]
    )
      .filter((m) => !excludedUserIds.includes(m.userId))
      .map((m) => ({
        id: `member_${m.userId}`,
        name: m.user.name,
        isGuest: false,
        userId: m.userId,
      }));

    const guests: SpinParticipant[] = extraMembers.map((name, idx) => ({
      id: `guest_${idx}_${name}`,
      name,
      isGuest: true,
    }));

    return [...base, ...guests];
  }, [members, extraMembers, excludedUserIds]);

  function handleAddGuest() {
    const trimmed = newGuestName.trim();
    if (!trimmed) return;
    if (allSpinParticipants.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Already added", `"${trimmed}" is already on the wheel!`);
      return;
    }
    setExtraMembers((prev) => [...prev, trimmed]);
    setNewGuestName("");
  }

  function handleRemoveMember(p: SpinParticipant) {
    if (p.isGuest) {
      setExtraMembers((prev) => prev.filter((n) => n !== p.name));
    } else if (p.userId) {
      setExcludedUserIds((prev) => [...prev, p.userId!]);
    }
  }

  function handleRestoreMember(userId: number) {
    setExcludedUserIds((prev) => prev.filter((id) => id !== userId));
  }

  function handleSpin() {
    if (isSpinning) return;
    if (!taskTitle.trim()) {
      Alert.alert("Task Required", "Please select or enter a task to spin for!");
      return;
    }
    if (allSpinParticipants.length < 1) {
      Alert.alert("No participants", "Please add at least 1 member to spin the wheel!");
      return;
    }

    setWinner(null);
    setIsSpinning(true);

    const randomIndex = Math.floor(Math.random() * allSpinParticipants.length);
    const sliceAngle = 360 / allSpinParticipants.length;
    const targetSliceCenter = randomIndex * sliceAngle + sliceAngle / 2;
    const extraSpins = 360 * 8; // 8 full rotations
    const totalRotation = currentRotationAngle + extraSpins + (360 - targetSliceCenter);

    spinAnim.setValue(currentRotationAngle % 360);

    Animated.timing(spinAnim, {
      toValue: totalRotation,
      duration: 5000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentRotationAngle(totalRotation);
      setIsSpinning(false);
      setWinner(allSpinParticipants[randomIndex]);
    });
  }

  async function handleAssignTask() {
    if (!winner) return;
    setSaving(true);
    try {
      if (winner.userId) {
        await TaskApi.create(flatId, {
          title: taskTitle.trim(),
          description: `Wheel of Fate randomly assigned this task to ${winner.name}! 🎯`,
          category,
          difficulty,
          taskType: "ONE_TIME",
          assignmentType: "MANUAL",
          assignedUserId: winner.userId,
        });
        Alert.alert(
          "Task Assigned! 🎉",
          `"${taskTitle}" has been officially assigned to ${winner.name}!`
        );
      } else {
        await TaskApi.create(flatId, {
          title: `${taskTitle.trim()} (Assigned to ${winner.name})`,
          description: `Wheel of Fate assigned task to guest "${winner.name}"! 🎯`,
          category,
          difficulty,
          taskType: "ONE_TIME",
          assignmentType: "AUTO_FAIR",
        });
        Alert.alert(
          "Task Created! 🎉",
          `Created "${taskTitle}" for guest ${winner.name}!`
        );
      }
      onCreated();
      onClose();
    } catch (err: any) {
      Alert.alert("Error creating task", err?.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  const rotateInterpolate = spinAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  const SVG_SIZE = 260;
  const CENTER = SVG_SIZE / 2;
  const RADIUS = CENTER - 6;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={{ fontSize: 24 }}>🎡</Text>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Wheel of Fate</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Randomly spin among flatmates & guests to decide who takes on the task!
            </Text>

            {/* Quick Task Selection */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>SELECT TASK TO SPIN FOR:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {QUICK_FUN_TASKS.map((t) => {
                const active = taskTitle === t.title;
                return (
                  <TouchableOpacity
                    key={t.title}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? colors.accent : colors.input },
                    ]}
                    onPress={() => {
                      setTaskTitle(t.title);
                      setCategory(t.category);
                      setDifficulty(t.difficulty as TaskDifficulty);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.onAccent : colors.textPrimary }]}>
                      {t.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.input, borderColor: colors.inputBorder }]}
              placeholder="Or enter custom task e.g. Clean Bathroom Mirror"
              placeholderTextColor={colors.textSecondary}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            {/* ── Wheel Participants Section ── */}
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 4 }]}>
              WHEEL PARTICIPANTS ({allSpinParticipants.length}):
            </Text>
            <View style={styles.participantRow}>
              {allSpinParticipants.map((p, idx) => (
                <View
                  key={p.id}
                  style={[
                    styles.participantBadge,
                    {
                      backgroundColor: VIBRANT_WHEEL_COLORS[idx % VIBRANT_WHEEL_COLORS.length],
                    },
                  ]}
                >
                  <Text style={styles.participantText}>
                    {MEMBER_EMOJIS[idx % MEMBER_EMOJIS.length]} {p.name} {p.isGuest ? "(Guest)" : ""}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveMember(p)} style={styles.removeGuestBtn} activeOpacity={0.7}>
                    <Feather name="x" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Excluded Members (Tap to Add Back) */}
            {excludedUserIds.length > 0 && (
              <View style={{ marginBottom: 10 }}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>EXCLUDED MEMBERS (TAP TO ADD BACK):</Text>
                <View style={styles.participantRow}>
                  {members
                    .filter((m) => excludedUserIds.includes(m.userId))
                    .map((m) => (
                      <TouchableOpacity
                        key={m.userId}
                        style={[styles.participantBadge, { backgroundColor: colors.input, borderColor: colors.inputBorder, borderWidth: 1 }]}
                        onPress={() => handleRestoreMember(m.userId)}
                        activeOpacity={0.8}
                      >
                        <Feather name="plus-circle" size={12} color={colors.accent} />
                        <Text style={[styles.participantText, { color: colors.textPrimary }]}>{m.user.name}</Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </View>
            )}

            {/* Add Extra Member Input */}
            <View style={styles.addGuestRow}>
              <TextInput
                style={[styles.guestInput, { color: colors.textPrimary, backgroundColor: colors.input, borderColor: colors.inputBorder }]}
                placeholder="+ Add extra member / guest e.g. Alex"
                placeholderTextColor={colors.textSecondary}
                value={newGuestName}
                onChangeText={setNewGuestName}
              />
              <TouchableOpacity
                style={[styles.addGuestBtn, { backgroundColor: colors.accent }]}
                onPress={handleAddGuest}
                activeOpacity={0.8}
              >
                <Feather name="plus" size={16} color={colors.onAccent} />
                <Text style={[styles.addGuestBtnText, { color: colors.onAccent }]}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* ── Visual SVG Pie Chart Spin Wheel ── */}
            <View style={styles.wheelSection}>
              {/* Pointer Arrow at Top */}
              <View style={styles.pointerWrap}>
                <Feather name="triangle" size={34} color="#FFD700" style={styles.pointerIcon} />
              </View>

              {/* Glowing Wheel Container */}
              <View style={[styles.outerGlowRing, { borderColor: colors.accent }]}>
                {/* Animated Rotating Pie Chart Wheel */}
                <Animated.View
                  style={[
                    styles.wheelCircle,
                    {
                      width: SVG_SIZE,
                      height: SVG_SIZE,
                      borderRadius: SVG_SIZE / 2,
                      transform: [{ rotate: rotateInterpolate }],
                    },
                  ]}
                >
                  <Svg width={SVG_SIZE} height={SVG_SIZE} viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}>
                    <G>
                      {allSpinParticipants.map((p, idx) => {
                        const sliceAngle = 360 / allSpinParticipants.length;
                        const startAngle = idx * sliceAngle;
                        const endAngle = (idx + 1) * sliceAngle;
                        const sliceColor = VIBRANT_WHEEL_COLORS[idx % VIBRANT_WHEEL_COLORS.length];
                        const emoji = MEMBER_EMOJIS[idx % MEMBER_EMOJIS.length];

                        const pathData = createPieSlicePath(CENTER, CENTER, RADIUS, startAngle, endAngle);

                        // Midpoint angle for radial text placement
                        const midAngleDeg = startAngle + sliceAngle / 2;
                        const midRad = (midAngleDeg - 90) * (Math.PI / 180);
                        const textRadius = RADIUS * 0.62;
                        const tx = CENTER + textRadius * Math.cos(midRad);
                        const ty = CENTER + textRadius * Math.sin(midRad);

                        return (
                          <G key={p.id}>
                            {/* Pie Slice Path */}
                            <Path d={pathData} fill={sliceColor} stroke="#FFFFFF" strokeWidth={2} />

                            {/* Radial Slice Text */}
                            <SvgText
                              x={tx}
                              y={ty}
                              fill="#FFFFFF"
                              fontSize={allSpinParticipants.length > 6 ? 10 : 12}
                              fontWeight="900"
                              textAnchor="middle"
                              alignmentBaseline="central"
                              transform={`rotate(${midAngleDeg + 90}, ${tx}, ${ty})`}
                            >
                              {`${emoji} ${p.name.length > 8 ? p.name.substring(0, 7) + "…" : p.name}`}
                            </SvgText>
                          </G>
                        );
                      })}
                    </G>
                  </Svg>
                </Animated.View>

                {/* Golden Center Hub */}
                <View style={[styles.centerHub, { backgroundColor: colors.card }]}>
                  <Text style={{ fontSize: 26 }}>🎡</Text>
                </View>
              </View>
            </View>

            {/* Spin Button */}
            <TouchableOpacity
              style={[
                styles.spinBtn,
                { backgroundColor: isSpinning ? colors.accentSoft : colors.accent },
              ]}
              onPress={handleSpin}
              disabled={isSpinning}
              activeOpacity={0.85}
            >
              <Text style={[styles.spinBtnText, { color: colors.onAccent }]}>
                {isSpinning ? "SPINNING THE PIE WHEEL... 🌀" : "SPIN THE WHEEL! 🎡"}
              </Text>
            </TouchableOpacity>

            {/* Winner Announcement */}
            {winner && (
              <GlassCard style={styles.winnerCard}>
                <Text style={styles.winnerTitle}>🎉 THE WHEEL HAS SPOKEN!</Text>
                <Text style={[styles.winnerText, { color: colors.textPrimary }]}>
                  <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 20 }}>
                    {winner.name}
                  </Text>{" "}
                  is chosen for <Text style={{ fontWeight: "800" }}>"{taskTitle}"</Text>!
                </Text>

                <GlassButton
                  label={saving ? "Saving..." : `Assign Task to ${winner.name} 🚀`}
                  onPress={handleAssignTask}
                  disabled={saving}
                  style={{ marginTop: 12 }}
                />
              </GlassCard>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "flex-end",
    },
    modalCard: {
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderWidth: 1,
      maxHeight: "95%",
      padding: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "800",
    },
    subtitle: {
      fontSize: 13,
      marginBottom: 14,
    },
    body: {
      paddingBottom: 30,
    },
    label: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    chipRow: {
      flexDirection: "row",
      marginBottom: 10,
    },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 14,
      marginRight: 8,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "700",
    },
    input: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      marginBottom: 14,
    },

    participantRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 10,
    },
    participantBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 14,
    },
    participantText: {
      color: "#FFF",
      fontSize: 12,
      fontWeight: "800",
    },
    removeGuestBtn: {
      backgroundColor: "rgba(0,0,0,0.3)",
      borderRadius: 8,
      padding: 2,
    },
    addGuestRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
    },
    guestInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 13,
    },
    addGuestBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    addGuestBtnText: {
      fontSize: 13,
      fontWeight: "800",
    },

    wheelSection: {
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 18,
      height: 275,
      position: "relative",
    },
    pointerWrap: {
      position: "absolute",
      top: -14,
      zIndex: 30,
      transform: [{ rotate: "180deg" }],
    },
    pointerIcon: {
      shadowColor: "#FFD700",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.8,
      shadowRadius: 5,
    },
    outerGlowRing: {
      width: 268,
      height: 268,
      borderRadius: 134,
      borderWidth: 4,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    },
    wheelCircle: {
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    centerHub: {
      position: "absolute",
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 4,
      borderColor: "#FFD700",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },

    spinBtn: {
      borderRadius: 20,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 10,
    },
    spinBtnText: {
      fontSize: 16,
      fontWeight: "900",
      letterSpacing: 0.5,
    },

    winnerCard: {
      marginTop: 14,
      padding: 18,
      alignItems: "center",
    },
    winnerTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: c.accent,
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    winnerText: {
      fontSize: 15,
      textAlign: "center",
      marginBottom: 6,
    },
  });
}
