// Local settlement & split calculations (paise/cents integer math to prevent floating point errors)

export function toCents(decimalLike: number | string): number {
  return Math.round(Number(decimalLike) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

export function splitEvenCents(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

export type ParticipantInput = {
  userId: number;
  value?: number;
};

export type ComputedSplit = {
  userId: number;
  shareAmount: string;
};

export function computeSplits(
  amount: number,
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE",
  participants: ParticipantInput[]
): ComputedSplit[] {
  const totalCents = toCents(amount);
  if (participants.length === 0) return [];

  if (splitType === "EQUAL") {
    const parts = splitEvenCents(totalCents, participants.length);
    return participants.map((p, i) => ({
      userId: p.userId,
      shareAmount: fromCents(parts[i]).toFixed(2),
    }));
  }

  if (splitType === "EXACT") {
    const sumCents = participants.reduce((s, p) => s + toCents(p.value ?? 0), 0);
    if (sumCents !== totalCents) {
      throw new Error(
        `Exact split amounts (${fromCents(sumCents)}) must add up to the total (${amount})`
      );
    }
    return participants.map((p) => ({
      userId: p.userId,
      shareAmount: Number(p.value ?? 0).toFixed(2),
    }));
  }

  if (splitType === "PERCENTAGE") {
    const sumPct = participants.reduce((s, p) => s + Number(p.value ?? 0), 0);
    if (Math.abs(sumPct - 100) > 0.01) {
      throw new Error(`Percentages must add up to 100% (got ${sumPct}%)`);
    }
    const rawCents = participants.map((p) => (totalCents * Number(p.value ?? 0)) / 100);
    const flooredCents = rawCents.map(Math.floor);
    const leftover = totalCents - flooredCents.reduce((s, c) => s + c, 0);

    const order = rawCents
      .map((c, i) => ({ i, frac: c - flooredCents[i] }))
      .sort((a, b) => b.frac - a.frac);

    for (let k = 0; k < leftover; k++) {
      flooredCents[order[k % order.length].i] += 1;
    }

    return participants.map((p, i) => ({
      userId: p.userId,
      shareAmount: fromCents(flooredCents[i]).toFixed(2),
    }));
  }

  throw new Error(`Unknown splitType: ${splitType}`);
}

export type RawExpense = {
  amount: string | number;
  paidById: number;
  splits: { userId: number; shareAmount: string | number }[];
};

export function computeNetBalances(expenses: RawExpense[]): Map<number, number> {
  const net = new Map<number, number>();

  const add = (userId: number, deltaCents: number) => {
    net.set(userId, (net.get(userId) || 0) + deltaCents);
  };

  for (const expense of expenses) {
    add(expense.paidById, toCents(expense.amount));
    for (const split of expense.splits) {
      add(split.userId, -toCents(split.shareAmount));
    }
  }

  return net;
}

export type DebtTransaction = {
  fromUserId: number;
  toUserId: number;
  amount: number;
};

export function simplifyDebts(netCentsByUser: Map<number, number>): DebtTransaction[] {
  const creditors: { userId: number; amount: number }[] = [];
  const debtors: { userId: number; amount: number }[] = [];

  for (const [userId, cents] of netCentsByUser.entries()) {
    if (cents > 0) creditors.push({ userId, amount: cents });
    else if (cents < 0) debtors.push({ userId, amount: -cents });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const transactions: DebtTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const settled = Math.min(debtor.amount, creditor.amount);

    if (settled > 0) {
      transactions.push({
        fromUserId: debtor.userId,
        toUserId: creditor.userId,
        amount: fromCents(settled),
      });
    }

    debtor.amount -= settled;
    creditor.amount -= settled;

    if (debtor.amount === 0) i++;
    if (creditor.amount === 0) j++;
  }

  return transactions;
}

export function computeSettlementTransactions(expenses: RawExpense[]): DebtTransaction[] {
  const net = computeNetBalances(expenses);
  return simplifyDebts(net);
}
