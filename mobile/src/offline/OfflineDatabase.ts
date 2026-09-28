import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Book,
  BookBudgetData,
  BookDetail,
  CategoryBudget,
  Chore,
  Expense,
  Flat,
  FlatBalances,
  FlatMember,
  FlatReport,
  GroupType,
  LiveBalances,
  Poll,
  PollOption,
  Settlement,
  ShoppingItem,
  SplitType,
  Task,
  TaskPreference,
  TaskSwap,
  TaskWorkload,
  User,
} from "../types";
import {
  computeNetBalances,
  computeSettlementTransactions,
  computeSplits,
  fromCents,
  ParticipantInput,
} from "./settlement";

const STORAGE_KEY = "@flatsplit_offline_db_v1";
const CURRENT_USER_KEY = "@flatsplit_current_user_v1";

export type StoredDatabase = {
  version: number;
  users: User[];
  flats: FlatRecord[];
  books: BookRecord[];
  expenses: ExpenseRecord[];
  settlements: SettlementRecord[];
  chores: ChoreRecord[];
  tasks: TaskRecord[];
  taskSwaps: TaskSwapRecord[];
  taskHistories: TaskHistoryRecord[];
  taskPreferences: TaskPreferenceRecord[];
  shoppingItems: ShoppingItemRecord[];
  polls: PollRecord[];
  pollVotes: PollVoteRecord[];
  budgets: BudgetRecord[];
  lastSyncedAt?: string;
};

export type FlatRecord = {
  id: number;
  name: string;
  inviteCode: string;
  adminId: number;
  groupType: GroupType;
  members: { userId: number; joinedAt: string }[];
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type BookRecord = {
  id: number;
  flatId: number;
  name: string;
  status: "OPEN" | "CLOSED";
  createdBy: number;
  createdAt: string;
  closedAt: string | null;
  updatedAt: string;
  isDeleted?: boolean;
};

export type ExpenseRecord = {
  id: number;
  bookId: number;
  paidById: number;
  addedById: number;
  amount: string;
  category: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  splits: { userId: number; shareAmount: string }[];
  isDeleted?: boolean;
};

export type SettlementRecord = {
  id: number;
  bookId: number;
  fromUserId: number;
  toUserId: number;
  amount: number | string;
  status: "PENDING" | "PAID";
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ChoreRecord = {
  id: number;
  flatId: number;
  title: string;
  description: string | null;
  frequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  assignedUserId: number | null;
  createdBy: number;
  isCompleted: boolean;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type TaskRecord = {
  id: number;
  flatId: number;
  title: string;
  description: string | null;
  category: string;
  dueDate: string;
  dueTime: string | null;
  taskType: "ONE_TIME" | "RECURRING" | "ROTATING";
  repeatInterval: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  points: number;
  assignmentType: "MANUAL" | "AUTO_FAIR" | "ROTATING";
  assignedUserId: number | null;
  createdBy: number;
  status: "PENDING" | "COMPLETED" | "OVERDUE" | "SKIPPED";
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type TaskSwapRecord = {
  id: number;
  taskId: number;
  requesterId: number;
  targetId: number;
  reason: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
};

export type TaskHistoryRecord = {
  id: number;
  taskId: number;
  flatId: number;
  userId: number;
  action: "COMPLETED" | "SWAPPED" | "SKIPPED";
  pointsEarned: number;
  createdAt: string;
};

export type TaskPreferenceRecord = {
  flatId: number;
  userId: number;
  availableDays: string;
  preferredCategories: string;
  avoidCategories: string;
  preferredTime: string;
  updatedAt: string;
};

export type ShoppingItemRecord = {
  id: number;
  flatId: number;
  title: string;
  quantity: string | null;
  isBought: boolean;
  boughtById: number | null;
  addedById: number;
  expenseId: number | null;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
};

export type PollRecord = {
  id: number;
  flatId: number;
  question: string;
  createdBy: number;
  createdAt: string;
  closedAt: string | null;
  options: { id: number; label: string }[];
  updatedAt: string;
};

export type PollVoteRecord = {
  pollId: number;
  userId: number;
  optionId: number;
  createdAt: string;
};

export type BudgetRecord = {
  id: number;
  bookId: number;
  category: string;
  amountLimit: number;
  updatedAt: string;
};

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function nextId(items: { id: number }[]): number {
  if (items.length === 0) return 1;
  return Math.max(...items.map((i) => i.id)) + 1;
}

const DEFAULT_BUDGET_CATEGORIES = [
  { category: "Groceries", defaultLimit: 8000 },
  { category: "Electricity", defaultLimit: 3000 },
  { category: "Internet", defaultLimit: 1500 },
  { category: "Cleaning", defaultLimit: 1000 },
  { category: "Other", defaultLimit: 2000 },
];

export class OfflineDatabase {
  private static instance: OfflineDatabase;
  private db: StoredDatabase | null = null;
  private currentUser: User | null = null;
  private isLoaded = false;

  public static getInstance(): OfflineDatabase {
    if (!OfflineDatabase.instance) {
      OfflineDatabase.instance = new OfflineDatabase();
    }
    return OfflineDatabase.instance;
  }

  private async load(): Promise<StoredDatabase> {
    if (this.isLoaded && this.db) return this.db;

    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.db = JSON.parse(raw);
      } else {
        this.db = this.createInitialDb();
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
      }
    } catch {
      this.db = this.createInitialDb();
    }

    try {
      const userRaw = await AsyncStorage.getItem(CURRENT_USER_KEY);
      if (userRaw) {
        this.currentUser = JSON.parse(userRaw);
      }
    } catch {
      this.currentUser = null;
    }

    this.isLoaded = true;
    return this.db!;
  }

  private async save(): Promise<void> {
    if (!this.db) return;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
  }

  private createInitialDb(): StoredDatabase {
    return {
      version: 1,
      users: [],
      flats: [],
      books: [],
      expenses: [],
      settlements: [],
      chores: [],
      tasks: [],
      taskSwaps: [],
      taskHistories: [],
      taskPreferences: [],
      shoppingItems: [],
      polls: [],
      pollVotes: [],
      budgets: [],
    };
  }

  // ── USER / PROFILE ──
  public async getCurrentUser(): Promise<User | null> {
    await this.load();
    return this.currentUser;
  }

  public async listProfiles(): Promise<User[]> {
    const db = await this.load();
    return db.users.filter((u) => !u.isGuest);
  }

  public async setCurrentUser(user: User): Promise<void> {
    await this.load();
    this.currentUser = user;
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));

    // Ensure user exists in db.users
    const existing = this.db!.users.find((u) => u.id === user.id);
    if (!existing) {
      this.db!.users.push(user);
    } else {
      Object.assign(existing, user);
    }
    await this.save();
  }

  public async createProfile(name: string, avatar: string = "🦁"): Promise<User> {
    const db = await this.load();
    const cleanName = name.trim() || "Roommate";
    const cleanEmail = `${cleanName.toLowerCase().replace(/\s+/g, "")}_${Date.now().toString(36)}@local`;

    const newUser: User = {
      id: nextId(db.users),
      name: cleanName,
      avatar,
      email: cleanEmail,
      isGuest: false,
    };

    db.users.push(newUser);
    await this.setCurrentUser(newUser);
    return newUser;
  }

  public async switchProfile(userId: number): Promise<User> {
    const db = await this.load();
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new Error("Profile not found");
    await this.setCurrentUser(user);
    return user;
  }

  public async updateUserProfile(name: string, avatar?: string): Promise<User> {
    const db = await this.load();
    if (!this.currentUser) throw new Error("No active user profile");

    this.currentUser.name = name.trim() || this.currentUser.name;
    if (avatar) this.currentUser.avatar = avatar;

    const dbUser = db.users.find((u) => u.id === this.currentUser!.id);
    if (dbUser) {
      dbUser.name = this.currentUser.name;
      if (avatar) dbUser.avatar = avatar;
    }

    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(this.currentUser));
    await this.save();
    return this.currentUser;
  }

  public async createOrLoginUser(name: string, avatar: string = "🦁", email?: string): Promise<User> {
    return this.createProfile(name, avatar);
  }

  public async logout(): Promise<void> {
    this.currentUser = null;
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  }

  private getAuthUserId(): number {
    if (!this.currentUser) {
      throw new Error("You must set up your local profile first.");
    }
    return this.currentUser.id;
  }

  private getUserById(userId: number): User {
    const u = this.db!.users.find((x) => x.id === userId);
    return u ?? { id: userId, name: `Roommate ${userId}`, email: `user${userId}@local` };
  }

  // ── FLATS ──
  public async listFlats(): Promise<Flat[]> {
    const db = await this.load();
    const userId = this.getAuthUserId();

    const userFlats = db.flats.filter(
      (f) => !f.isDeleted && f.members.some((m) => m.userId === userId)
    );

    return userFlats.map((f) => this.hydrateFlat(f));
  }

  public async getFlat(flatId: number): Promise<Flat> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId && !f.isDeleted);
    if (!flat) throw new Error("Flat not found");
    return this.hydrateFlat(flat);
  }

  public async createFlat(name: string, groupType: GroupType = "FLAT"): Promise<Flat> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const newFlat: FlatRecord = {
      id: nextId(db.flats),
      name: name.trim(),
      inviteCode: generateInviteCode(),
      adminId: userId,
      groupType,
      members: [{ userId, joinedAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    db.flats.push(newFlat);

    // Create an initial default book for the flat
    const newBook: BookRecord = {
      id: nextId(db.books),
      flatId: newFlat.id,
      name: "General Expenses",
      status: "OPEN",
      createdBy: userId,
      createdAt: now,
      closedAt: null,
      updatedAt: now,
    };
    db.books.push(newBook);

    await this.save();
    return this.hydrateFlat(newFlat);
  }

  public async joinFlat(inviteCode: string): Promise<{ flatId: number; name: string }> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const cleanCode = inviteCode.trim().toUpperCase();

    const flat = db.flats.find(
      (f) => !f.isDeleted && f.inviteCode.toUpperCase() === cleanCode
    );
    if (!flat) throw new Error("Invalid invite code. Please check and try again.");

    const alreadyMember = flat.members.some((m) => m.userId === userId);
    if (alreadyMember) throw new Error("You are already a member of this flat");

    flat.members.push({ userId, joinedAt: new Date().toISOString() });
    flat.updatedAt = new Date().toISOString();
    await this.save();

    return { flatId: flat.id, name: flat.name };
  }

  public async addGuest(flatId: number, name: string): Promise<FlatMember> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId && !f.isDeleted);
    if (!flat) throw new Error("Flat not found");

    const guestUser: User = {
      id: nextId(db.users),
      name: name.trim(),
      email: `guest-${Date.now()}@flatsplit.local`,
      isGuest: true,
    };
    db.users.push(guestUser);

    flat.members.push({ userId: guestUser.id, joinedAt: new Date().toISOString() });
    flat.updatedAt = new Date().toISOString();
    await this.save();

    return {
      id: guestUser.id,
      userId: guestUser.id,
      user: guestUser,
    };
  }

  public async removeMember(flatId: number, targetUserId: number): Promise<void> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const flat = db.flats.find((f) => f.id === flatId && !f.isDeleted);
    if (!flat) throw new Error("Flat not found");

    if (flat.adminId !== userId) {
      throw new Error("Only the flat admin can remove members");
    }
    if (targetUserId === userId) {
      throw new Error("Admin cannot remove themselves");
    }

    flat.members = flat.members.filter((m) => m.userId !== targetUserId);
    flat.updatedAt = new Date().toISOString();
    await this.save();
  }

  private hydrateFlat(record: FlatRecord): Flat {
    const members: FlatMember[] = record.members.map((m) => ({
      id: m.userId,
      userId: m.userId,
      user: this.getUserById(m.userId),
    }));

    const books: Book[] = (this.db!.books || [])
      .filter((b) => b.flatId === record.id && !b.isDeleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((b) => ({
        id: b.id,
        flatId: b.flatId,
        name: b.name,
        status: b.status,
        createdBy: b.createdBy,
        createdAt: b.createdAt,
        closedAt: b.closedAt,
      }));

    return {
      id: record.id,
      name: record.name,
      inviteCode: record.inviteCode,
      adminId: record.adminId,
      groupType: record.groupType,
      members,
      books,
    };
  }

  // ── BOOKS ──
  public async listBooks(flatId: number): Promise<Book[]> {
    const db = await this.load();
    return db.books
      .filter((b) => b.flatId === flatId && !b.isDeleted)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((b) => ({
        id: b.id,
        flatId: b.flatId,
        name: b.name,
        status: b.status,
        createdBy: b.createdBy,
        createdAt: b.createdAt,
        closedAt: b.closedAt,
      }));
  }

  public async createBook(flatId: number, name: string): Promise<Book> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const book: BookRecord = {
      id: nextId(db.books),
      flatId,
      name: name.trim(),
      status: "OPEN",
      createdBy: userId,
      createdAt: now,
      closedAt: null,
      updatedAt: now,
    };

    db.books.push(book);
    await this.save();

    return {
      id: book.id,
      flatId: book.flatId,
      name: book.name,
      status: book.status,
      createdBy: book.createdBy,
      createdAt: book.createdAt,
      closedAt: book.closedAt,
    };
  }

  public async getBookDetail(bookId: number): Promise<BookDetail> {
    const db = await this.load();
    const book = db.books.find((b) => b.id === bookId && !b.isDeleted);
    if (!book) throw new Error("Book not found");

    const flat = db.flats.find((f) => f.id === book.flatId);
    const expenses = await this.listExpenses(bookId);

    let balances: Settlement[] | LiveBalances;

    if (book.status === "CLOSED") {
      const settlements = db.settlements
        .filter((s) => s.bookId === bookId)
        .map((s) => ({
          id: s.id,
          bookId: s.bookId,
          fromUserId: s.fromUserId,
          toUserId: s.toUserId,
          amount: s.amount,
          status: s.status,
          fromUser: { id: s.fromUserId, name: this.getUserById(s.fromUserId).name },
          toUser: { id: s.toUserId, name: this.getUserById(s.toUserId).name },
        }));
      balances = settlements;
    } else {
      const memberMap = new Map<number, string>();
      flat?.members.forEach((m) => {
        memberMap.set(m.userId, this.getUserById(m.userId).name);
      });

      const rawExpenses = expenses.map((e) => ({
        amount: e.amount,
        paidById: e.paidById,
        splits: e.splits.map((s) => ({ userId: s.userId, shareAmount: s.shareAmount })),
      }));

      const net = computeNetBalances(rawExpenses);
      const txs = computeSettlementTransactions(rawExpenses).map((t) => ({
        ...t,
        fromUser: { id: t.fromUserId, name: memberMap.get(t.fromUserId) || `User ${t.fromUserId}` },
        toUser: { id: t.toUserId, name: memberMap.get(t.toUserId) || `User ${t.toUserId}` },
      }));

      balances = {
        transactions: txs,
        netByUser: Array.from(net.entries()).map(([uId, cents]) => ({
          userId: uId,
          name: memberMap.get(uId) || `User ${uId}`,
          net: fromCents(cents),
        })),
      };
    }

    return {
      book: {
        id: book.id,
        flatId: book.flatId,
        name: book.name,
        status: book.status,
        createdBy: book.createdBy,
        createdAt: book.createdAt,
        closedAt: book.closedAt,
      },
      expenses,
      balances,
    };
  }

  public async closeBook(bookId: number): Promise<{ book: Book; settlements: Settlement[] }> {
    const db = await this.load();
    const book = db.books.find((b) => b.id === bookId && !b.isDeleted);
    if (!book) throw new Error("Book not found");
    if (book.status === "CLOSED") throw new Error("Book already closed");

    const expenses = db.expenses.filter((e) => e.bookId === bookId && !e.isDeleted);
    const rawExpenses = expenses.map((e) => ({
      amount: e.amount,
      paidById: e.paidById,
      splits: e.splits.map((s) => ({ userId: s.userId, shareAmount: s.shareAmount })),
    }));

    const transactions = computeSettlementTransactions(rawExpenses);
    const now = new Date().toISOString();

    // Delete any old settlements for this book
    db.settlements = db.settlements.filter((s) => s.bookId !== bookId);

    const createdSettlements: SettlementRecord[] = transactions.map((t) => ({
      id: nextId(db.settlements),
      bookId,
      fromUserId: t.fromUserId,
      toUserId: t.toUserId,
      amount: t.amount,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    }));

    db.settlements.push(...createdSettlements);
    book.status = "CLOSED";
    book.closedAt = now;
    book.updatedAt = now;

    await this.save();

    return {
      book: {
        id: book.id,
        flatId: book.flatId,
        name: book.name,
        status: book.status,
        createdBy: book.createdBy,
        createdAt: book.createdAt,
        closedAt: book.closedAt,
      },
      settlements: createdSettlements.map((s) => ({
        id: s.id,
        bookId: s.bookId,
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: s.amount,
        status: s.status,
        fromUser: { id: s.fromUserId, name: this.getUserById(s.fromUserId).name },
        toUser: { id: s.toUserId, name: this.getUserById(s.toUserId).name },
      })),
    };
  }

  public async markSettlementPaid(settlementId: number): Promise<Settlement> {
    const db = await this.load();
    const s = db.settlements.find((x) => x.id === settlementId);
    if (!s) throw new Error("Settlement not found");

    s.status = "PAID";
    s.paidAt = new Date().toISOString();
    s.updatedAt = new Date().toISOString();
    await this.save();

    return {
      id: s.id,
      bookId: s.bookId,
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      amount: s.amount,
      status: s.status,
      fromUser: { id: s.fromUserId, name: this.getUserById(s.fromUserId).name },
      toUser: { id: s.toUserId, name: this.getUserById(s.toUserId).name },
    };
  }

  // ── EXPENSES ──
  public async listExpenses(bookId: number): Promise<Expense[]> {
    const db = await this.load();
    const expenses = db.expenses.filter((e) => e.bookId === bookId && !e.isDeleted);
    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return expenses.map((e) => this.hydrateExpense(e));
  }

  public async listFlatExpenses(flatId: number): Promise<Expense[]> {
    const db = await this.load();
    const bookIds = new Set(
      db.books.filter((b) => b.flatId === flatId && !b.isDeleted).map((b) => b.id)
    );

    const expenses = db.expenses.filter((e) => bookIds.has(e.bookId) && !e.isDeleted);
    expenses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return expenses.map((e) => this.hydrateExpense(e));
  }

  public async createExpense(
    bookId: number,
    payload: {
      amount: number;
      category: string;
      remarks?: string;
      paidById?: number;
      splitType: SplitType;
      participants: ParticipantInput[];
    }
  ): Promise<Expense> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const book = db.books.find((b) => b.id === bookId && !b.isDeleted);
    if (!book) throw new Error("Book not found");
    if (book.status === "CLOSED") throw new Error("Book is closed");

    const paidById = payload.paidById ?? userId;
    const splits = computeSplits(payload.amount, payload.splitType, payload.participants);
    const now = new Date().toISOString();

    const newExpense: ExpenseRecord = {
      id: nextId(db.expenses),
      bookId,
      paidById,
      addedById: userId,
      amount: Number(payload.amount).toFixed(2),
      category: payload.category.trim(),
      remarks: payload.remarks?.trim() || null,
      createdAt: now,
      updatedAt: now,
      splits: splits.map((s) => ({ userId: s.userId, shareAmount: s.shareAmount })),
    };

    db.expenses.push(newExpense);
    await this.save();

    return this.hydrateExpense(newExpense);
  }

  public async updateExpense(
    expenseId: number,
    payload: {
      amount: number;
      category: string;
      remarks?: string;
      paidById?: number;
      splitType: SplitType;
      participants: ParticipantInput[];
    }
  ): Promise<Expense> {
    const db = await this.load();
    const expense = db.expenses.find((e) => e.id === expenseId && !e.isDeleted);
    if (!expense) throw new Error("Expense not found");

    const book = db.books.find((b) => b.id === expense.bookId && !b.isDeleted);
    if (!book || book.status === "CLOSED") throw new Error("Book is closed");

    const splits = computeSplits(payload.amount, payload.splitType, payload.participants);
    const now = new Date().toISOString();

    expense.amount = Number(payload.amount).toFixed(2);
    expense.category = payload.category.trim();
    expense.remarks = payload.remarks?.trim() || null;
    if (payload.paidById) expense.paidById = payload.paidById;
    expense.splits = splits.map((s) => ({ userId: s.userId, shareAmount: s.shareAmount }));
    expense.updatedAt = now;

    await this.save();
    return this.hydrateExpense(expense);
  }

  public async removeExpense(expenseId: number): Promise<void> {
    const db = await this.load();
    const expense = db.expenses.find((e) => e.id === expenseId && !e.isDeleted);
    if (!expense) return;

    expense.isDeleted = true;
    expense.updatedAt = new Date().toISOString();
    await this.save();
  }

  private hydrateExpense(e: ExpenseRecord): Expense {
    const book = this.db!.books.find((b) => b.id === e.bookId);
    return {
      id: e.id,
      bookId: e.bookId,
      paidById: e.paidById,
      addedById: e.addedById,
      amount: e.amount,
      category: e.category,
      remarks: e.remarks,
      createdAt: e.createdAt,
      paidBy: { id: e.paidById, name: this.getUserById(e.paidById).name },
      addedBy: { id: e.addedById, name: this.getUserById(e.addedById).name },
      splits: e.splits.map((s, idx) => ({
        id: idx + 1,
        userId: s.userId,
        shareAmount: s.shareAmount,
        user: { id: s.userId, name: this.getUserById(s.userId).name },
      })),
      book: book ? { id: book.id, name: book.name, status: book.status } : undefined,
    };
  }

  // ── BALANCES & REPORTS ──
  public async getFlatBalances(flatId: number): Promise<FlatBalances> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId && !f.isDeleted);
    if (!flat) throw new Error("Flat not found");

    const openBookIds = new Set(
      db.books.filter((b) => b.flatId === flatId && b.status === "OPEN" && !b.isDeleted).map((b) => b.id)
    );

    const expenses = db.expenses.filter((e) => openBookIds.has(e.bookId) && !e.isDeleted);
    const memberMap = new Map<number, string>();
    flat.members.forEach((m) => {
      memberMap.set(m.userId, this.getUserById(m.userId).name);
    });

    const rawExpenses = expenses.map((e) => ({
      amount: e.amount,
      paidById: e.paidById,
      splits: e.splits.map((s) => ({ userId: s.userId, shareAmount: s.shareAmount })),
    }));

    const net = computeNetBalances(rawExpenses);
    const txs = computeSettlementTransactions(rawExpenses).map((t) => ({
      ...t,
      fromUser: { id: t.fromUserId, name: memberMap.get(t.fromUserId) || `User ${t.fromUserId}` },
      toUser: { id: t.toUserId, name: memberMap.get(t.toUserId) || `User ${t.toUserId}` },
    }));

    return {
      netByUser: Array.from(net.entries()).map(([userId, cents]) => ({
        userId,
        name: memberMap.get(userId) || `User ${userId}`,
        net: fromCents(cents),
      })),
      transactions: txs,
    };
  }

  public async getFlatReport(flatId: number): Promise<FlatReport> {
    const db = await this.load();
    const bookIds = new Set(
      db.books.filter((b) => b.flatId === flatId && !b.isDeleted).map((b) => b.id)
    );

    const expenses = db.expenses.filter((e) => bookIds.has(e.bookId) && !e.isDeleted);

    const byCategory = new Map<string, number>();
    const byMember = new Map<number, { name: string; amount: number }>();
    let total = 0;

    for (const e of expenses) {
      const amt = Number(e.amount);
      total += amt;
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amt);

      const u = this.getUserById(e.paidById);
      const prev = byMember.get(e.paidById);
      byMember.set(e.paidById, { name: u.name, amount: (prev?.amount ?? 0) + amt });
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

  // ── CHORES ──
  public async listChores(flatId: number): Promise<Chore[]> {
    const db = await this.load();
    const chores = db.chores.filter((c) => c.flatId === flatId && !c.isDeleted);
    chores.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return chores.map((c) => ({
      id: c.id,
      flatId: c.flatId,
      title: c.title,
      description: c.description,
      frequency: c.frequency,
      assignedUserId: c.assignedUserId,
      createdBy: c.createdBy,
      isCompleted: c.isCompleted,
      dueDate: c.dueDate,
      createdAt: c.createdAt,
      assignedUser: c.assignedUserId ? this.getUserById(c.assignedUserId) : null,
      creator: this.getUserById(c.createdBy),
    }));
  }

  public async createChore(
    flatId: number,
    payload: {
      title: string;
      description?: string;
      frequency?: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
      assignedUserId?: number | null;
    }
  ): Promise<Chore> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const chore: ChoreRecord = {
      id: nextId(db.chores),
      flatId,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      frequency: payload.frequency || "WEEKLY",
      assignedUserId: payload.assignedUserId ?? userId,
      createdBy: userId,
      isCompleted: false,
      dueDate: null,
      createdAt: now,
      updatedAt: now,
    };

    db.chores.push(chore);
    await this.save();

    return {
      id: chore.id,
      flatId: chore.flatId,
      title: chore.title,
      description: chore.description,
      frequency: chore.frequency,
      assignedUserId: chore.assignedUserId,
      createdBy: chore.createdBy,
      isCompleted: chore.isCompleted,
      dueDate: chore.dueDate,
      createdAt: chore.createdAt,
      assignedUser: chore.assignedUserId ? this.getUserById(chore.assignedUserId) : null,
      creator: this.getUserById(chore.createdBy),
    };
  }

  public async toggleChore(choreId: number): Promise<Chore> {
    const db = await this.load();
    const chore = db.chores.find((c) => c.id === choreId && !c.isDeleted);
    if (!chore) throw new Error("Chore not found");

    chore.isCompleted = !chore.isCompleted;
    chore.updatedAt = new Date().toISOString();
    await this.save();

    return {
      id: chore.id,
      flatId: chore.flatId,
      title: chore.title,
      description: chore.description,
      frequency: chore.frequency,
      assignedUserId: chore.assignedUserId,
      createdBy: chore.createdBy,
      isCompleted: chore.isCompleted,
      dueDate: chore.dueDate,
      createdAt: chore.createdAt,
      assignedUser: chore.assignedUserId ? this.getUserById(chore.assignedUserId) : null,
      creator: this.getUserById(chore.createdBy),
    };
  }

  public async rotateChore(choreId: number): Promise<Chore> {
    const db = await this.load();
    const chore = db.chores.find((c) => c.id === choreId && !c.isDeleted);
    if (!chore) throw new Error("Chore not found");

    const flat = db.flats.find((f) => f.id === chore.flatId);
    if (!flat || flat.members.length === 0) throw new Error("No members to rotate to");

    const memberIds = flat.members.map((m) => m.userId);
    const currIdx = chore.assignedUserId ? memberIds.indexOf(chore.assignedUserId) : -1;
    const nextIdx = (currIdx + 1) % memberIds.length;
    chore.assignedUserId = memberIds[nextIdx];
    chore.isCompleted = false;
    chore.updatedAt = new Date().toISOString();

    await this.save();

    return {
      id: chore.id,
      flatId: chore.flatId,
      title: chore.title,
      description: chore.description,
      frequency: chore.frequency,
      assignedUserId: chore.assignedUserId,
      createdBy: chore.createdBy,
      isCompleted: chore.isCompleted,
      dueDate: chore.dueDate,
      createdAt: chore.createdAt,
      assignedUser: chore.assignedUserId ? this.getUserById(chore.assignedUserId) : null,
      creator: this.getUserById(chore.createdBy),
    };
  }

  public async removeChore(choreId: number): Promise<void> {
    const db = await this.load();
    const chore = db.chores.find((c) => c.id === choreId && !c.isDeleted);
    if (!chore) return;

    chore.isDeleted = true;
    chore.updatedAt = new Date().toISOString();
    await this.save();
  }

  // ── TASKS ──
  public async listTasks(flatId: number): Promise<Task[]> {
    const db = await this.load();
    const tasks = db.tasks.filter((t) => t.flatId === flatId && !t.isDeleted);
    tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    return tasks.map((t) => this.hydrateTask(t));
  }

  public async createTask(
    flatId: number,
    payload: {
      title: string;
      description?: string;
      category: string;
      dueDate?: string;
      dueTime?: string;
      taskType: "ONE_TIME" | "RECURRING" | "ROTATING";
      repeatInterval?: string;
      difficulty: "EASY" | "MEDIUM" | "HARD";
      points?: number;
      assignmentType: "MANUAL" | "AUTO_FAIR" | "ROTATING";
      assignedUserId?: number;
    }
  ): Promise<Task> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const points =
      payload.points ??
      (payload.difficulty === "EASY" ? 1 : payload.difficulty === "HARD" ? 5 : 3);

    let assignedUserId = payload.assignedUserId;
    if (payload.assignmentType === "AUTO_FAIR" || (!assignedUserId && payload.assignmentType === "ROTATING")) {
      assignedUserId = await this.selectFairAssignee(flatId, payload.category, payload.dueDate);
    }

    const task: TaskRecord = {
      id: nextId(db.tasks),
      flatId,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      category: payload.category || "Other",
      dueDate: payload.dueDate || now.split("T")[0],
      dueTime: payload.dueTime || "19:00",
      taskType: payload.taskType,
      repeatInterval: payload.repeatInterval || null,
      difficulty: payload.difficulty,
      points,
      assignmentType: payload.assignmentType,
      assignedUserId: assignedUserId ?? userId,
      createdBy: userId,
      status: "PENDING",
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    db.tasks.push(task);
    await this.save();

    return this.hydrateTask(task);
  }

  public async completeTask(taskId: number): Promise<Task> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const task = db.tasks.find((t) => t.id === taskId && !t.isDeleted);
    if (!task) throw new Error("Task not found");

    const now = new Date().toISOString();
    task.status = "COMPLETED";
    task.completedAt = now;
    task.updatedAt = now;

    db.taskHistories.push({
      id: nextId(db.taskHistories),
      taskId,
      flatId: task.flatId,
      userId,
      action: "COMPLETED",
      pointsEarned: task.points,
      createdAt: now,
    });

    if (task.taskType === "RECURRING" || task.taskType === "ROTATING") {
      const nextDue = new Date(task.dueDate);
      nextDue.setDate(nextDue.getDate() + 7);

      let nextAssigneeId = task.assignedUserId;
      if (task.taskType === "ROTATING") {
        nextAssigneeId = await this.selectFairAssignee(task.flatId, task.category, nextDue.toISOString());
      }

      db.tasks.push({
        id: nextId(db.tasks),
        flatId: task.flatId,
        title: task.title,
        description: task.description,
        category: task.category,
        dueDate: nextDue.toISOString().split("T")[0],
        dueTime: task.dueTime,
        taskType: task.taskType,
        repeatInterval: task.repeatInterval,
        difficulty: task.difficulty,
        points: task.points,
        assignmentType: task.assignmentType,
        assignedUserId: nextAssigneeId,
        createdBy: task.createdBy,
        status: "PENDING",
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    await this.save();
    return this.hydrateTask(task);
  }

  public async swapTask(taskId: number, targetId: number, reason?: string): Promise<TaskSwap> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const swap: TaskSwapRecord = {
      id: nextId(db.taskSwaps),
      taskId,
      requesterId: userId,
      targetId: Number(targetId),
      reason: reason ?? null,
      status: "PENDING",
      createdAt: now,
    };

    db.taskSwaps.push(swap);
    await this.save();

    return {
      id: swap.id,
      taskId: swap.taskId,
      requesterId: swap.requesterId,
      targetId: swap.targetId,
      reason: swap.reason,
      status: swap.status,
      requester: { id: swap.requesterId, name: this.getUserById(swap.requesterId).name },
      target: { id: swap.targetId, name: this.getUserById(swap.targetId).name },
    };
  }

  public async respondSwap(swapId: number, action: "ACCEPT" | "REJECT"): Promise<void> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const swap = db.taskSwaps.find((s) => s.id === swapId);
    if (!swap) throw new Error("Swap request not found");

    if (action === "ACCEPT") {
      swap.status = "ACCEPTED";
      const task = db.tasks.find((t) => t.id === swap.taskId);
      if (task) {
        task.assignedUserId = swap.targetId;
        task.updatedAt = new Date().toISOString();
      }
      db.taskHistories.push({
        id: nextId(db.taskHistories),
        taskId: swap.taskId,
        flatId: task ? task.flatId : 0,
        userId,
        action: "SWAPPED",
        pointsEarned: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      swap.status = "REJECTED";
    }

    await this.save();
  }

  public async skipTask(taskId: number, reason?: string, reassign?: boolean): Promise<Task> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const task = db.tasks.find((t) => t.id === taskId && !t.isDeleted);
    if (!task) throw new Error("Task not found");

    let assignedUserId = task.assignedUserId;
    if (reassign) {
      assignedUserId = await this.selectFairAssignee(task.flatId, task.category, task.dueDate);
    }

    task.status = reassign ? "PENDING" : "SKIPPED";
    task.assignedUserId = assignedUserId;
    task.updatedAt = new Date().toISOString();

    db.taskHistories.push({
      id: nextId(db.taskHistories),
      taskId,
      flatId: task.flatId,
      userId,
      action: "SKIPPED",
      pointsEarned: 0,
      createdAt: new Date().toISOString(),
    });

    await this.save();
    return this.hydrateTask(task);
  }

  public async getTaskWorkload(flatId: number): Promise<TaskWorkload> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId);
    const members = flat ? flat.members : [];

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const histories = db.taskHistories.filter(
      (h) => h.flatId === flatId && new Date(h.createdAt).getTime() >= thirtyDaysAgo && h.action === "COMPLETED"
    );

    const pointsMap = new Map<number, { name: string; points: number }>();
    members.forEach((m) => {
      pointsMap.set(m.userId, { name: this.getUserById(m.userId).name, points: 0 });
    });

    histories.forEach((h) => {
      if (pointsMap.has(h.userId)) {
        pointsMap.get(h.userId)!.points += h.pointsEarned;
      }
    });

    const workloadList = Array.from(pointsMap.entries()).map(([uId, data]) => ({
      userId: uId,
      name: data.name,
      points: data.points,
    }));

    const totalPoints = workloadList.reduce((sum, w) => sum + w.points, 0);
    const avgPoints = members.length > 0 ? totalPoints / members.length : 0;
    const variance =
      members.length > 0
        ? workloadList.reduce((sum, w) => sum + Math.pow(w.points - avgPoints, 2), 0) / members.length
        : 0;
    const stdDev = Math.sqrt(variance);
    const fairnessScore =
      avgPoints > 0
        ? Math.max(0, Math.min(100, Math.round((1 - stdDev / (avgPoints + 5)) * 100)))
        : 100;

    return {
      members: workloadList,
      average: Math.round(avgPoints * 10) / 10,
      fairnessScore,
    };
  }

  public async getTaskPreferences(flatId: number): Promise<TaskPreference> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const pref = db.taskPreferences.find((p) => p.flatId === flatId && p.userId === userId);

    return (
      pref ?? {
        availableDays: "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        preferredCategories: "",
        avoidCategories: "",
        preferredTime: "ANY",
      }
    );
  }

  public async updateTaskPreferences(
    flatId: number,
    pref: Partial<TaskPreference>
  ): Promise<TaskPreference> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const existing = db.taskPreferences.find((p) => p.flatId === flatId && p.userId === userId);
    const now = new Date().toISOString();

    if (existing) {
      existing.availableDays = pref.availableDays ?? existing.availableDays;
      existing.preferredCategories = pref.preferredCategories ?? existing.preferredCategories;
      existing.avoidCategories = pref.avoidCategories ?? existing.avoidCategories;
      existing.preferredTime = pref.preferredTime ?? existing.preferredTime;
      existing.updatedAt = now;
    } else {
      db.taskPreferences.push({
        flatId,
        userId,
        availableDays: pref.availableDays ?? "Mon,Tue,Wed,Thu,Fri,Sat,Sun",
        preferredCategories: pref.preferredCategories ?? "",
        avoidCategories: pref.avoidCategories ?? "",
        preferredTime: pref.preferredTime ?? "ANY",
        updatedAt: now,
      });
    }

    await this.save();
    return this.getTaskPreferences(flatId);
  }

  private async selectFairAssignee(
    flatId: number,
    category: string,
    dueDateStr?: string
  ): Promise<number> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId);
    if (!flat || flat.members.length === 0) return this.getAuthUserId();

    const members = flat.members;
    const dateObj = dueDateStr ? new Date(dueDateStr) : new Date();
    const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayName = daysMap[dateObj.getDay()];

    const prefMap = new Map<number, TaskPreferenceRecord>();
    db.taskPreferences.filter((p) => p.flatId === flatId).forEach((p) => prefMap.set(p.userId, p));

    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const histories = db.taskHistories.filter(
      (h) => h.flatId === flatId && new Date(h.createdAt).getTime() >= fourteenDaysAgo && h.action === "COMPLETED"
    );

    const memberPoints = new Map<number, number>();
    members.forEach((m) => memberPoints.set(m.userId, 0));
    histories.forEach((h) => {
      const curr = memberPoints.get(h.userId) || 0;
      memberPoints.set(h.userId, curr + h.pointsEarned);
    });

    const candidates = members.map((m) => {
      const uId = m.userId;
      const pts = memberPoints.get(uId) || 0;
      const pref = prefMap.get(uId);

      let isAvailable = true;
      let preferred = false;
      let avoid = false;

      if (pref) {
        if (pref.availableDays && !pref.availableDays.includes(dayName)) {
          isAvailable = false;
        }
        if (pref.preferredCategories && pref.preferredCategories.includes(category)) {
          preferred = true;
        }
        if (pref.avoidCategories && pref.avoidCategories.includes(category)) {
          avoid = true;
        }
      }

      let score = pts;
      if (!isAvailable) score += 100;
      if (preferred) score -= 3;
      if (avoid) score += 10;

      return { userId: uId, score };
    });

    candidates.sort((a, b) => a.score - b.score);
    return candidates[0]?.userId ?? members[0].userId;
  }

  private hydrateTask(t: TaskRecord): Task {
    const pendingSwaps = (this.db!.taskSwaps || []).filter(
      (s) => s.taskId === t.id && s.status === "PENDING"
    );

    return {
      id: t.id,
      flatId: t.flatId,
      title: t.title,
      description: t.description,
      category: t.category,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      taskType: t.taskType,
      repeatInterval: t.repeatInterval,
      difficulty: t.difficulty,
      points: t.points,
      assignmentType: t.assignmentType,
      assignedUserId: t.assignedUserId,
      createdBy: t.createdBy,
      status: t.status,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      creator: { id: t.createdBy, name: this.getUserById(t.createdBy).name },
      assignedUser: t.assignedUserId
        ? { id: t.assignedUserId, name: this.getUserById(t.assignedUserId).name }
        : null,
      swaps: pendingSwaps.map((s) => ({
        id: s.id,
        taskId: s.taskId,
        requesterId: s.requesterId,
        targetId: s.targetId,
        reason: s.reason,
        status: s.status,
        requester: { id: s.requesterId, name: this.getUserById(s.requesterId).name },
        target: { id: s.targetId, name: this.getUserById(s.targetId).name },
      })),
    };
  }

  // ── SHOPPING ──
  public async listShopping(flatId: number): Promise<ShoppingItem[]> {
    const db = await this.load();
    const items = db.shoppingItems.filter((i) => i.flatId === flatId && !i.isDeleted);
    items.sort((a, b) => {
      if (a.isBought !== b.isBought) return a.isBought ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return items.map((i) => ({
      id: i.id,
      flatId: i.flatId,
      title: i.title,
      quantity: i.quantity,
      isBought: i.isBought,
      boughtById: i.boughtById,
      addedById: i.addedById,
      expenseId: i.expenseId,
      createdAt: i.createdAt,
      addedBy: { id: i.addedById, name: this.getUserById(i.addedById).name },
      boughtBy: i.boughtById ? { id: i.boughtById, name: this.getUserById(i.boughtById).name } : null,
    }));
  }

  public async addShoppingItem(flatId: number, title: string, quantity?: string): Promise<ShoppingItem> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const item: ShoppingItemRecord = {
      id: nextId(db.shoppingItems),
      flatId,
      title: title.trim(),
      quantity: quantity?.trim() || null,
      isBought: false,
      boughtById: null,
      addedById: userId,
      expenseId: null,
      createdAt: now,
      updatedAt: now,
    };

    db.shoppingItems.push(item);
    await this.save();

    return {
      id: item.id,
      flatId: item.flatId,
      title: item.title,
      quantity: item.quantity,
      isBought: item.isBought,
      boughtById: null,
      addedById: item.addedById,
      expenseId: null,
      createdAt: item.createdAt,
      addedBy: { id: item.addedById, name: this.getUserById(item.addedById).name },
      boughtBy: null,
    };
  }

  public async toggleShoppingItem(itemId: number): Promise<ShoppingItem> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const item = db.shoppingItems.find((i) => i.id === itemId && !i.isDeleted);
    if (!item) throw new Error("Shopping item not found");

    item.isBought = !item.isBought;
    item.boughtById = item.isBought ? userId : null;
    item.updatedAt = new Date().toISOString();
    await this.save();

    return {
      id: item.id,
      flatId: item.flatId,
      title: item.title,
      quantity: item.quantity,
      isBought: item.isBought,
      boughtById: item.boughtById,
      addedById: item.addedById,
      expenseId: item.expenseId,
      createdAt: item.createdAt,
      addedBy: { id: item.addedById, name: this.getUserById(item.addedById).name },
      boughtBy: item.boughtById ? { id: item.boughtById, name: this.getUserById(item.boughtById).name } : null,
    };
  }

  public async removeShoppingItem(itemId: number): Promise<void> {
    const db = await this.load();
    const item = db.shoppingItems.find((i) => i.id === itemId && !i.isDeleted);
    if (!item) return;

    item.isDeleted = true;
    item.updatedAt = new Date().toISOString();
    await this.save();
  }

  // ── POLLS ──
  public async listPolls(flatId: number): Promise<Poll[]> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const polls = db.polls.filter((p) => p.flatId === flatId);
    polls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return polls.map((p) => this.hydratePoll(p, userId));
  }

  public async createPoll(flatId: number, question: string, options: string[]): Promise<Poll> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const now = new Date().toISOString();

    const poll: PollRecord = {
      id: nextId(db.polls),
      flatId,
      question: question.trim(),
      createdBy: userId,
      createdAt: now,
      closedAt: null,
      options: options.map((label, idx) => ({ id: idx + 1, label: label.trim() })),
      updatedAt: now,
    };

    db.polls.push(poll);
    await this.save();

    return this.hydratePoll(poll, userId);
  }

  public async votePoll(pollId: number, optionId: number): Promise<Poll> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const poll = db.polls.find((p) => p.id === pollId);
    if (!poll) throw new Error("Poll not found");
    if (poll.closedAt) throw new Error("Poll is closed");

    db.pollVotes = db.pollVotes.filter((v) => !(v.pollId === pollId && v.userId === userId));
    db.pollVotes.push({
      pollId,
      userId,
      optionId,
      createdAt: new Date().toISOString(),
    });

    await this.save();
    return this.hydratePoll(poll, userId);
  }

  public async closePoll(pollId: number): Promise<Poll> {
    const db = await this.load();
    const userId = this.getAuthUserId();
    const poll = db.polls.find((p) => p.id === pollId);
    if (!poll) throw new Error("Poll not found");

    poll.closedAt = new Date().toISOString();
    poll.updatedAt = new Date().toISOString();
    await this.save();

    return this.hydratePoll(poll, userId);
  }

  private hydratePoll(p: PollRecord, userId: number): Poll {
    const votes = this.db!.pollVotes.filter((v) => v.pollId === p.id);
    const voteMap = new Map<number, number>();
    votes.forEach((v) => voteMap.set(v.optionId, (voteMap.get(v.optionId) || 0) + 1));

    const myVote = votes.find((v) => v.userId === userId);
    const options: PollOption[] = p.options.map((o) => ({
      id: o.id,
      label: o.label,
      votes: voteMap.get(o.id) || 0,
    }));

    const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);

    return {
      id: p.id,
      flatId: p.flatId,
      question: p.question,
      createdBy: p.createdBy,
      createdAt: p.createdAt,
      closedAt: p.closedAt,
      totalVotes,
      options,
      myOptionId: myVote ? myVote.optionId : null,
    };
  }

  // ── BUDGETS ──
  public async getBudgets(bookId: number): Promise<BookBudgetData> {
    const db = await this.load();
    let saved = db.budgets.filter((b) => b.bookId === bookId);

    if (saved.length === 0) {
      const now = new Date().toISOString();
      DEFAULT_BUDGET_CATEGORIES.forEach((cat) => {
        db.budgets.push({
          id: nextId(db.budgets),
          bookId,
          category: cat.category,
          amountLimit: cat.defaultLimit,
          updatedAt: now,
        });
      });
      await this.save();
      saved = db.budgets.filter((b) => b.bookId === bookId);
    }

    const expenses = db.expenses.filter((e) => e.bookId === bookId && !e.isDeleted);
    const spentByCategory: Record<string, number> = {};
    let totalSpent = 0;

    expenses.forEach((e) => {
      const amt = Number(e.amount);
      const cat = e.category || "Other";
      spentByCategory[cat] = (spentByCategory[cat] || 0) + amt;
      totalSpent += amt;
    });

    let totalLimit = 0;
    const alerts: string[] = [];

    const categoryBudgets: CategoryBudget[] = saved.map((b) => {
      const limit = Number(b.amountLimit);
      totalLimit += limit;
      const spent = spentByCategory[b.category] || 0;
      const percentUsed = limit > 0 ? Math.round((spent / limit) * 100) : 0;

      let status: "OK" | "WARNING" | "OVER" = "OK";
      if (percentUsed >= 100) {
        status = "OVER";
        alerts.push(`🚨 ${b.category} budget exceeded (${percentUsed}%)!`);
      } else if (percentUsed >= 80) {
        status = "WARNING";
        alerts.push(`⚠️ ${b.category} spending is already ${percentUsed}% of budget.`);
      }

      return {
        id: b.id,
        category: b.category,
        amountLimit: limit,
        spent,
        percentUsed,
        status,
      };
    });

    Object.keys(spentByCategory).forEach((cat) => {
      if (!saved.some((b) => b.category === cat)) {
        const spent = spentByCategory[cat];
        categoryBudgets.push({
          id: 0,
          category: cat,
          amountLimit: 0,
          spent,
          percentUsed: 100,
          status: "OVER",
        });
      }
    });

    const totalPercentUsed = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

    return {
      bookId,
      totalLimit,
      totalSpent,
      totalPercentUsed,
      alerts,
      categories: categoryBudgets,
    };
  }

  public async updateBudgets(
    bookId: number,
    budgets: { category: string; amountLimit: number }[]
  ): Promise<{ message: string }> {
    const db = await this.load();
    const now = new Date().toISOString();

    budgets.forEach((b) => {
      const cat = b.category.trim();
      const existing = db.budgets.find((x) => x.bookId === bookId && x.category.toLowerCase() === cat.toLowerCase());
      if (existing) {
        existing.amountLimit = Number(b.amountLimit) || 0;
        existing.updatedAt = now;
      } else {
        db.budgets.push({
          id: nextId(db.budgets),
          bookId,
          category: cat,
          amountLimit: Number(b.amountLimit) || 0,
          updatedAt: now,
        });
      }
    });

    await this.save();
    return { message: "Budget updated successfully!" };
  }

  // ── IMPORT / EXPORT / P2P SYNC MERGE ──
  public async exportDatabaseSnapshot(): Promise<StoredDatabase> {
    const db = await this.load();
    return JSON.parse(JSON.stringify(db));
  }

  public async exportFlatData(flatId: number): Promise<string> {
    const db = await this.load();
    const flat = db.flats.find((f) => f.id === flatId && !f.isDeleted);
    if (!flat) throw new Error("Flat not found");

    const bookIds = new Set(db.books.filter((b) => b.flatId === flatId).map((b) => b.id));
    const memberIds = new Set(flat.members.map((m) => m.userId));

    const exportPayload = {
      type: "FLATSPLIT_SYNC_V1",
      exportedAt: new Date().toISOString(),
      senderUser: this.currentUser,
      flat,
      users: db.users.filter((u) => memberIds.has(u.id)),
      books: db.books.filter((b) => b.flatId === flatId),
      expenses: db.expenses.filter((e) => bookIds.has(e.bookId)),
      settlements: db.settlements.filter((s) => bookIds.has(s.bookId)),
      chores: db.chores.filter((c) => c.flatId === flatId),
      tasks: db.tasks.filter((t) => t.flatId === flatId),
      taskSwaps: db.taskSwaps.filter((s) => {
        const t = db.tasks.find((task) => task.id === s.taskId);
        return t && t.flatId === flatId;
      }),
      taskHistories: db.taskHistories.filter((h) => h.flatId === flatId),
      taskPreferences: db.taskPreferences.filter((p) => p.flatId === flatId),
      shoppingItems: db.shoppingItems.filter((i) => i.flatId === flatId),
      polls: db.polls.filter((p) => p.flatId === flatId),
      pollVotes: db.pollVotes.filter((v) => {
        const p = db.polls.find((poll) => poll.id === v.pollId);
        return p && p.flatId === flatId;
      }),
      budgets: db.budgets.filter((b) => bookIds.has(b.bookId)),
    };

    return JSON.stringify(exportPayload);
  }

  public async importAndMergeSyncData(syncPayloadJson: string): Promise<{
    success: boolean;
    flatName: string;
    mergedExpenses: number;
    mergedTasks: number;
    mergedChores: number;
  }> {
    const db = await this.load();
    let data: any;
    try {
      data = typeof syncPayloadJson === "string" ? JSON.parse(syncPayloadJson) : syncPayloadJson;
    } catch {
      throw new Error("Invalid sync data format.");
    }

    if (!data.flat && !data.flats) {
      throw new Error("Unrecognized data format.");
    }

    let mergedExpensesCount = 0;
    let mergedTasksCount = 0;
    let mergedChoresCount = 0;

    // 1. Merge users
    if (Array.isArray(data.users)) {
      data.users.forEach((remoteUser: User) => {
        const existing = db.users.find(
          (u) => u.id === remoteUser.id || (u.email && u.email === remoteUser.email)
        );
        if (!existing) {
          db.users.push(remoteUser);
        } else {
          if (remoteUser.name) existing.name = remoteUser.name;
        }
      });
    }

    // 2. Merge Flat(s)
    const remoteFlats: FlatRecord[] = data.flats ?? (data.flat ? [data.flat] : []);
    remoteFlats.forEach((rf) => {
      const localFlat = db.flats.find(
        (f) => f.id === rf.id || f.inviteCode.toUpperCase() === rf.inviteCode.toUpperCase()
      );
      if (!localFlat) {
        db.flats.push(rf);
      } else {
        // Merge members
        const memberUserIds = new Set(localFlat.members.map((m) => m.userId));
        rf.members.forEach((rm) => {
          if (!memberUserIds.has(rm.userId)) {
            localFlat.members.push(rm);
          }
        });
        if (new Date(rf.updatedAt || 0) > new Date(localFlat.updatedAt || 0)) {
          localFlat.name = rf.name;
          localFlat.adminId = rf.adminId;
          localFlat.groupType = rf.groupType;
          localFlat.updatedAt = rf.updatedAt;
        }
      }
    });

    // 3. Merge Books
    if (Array.isArray(data.books)) {
      data.books.forEach((rb: BookRecord) => {
        const local = db.books.find((b) => b.id === rb.id);
        if (!local) {
          db.books.push(rb);
        } else if (new Date(rb.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rb);
        }
      });
    }

    // 4. Merge Expenses
    if (Array.isArray(data.expenses)) {
      data.expenses.forEach((re: ExpenseRecord) => {
        const local = db.expenses.find((e) => e.id === re.id);
        if (!local) {
          db.expenses.push(re);
          mergedExpensesCount++;
        } else if (new Date(re.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, re);
          mergedExpensesCount++;
        }
      });
    }

    // 5. Merge Settlements
    if (Array.isArray(data.settlements)) {
      data.settlements.forEach((rs: SettlementRecord) => {
        const local = db.settlements.find((s) => s.id === rs.id);
        if (!local) {
          db.settlements.push(rs);
        } else if (new Date(rs.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rs);
        }
      });
    }

    // 6. Merge Chores
    if (Array.isArray(data.chores)) {
      data.chores.forEach((rc: ChoreRecord) => {
        const local = db.chores.find((c) => c.id === rc.id);
        if (!local) {
          db.chores.push(rc);
          mergedChoresCount++;
        } else if (new Date(rc.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rc);
          mergedChoresCount++;
        }
      });
    }

    // 7. Merge Tasks
    if (Array.isArray(data.tasks)) {
      data.tasks.forEach((rt: TaskRecord) => {
        const local = db.tasks.find((t) => t.id === rt.id);
        if (!local) {
          db.tasks.push(rt);
          mergedTasksCount++;
        } else if (new Date(rt.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rt);
          mergedTasksCount++;
        }
      });
    }

    // 8. Merge Shopping Items
    if (Array.isArray(data.shoppingItems)) {
      data.shoppingItems.forEach((ri: ShoppingItemRecord) => {
        const local = db.shoppingItems.find((i) => i.id === ri.id);
        if (!local) {
          db.shoppingItems.push(ri);
        } else if (new Date(ri.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, ri);
        }
      });
    }

    // 9. Merge Polls & Votes
    if (Array.isArray(data.polls)) {
      data.polls.forEach((rp: PollRecord) => {
        const local = db.polls.find((p) => p.id === rp.id);
        if (!local) db.polls.push(rp);
        else if (new Date(rp.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rp);
        }
      });
    }
    if (Array.isArray(data.pollVotes)) {
      data.pollVotes.forEach((rv: PollVoteRecord) => {
        const local = db.pollVotes.find((v) => v.pollId === rv.pollId && v.userId === rv.userId);
        if (!local) db.pollVotes.push(rv);
        else local.optionId = rv.optionId;
      });
    }

    // 10. Merge Budgets
    if (Array.isArray(data.budgets)) {
      data.budgets.forEach((rb: BudgetRecord) => {
        const local = db.budgets.find((b) => b.bookId === rb.bookId && b.category === rb.category);
        if (!local) db.budgets.push(rb);
        else if (new Date(rb.updatedAt || 0) > new Date(local.updatedAt || 0)) {
          Object.assign(local, rb);
        }
      });
    }

    db.lastSyncedAt = new Date().toISOString();
    await this.save();

    const flatName = remoteFlats[0]?.name || "Flat";

    return {
      success: true,
      flatName,
      mergedExpenses: mergedExpensesCount,
      mergedTasks: mergedTasksCount,
      mergedChores: mergedChoresCount,
    };
  }
}

export const offlineDb = OfflineDatabase.getInstance();
