import {
  Book,
  BookBudgetData,
  BookDetail,
  CategoryBudget,
  Chore,
  ChoreFrequency,
  Expense,
  Flat,
  FlatBalances,
  FlatMember,
  FlatReport,
  GroupType,
  Poll,
  ShoppingItem,
  SplitType,
  Task,
  TaskAssignmentType,
  TaskDifficulty,
  TaskPreference,
  TaskType,
  TaskWorkload,
  User,
} from "../types";

export type { CategoryBudget, BookBudgetData };
import { offlineDb } from "../offline/OfflineDatabase";

// Helper to wrap local offline database calls in an Axios-like response format { data }
function toResponse<T>(data: T): Promise<{ data: T }> {
  return Promise.resolve({ data });
}

export const AuthApi = {
  register: async (name: string, email: string, _password?: string) => {
    const user = await offlineDb.createOrLoginUser(name, email);
    return toResponse<{ token: string; user: User }>({ token: "offline_token", user });
  },
  login: async (email: string, _password?: string) => {
    const user = await offlineDb.createOrLoginUser(email.split("@")[0] || "User", email);
    return toResponse<{ token: string; user: User }>({ token: "offline_token", user });
  },
  me: async () => {
    const user = await offlineDb.getCurrentUser();
    if (!user) throw new Error("No active profile");
    return toResponse<{ user: User }>({ user });
  },
};

export const FlatApi = {
  list: async () => {
    const flats = await offlineDb.listFlats();
    return toResponse<Flat[]>(flats);
  },
  create: async (name: string, groupType: GroupType = "FLAT") => {
    const flat = await offlineDb.createFlat(name, groupType);
    return toResponse<Flat>(flat);
  },
  join: async (inviteCode: string) => {
    const result = await offlineDb.joinFlat(inviteCode);
    return toResponse<{ flatId: number; name: string }>(result);
  },
  detail: async (flatId: number) => {
    const flat = await offlineDb.getFlat(flatId);
    return toResponse<Flat>(flat);
  },
  report: async (flatId: number) => {
    const report = await offlineDb.getFlatReport(flatId);
    return toResponse<FlatReport>(report);
  },
  expenses: async (flatId: number) => {
    const expenses = await offlineDb.listFlatExpenses(flatId);
    return toResponse<Expense[]>(expenses);
  },
  balances: async (flatId: number) => {
    const balances = await offlineDb.getFlatBalances(flatId);
    return toResponse<FlatBalances>(balances);
  },
  addGuest: async (flatId: number, name: string) => {
    const member = await offlineDb.addGuest(flatId, name);
    return toResponse<FlatMember>(member);
  },
  removeMember: async (flatId: number, userId: number) => {
    await offlineDb.removeMember(flatId, userId);
    return toResponse<void>(undefined);
  },
};

export const BookApi = {
  list: async (flatId: number) => {
    const books = await offlineDb.listBooks(flatId);
    return toResponse<Book[]>(books);
  },
  create: async (flatId: number, name: string) => {
    const book = await offlineDb.createBook(flatId, name);
    return toResponse<Book>(book);
  },
  detail: async (bookId: number) => {
    const detail = await offlineDb.getBookDetail(bookId);
    return toResponse<BookDetail>(detail);
  },
  close: async (bookId: number) => {
    const result = await offlineDb.closeBook(bookId);
    return toResponse(result);
  },
  markSettlementPaid: async (settlementId: number) => {
    const settlement = await offlineDb.markSettlementPaid(settlementId);
    return toResponse(settlement);
  },
};

export type CreateExpensePayload = {
  amount: number;
  category: string;
  remarks?: string;
  paidById?: number;
  splitType: SplitType;
  participants: { userId: number; value?: number }[];
};

export const ExpenseApi = {
  list: async (bookId: number) => {
    const expenses = await offlineDb.listExpenses(bookId);
    return toResponse<Expense[]>(expenses);
  },
  create: async (bookId: number, payload: CreateExpensePayload) => {
    const expense = await offlineDb.createExpense(bookId, payload);
    return toResponse<Expense>(expense);
  },
  update: async (expenseId: number, payload: CreateExpensePayload) => {
    const expense = await offlineDb.updateExpense(expenseId, payload);
    return toResponse<Expense>(expense);
  },
  remove: async (expenseId: number) => {
    await offlineDb.removeExpense(expenseId);
    return toResponse<void>(undefined);
  },
};

export const PollApi = {
  list: async (flatId: number) => {
    const polls = await offlineDb.listPolls(flatId);
    return toResponse<Poll[]>(polls);
  },
  create: async (flatId: number, question: string, options: string[]) => {
    const poll = await offlineDb.createPoll(flatId, question, options);
    return toResponse<Poll>(poll);
  },
  vote: async (pollId: number, optionId: number) => {
    const poll = await offlineDb.votePoll(pollId, optionId);
    return toResponse<Poll>(poll);
  },
  close: async (pollId: number) => {
    const poll = await offlineDb.closePoll(pollId);
    return toResponse<Poll>(poll);
  },
};

export type CreateChorePayload = {
  title: string;
  description?: string;
  frequency?: ChoreFrequency;
  assignedUserId?: number | null;
};

export const ChoreApi = {
  list: async (flatId: number) => {
    const chores = await offlineDb.listChores(flatId);
    return toResponse<Chore[]>(chores);
  },
  create: async (flatId: number, payload: CreateChorePayload) => {
    const chore = await offlineDb.createChore(flatId, payload);
    return toResponse<Chore>(chore);
  },
  toggle: async (choreId: number) => {
    const chore = await offlineDb.toggleChore(choreId);
    return toResponse<Chore>(chore);
  },
  rotate: async (choreId: number) => {
    const chore = await offlineDb.rotateChore(choreId);
    return toResponse<Chore>(chore);
  },
  remove: async (choreId: number) => {
    await offlineDb.removeChore(choreId);
    return toResponse<void>(undefined);
  },
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  category: string;
  dueDate?: string;
  dueTime?: string;
  taskType: TaskType;
  repeatInterval?: string;
  difficulty: TaskDifficulty;
  points?: number;
  assignmentType: TaskAssignmentType;
  assignedUserId?: number;
};

export const TaskApi = {
  list: async (flatId: number) => {
    const tasks = await offlineDb.listTasks(flatId);
    return toResponse<Task[]>(tasks);
  },
  create: async (flatId: number, payload: CreateTaskPayload) => {
    const task = await offlineDb.createTask(flatId, payload);
    return toResponse<Task>(task);
  },
  complete: async (taskId: number) => {
    const task = await offlineDb.completeTask(taskId);
    return toResponse<Task>(task);
  },
  swap: async (taskId: number, targetId: number, reason?: string) => {
    const swap = await offlineDb.swapTask(taskId, targetId, reason);
    return toResponse(swap);
  },
  respondSwap: async (swapId: number, action: "ACCEPT" | "REJECT") => {
    await offlineDb.respondSwap(swapId, action);
    return toResponse({ message: `Swap request ${action.toLowerCase()}ed` });
  },
  skip: async (taskId: number, reason?: string, reassign?: boolean) => {
    const task = await offlineDb.skipTask(taskId, reason, reassign);
    return toResponse<Task>(task);
  },
  workload: async (flatId: number) => {
    const workload = await offlineDb.getTaskWorkload(flatId);
    return toResponse<TaskWorkload>(workload);
  },
  getPreferences: async (flatId: number) => {
    const pref = await offlineDb.getTaskPreferences(flatId);
    return toResponse<TaskPreference>(pref);
  },
  updatePreferences: async (flatId: number, pref: Partial<TaskPreference>) => {
    const updated = await offlineDb.updateTaskPreferences(flatId, pref);
    return toResponse<TaskPreference>(updated);
  },
};

export const BudgetApi = {
  get: async (bookId: number) => {
    const budget = await offlineDb.getBudgets(bookId);
    return toResponse<BookBudgetData>(budget);
  },
  update: async (bookId: number, budgets: { category: string; amountLimit: number }[]) => {
    const result = await offlineDb.updateBudgets(bookId, budgets);
    return toResponse<{ message: string }>(result);
  },
};

export const ShoppingApi = {
  list: async (flatId: number) => {
    const items = await offlineDb.listShopping(flatId);
    return toResponse<ShoppingItem[]>(items);
  },
  add: async (flatId: number, title: string, quantity?: string) => {
    const item = await offlineDb.addShoppingItem(flatId, title, quantity);
    return toResponse<ShoppingItem>(item);
  },
  toggle: async (itemId: number) => {
    const item = await offlineDb.toggleShoppingItem(itemId);
    return toResponse<ShoppingItem>(item);
  },
  remove: async (itemId: number) => {
    await offlineDb.removeShoppingItem(itemId);
    return toResponse<void>(undefined);
  },
};
