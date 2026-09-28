import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Screen from "../../components/Screen";
import GlassCard from "../../components/GlassCard";
import DonutChart from "../../components/DonutChart";
import EmptyState from "../../components/EmptyState";
import FilterDropdown from "../../components/FilterDropdown";
import SetBudgetModal from "../../components/SetBudgetModal";
import { useFlat } from "../../context/FlatContext";
import { BookApi, BudgetApi, BookBudgetData, FlatApi } from "../../api/endpoints";
import { apiErrorMessage } from "../../api/client";
import { Book, CategoryBudget, Expense, FlatReport } from "../../types";
import { Palette, colorForCategories } from "../../theme/colors";
import { useTheme } from "../../theme/ThemeContext";
import type { AppStackParamList } from "../../navigation/types";

type Nav = NativeStackNavigationProp<AppStackParamList>;

function computeReport(expenses: Expense[]): FlatReport {
  const byCategory = new Map<string, number>();
  const byMember = new Map<number, { name: string; amount: number }>();
  let total = 0;

  for (const e of expenses) {
    const amount = Number(e.amount);
    total += amount;
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount);
    const prev = byMember.get(e.paidBy.id);
    byMember.set(e.paidBy.id, { name: e.paidBy.name, amount: (prev?.amount ?? 0) + amount });
  }

  return {
    total,
    expenseCount: expenses.length,
    byCategory: Array.from(byCategory.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    byMember: Array.from(byMember.entries())
      .map(([userId, v]) => ({ userId, name: v.name, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

export default function HomeTabScreen() {
  const { flatId, flatName } = useFlat();
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [books, setBooks] = useState<Book[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [budgetData, setBudgetData] = useState<BookBudgetData | null>(null);
  const [showSetBudgetModal, setShowSetBudgetModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const initializedSelection = useRef(false);

  const openBook = books?.find((b) => b.status === "OPEN") ?? null;
  const selectedBook = books?.find((b) => b.id === selectedBookId) ?? null;
  const activeBook = selectedBook ?? openBook ?? (books && books.length > 0 ? books[0] : null);
  const activeBookId = activeBook?.id ?? null;

  const loadBudgetForBook = useCallback(async (bId: number | null) => {
    if (!bId) {
      setBudgetData(null);
      return;
    }
    try {
      const budgetRes = await BudgetApi.get(bId);
      setBudgetData(budgetRes.data);
    } catch (err) {
      console.warn("Failed to fetch budget:", err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [booksRes, expensesRes] = await Promise.all([
        BookApi.list(flatId),
        FlatApi.expenses(flatId),
      ]);
      setBooks(booksRes.data);
      setExpenses(expensesRes.data);

      const openB = booksRes.data.find((b) => b.status === "OPEN");
      let targetId = selectedBookId;
      if (!initializedSelection.current && openB) {
        targetId = openB.id;
        setSelectedBookId(openB.id);
        initializedSelection.current = true;
      }
      if (!targetId && booksRes.data.length > 0) {
        targetId = openB?.id ?? booksRes.data[0].id;
      }

      if (targetId) {
        await loadBudgetForBook(targetId);
      }
    } catch (err) {
      console.warn(apiErrorMessage(err));
    }
  }, [flatId, selectedBookId, loadBudgetForBook]);

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

  const filteredExpenses = useMemo(() => {
    if (!expenses) return null;
    return selectedBookId == null ? expenses : expenses.filter((e) => e.bookId === selectedBookId);
  }, [expenses, selectedBookId]);

  const report = filteredExpenses ? computeReport(filteredExpenses) : null;

  const bookOptions = useMemo(
    () => [{ value: null, label: "All Books" }, ...(books ?? []).map((b) => ({ value: b.id, label: b.name }))],
    [books]
  );

  const categoryColors = report ? colorForCategories(report.byCategory.map((c) => c.category)) : new Map();
  const donutData =
    report?.byCategory.map((c) => ({
      label: c.category,
      value: c.amount,
      color: categoryColors.get(c.category) ?? colors.accent,
    })) ?? [];

  function handleBookChange(bookId: number | null) {
    setSelectedBookId(bookId);
    const targetId = bookId ?? openBook?.id ?? books?.[0]?.id ?? null;
    loadBudgetForBook(targetId);
  }

  function handleAddExpense() {
    if (openBook) {
      navigation.navigate("AddExpense", { bookId: openBook.id, flatId });
    } else {
      navigation.navigate("CreateBook", { flatId });
    }
  }

  const hasBooks = !!books && books.length > 0;

  return (
    <Screen edges={[]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{flatName}</Text>
            <Text style={styles.subGreeting}>{openBook ? `Tracking "${openBook.name}"` : "No book active"}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.addBookBtn, { backgroundColor: colors.accentSoft }]}
              onPress={() => navigation.navigate("CreateBook", { flatId })}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={14} color={colors.accent} />
              <Text style={[styles.addBookBtnText, { color: colors.accent }]}>Book</Text>
            </TouchableOpacity>
            {hasBooks && (
              <FilterDropdown label="Book" icon="book" value={selectedBookId} options={bookOptions} onChange={handleBookChange} />
            )}
          </View>
        </View>

        {books === null && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {books !== null && !hasBooks && (
          <EmptyState
            icon="book"
            title="No Book Yet"
            subtitle="Create an expense book to start tracking"
            actionLabel="Create First Book"
            onAction={() => navigation.navigate("CreateBook", { flatId })}
            tint="accent"
          />
        )}

        {hasBooks && !report && (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        )}

        {hasBooks && report && report.expenseCount === 0 && (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No expenses yet{selectedBook ? ` in "${selectedBook.name}"` : ""} — tap the + button to add one.
            </Text>
          </GlassCard>
        )}

        {hasBooks && report && (
          <GlassCard style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total spent</Text>
            <Text style={styles.heroValue}>₹{report.total.toFixed(2)}</Text>
            <Text style={styles.heroSubtitle}>
              {report.expenseCount} expense{report.expenseCount === 1 ? "" : "s"}
              {selectedBook ? ` in "${selectedBook.name}"` : " across all books"}
            </Text>
          </GlassCard>
        )}

        {/* ── Book Budget Card ── */}
        {hasBooks && activeBook && (
          <GlassCard style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.budgetTitleRow}>
                  <Text style={{ fontSize: 18 }}>📊</Text>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                    Book Budget
                  </Text>
                </View>
                <Text style={[styles.budgetSub, { color: colors.textSecondary }]}>
                  {`Budget for "${activeBook.name}"`}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.setBudgetBtn, { backgroundColor: colors.accentSoft }]}
                onPress={() => setShowSetBudgetModal(true)}
                activeOpacity={0.8}
              >
                <Feather name="settings" size={13} color={colors.accent} />
                <Text style={[styles.setBudgetBtnText, { color: colors.accent }]}>Set Budget</Text>
              </TouchableOpacity>
            </View>

            {budgetData ? (
              <>
                {/* Smart Alert Banners */}
                {budgetData.alerts.length > 0 && (
                  <View style={styles.alertStack}>
                    {budgetData.alerts.map((alertText: string, idx: number) => (
                      <View
                        key={idx}
                        style={[
                          styles.alertBanner,
                          {
                            backgroundColor: alertText.includes("🚨")
                              ? "rgba(255, 71, 87, 0.15)"
                              : "rgba(255, 165, 2, 0.15)",
                            borderColor: alertText.includes("🚨") ? colors.danger : "#FFA502",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.alertText,
                            { color: alertText.includes("🚨") ? colors.danger : "#FFA502" },
                          ]}
                        >
                          {alertText}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Total Budget Progress Bar */}
                <View style={styles.totalProgressBox}>
                  <View style={styles.progressTextRow}>
                    <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
                      Spent: <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>₹{budgetData.totalSpent.toLocaleString()}</Text>
                    </Text>
                    <Text style={[styles.progressValue, { color: budgetData.totalPercentUsed >= 100 ? colors.danger : colors.accent }]}>
                      Limit: ₹{budgetData.totalLimit.toLocaleString()} ({budgetData.totalPercentUsed}%)
                    </Text>
                  </View>

                  <View style={[styles.track, { marginTop: 6, height: 10, borderRadius: 5 }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          height: 10,
                          borderRadius: 5,
                          width: `${Math.min(budgetData.totalPercentUsed, 100)}%`,
                          backgroundColor:
                            budgetData.totalPercentUsed >= 100
                              ? colors.danger
                              : budgetData.totalPercentUsed >= 80
                              ? "#FFA502"
                              : colors.accent,
                        },
                      ]}
                    />
                  </View>
                </View>

                {/* Category Breakdown list */}
                <View style={styles.categoryBudgetList}>
                  {budgetData.categories.map((c: CategoryBudget) => (
                    <View key={c.category} style={styles.catBudgetRow}>
                      <View style={styles.catBudgetHeader}>
                        <Text style={[styles.catName, { color: colors.textPrimary }]}>{c.category}</Text>
                        <Text
                          style={[
                            styles.catAmount,
                            {
                              color:
                                c.status === "OVER"
                                  ? colors.danger
                                  : c.status === "WARNING"
                                  ? "#FFA502"
                                  : colors.textSecondary,
                            },
                          ]}
                        >
                          ₹{c.spent.toLocaleString()} / ₹{c.amountLimit.toLocaleString()} ({c.percentUsed}%)
                        </Text>
                      </View>

                      <View style={styles.catTrack}>
                        <View
                          style={[
                            styles.catFill,
                            {
                              width: `${Math.min(c.percentUsed, 100)}%`,
                              backgroundColor:
                                c.status === "OVER"
                                  ? colors.danger
                                  : c.status === "WARNING"
                                  ? "#FFA502"
                                  : colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginVertical: 8 }}>
                Loading budget details for "{activeBook.name}"...
              </Text>
            )}
          </GlassCard>
        )}

        {hasBooks && report && report.expenseCount > 0 && (
          <GlassCard style={styles.chartCard}>
            <Text style={styles.sectionTitle}>By category</Text>
            <View style={styles.chartRow}>
              <DonutChart
                data={donutData}
                size={160}
                strokeWidth={24}
                centerValue={`₹${report.total.toFixed(0)}`}
                centerLabel="total"
              />
              <View style={styles.legend}>
                {report.byCategory.map((c) => {
                  const pct = report.total > 0 ? (c.amount / report.total) * 100 : 0;
                  return (
                    <View key={c.category} style={styles.legendRow}>
                      <View style={[styles.swatch, { backgroundColor: categoryColors.get(c.category) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.legendLabel}>{c.category}</Text>
                        <Text style={styles.legendValue}>
                          ₹{c.amount.toFixed(2)} · {pct.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </GlassCard>
        )}

        {hasBooks && report && report.byMember.length > 0 && (
          <GlassCard style={styles.card}>
            <Text style={styles.sectionTitle}>Who's paid the most</Text>
            {report.byMember.map((m, i) => {
              const max = report.byMember[0].amount || 1;
              const pct = (m.amount / max) * 100;
              return (
                <View key={m.userId} style={styles.memberRow}>
                  <View style={styles.memberRowHeader}>
                    <Text style={styles.memberName}>
                      {i === 0 ? "🏆 " : ""}
                      {m.name}
                    </Text>
                    <Text style={styles.memberAmount}>₹{m.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.max(pct, 4)}%` }]} />
                  </View>
                </View>
              );
            })}
          </GlassCard>
        )}
      </ScrollView>

      {hasBooks && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleAddExpense}
          style={[styles.fab, { backgroundColor: colors.accent }]}
        >
          <Feather name="plus" size={26} color={colors.onAccent} />
        </TouchableOpacity>
      )}

      {showSetBudgetModal && activeBookId && (
        <SetBudgetModal
          visible={showSetBudgetModal}
          bookId={activeBookId}
          existingBudgets={budgetData?.categories ?? []}
          onClose={() => setShowSetBudgetModal(false)}
          onSaved={load}
        />
      )}
    </Screen>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    content: { padding: 20, paddingBottom: 100, gap: 16 },
    headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    greeting: { fontSize: 24, fontWeight: "800", color: c.textPrimary },
    subGreeting: { fontSize: 14, color: c.textSecondary, marginTop: 2, marginBottom: 4 },
    headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    addBookBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 12,
    },
    addBookBtnText: {
      fontSize: 12,
      fontWeight: "800",
    },

    heroCard: { alignItems: "flex-start" },
    heroLabel: { color: c.textSecondary, fontWeight: "700", fontSize: 13 },
    heroValue: { color: c.textPrimary, fontWeight: "800", fontSize: 36, marginTop: 4 },
    heroSubtitle: { color: c.textSecondary, fontSize: 13, marginTop: 4 },

    budgetCard: {
      marginBottom: 0,
    },
    budgetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    budgetTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    budgetSub: {
      fontSize: 12,
      marginTop: 2,
    },
    setBudgetBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },
    setBudgetBtnText: {
      fontSize: 12,
      fontWeight: "800",
    },
    alertStack: {
      gap: 8,
      marginBottom: 12,
    },
    alertBanner: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
    },
    alertText: {
      fontSize: 13,
      fontWeight: "800",
    },
    totalProgressBox: {
      marginBottom: 14,
    },
    progressTextRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    progressLabel: {
      fontSize: 12,
    },
    progressValue: {
      fontSize: 12,
      fontWeight: "800",
    },
    categoryBudgetList: {
      gap: 10,
    },
    catBudgetRow: {},
    catBudgetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    catName: {
      fontSize: 13,
      fontWeight: "700",
    },
    catAmount: {
      fontSize: 12,
      fontWeight: "700",
    },
    catTrack: {
      height: 6,
      backgroundColor: "rgba(150, 150, 150, 0.2)",
      borderRadius: 3,
      overflow: "hidden",
    },
    catFill: {
      height: "100%",
      borderRadius: 3,
    },

    loading: { paddingVertical: 30, alignItems: "center" },
    emptyCard: { alignItems: "center" },
    emptyText: { color: c.textSecondary, textAlign: "center", fontSize: 14 },

    card: {},
    chartCard: {},
    sectionTitle: { fontSize: 16, fontWeight: "800", color: c.textPrimary, marginBottom: 14 },
    chartRow: { flexDirection: "row", alignItems: "center", gap: 16 },
    legend: { flex: 1, gap: 10 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    legendLabel: { fontSize: 13, fontWeight: "700", color: c.textPrimary },
    legendValue: { fontSize: 12, color: c.textSecondary, marginTop: 1 },

    memberRow: { marginBottom: 14 },
    memberRowHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    memberName: { fontSize: 14, fontWeight: "700", color: c.textPrimary },
    memberAmount: { fontSize: 14, fontWeight: "700", color: c.textSecondary },
    track: { height: 8, borderRadius: 4, backgroundColor: c.divider, overflow: "hidden" },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.accent },

    fab: {
      position: "absolute",
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 4,
    },
  });
}
