/**
 * exportBook
 * Generates a CSV file for a given BookDetail and shares it via the native
 * share sheet. Uses only:
 *   - Pure JS string building (no xlsx/Buffer needed)
 *   - expo-file-system to write the CSV to a temp location
 *   - expo-sharing to open the native share sheet
 */
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { BookDetail, LiveBalances, Settlement } from "../types";

function isLiveBalances(b: BookDetail["balances"]): b is LiveBalances {
  return !Array.isArray(b);
}

/** Wraps a cell value in double-quotes and escapes inner quotes. */
function csvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

/** Joins an array of values into a CSV row. */
function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}

export async function exportBookToExcel(bookName: string, detail: BookDetail) {
  try {
    const { book, expenses, balances } = detail;

    const lines: string[] = [];

    // ── Section 1: Book Info ─────────────────────────────────────────────
    lines.push(csvRow(["Book Name", bookName]));
    lines.push(csvRow(["Status", book.status]));
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    lines.push(csvRow(["Total Expenses (₹)", total.toFixed(2)]));
    lines.push(csvRow(["Expense Count", expenses.length]));
    lines.push(""); // blank separator

    // ── Section 2: Expenses ──────────────────────────────────────────────
    lines.push(csvRow(["Date", "Category", "Paid By", "Amount (₹)", "Remarks", "Split"]));
    if (expenses.length === 0) {
      lines.push(csvRow(["—", "No expenses yet", "—", "—", "—", "—"]));
    } else {
      for (const e of expenses) {
        const splitStr = e.splits
          .map((s) => `${s.user.name}: ₹${Number(s.shareAmount).toFixed(2)}`)
          .join(" | ");
        lines.push(
          csvRow([
            new Date(e.createdAt).toLocaleDateString(),
            e.category,
            e.paidBy.name,
            Number(e.amount).toFixed(2),
            e.remarks ?? "",
            splitStr,
          ])
        );
      }
    }
    lines.push(""); // blank separator

    // ── Section 3: Balances / Settlements ────────────────────────────────
    const live = isLiveBalances(balances) ? balances : null;
    const settlements: Settlement[] = live
      ? live.transactions
      : (balances as Settlement[]);

    if (live) {
      lines.push(csvRow(["Member Balances"]));
      lines.push(csvRow(["Member", "Net Balance (₹)", "Status"]));
      for (const nb of live.netByUser) {
        lines.push(
          csvRow([
            nb.name,
            (nb.net >= 0 ? "+" : "") + nb.net.toFixed(2),
            nb.net >= 0 ? "Gets back" : "Owes",
          ])
        );
      }
      lines.push(""); // blank separator
    }

    lines.push(csvRow(["Settlements"]));
    lines.push(csvRow(["From", "To", "Amount (₹)", "Status"]));
    if (settlements.length === 0) {
      lines.push(csvRow(["—", "Everyone settled up", "—", "—"]));
    } else {
      for (const t of settlements) {
        lines.push(
          csvRow([
            t.fromUser?.name ?? "?",
            t.toUser?.name ?? "?",
            Number(t.amount).toFixed(2),
            t.status ?? (book.status === "CLOSED" ? "PENDING" : "—"),
          ])
        );
      }
    }

    // ── Write & Share ────────────────────────────────────────────────────
    const csvContent = lines.join("\n");

    const safeBookName = bookName.replace(/[^a-z0-9_\-]/gi, "_").slice(0, 40);
    const dateTag = new Date().toISOString().slice(0, 10);
    const fileUri = `${FileSystem.cacheDirectory}${safeBookName}_${dateTag}.csv`;

    await FileSystem.writeAsStringAsync(fileUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: `Export – ${bookName}`,
    });
  } catch (err: any) {
    console.error("CSV export error:", err);
    Alert.alert("Export failed", err?.message ?? "An unexpected error occurred.");
  }
}
