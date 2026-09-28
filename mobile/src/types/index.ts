export type User = {
  id: number;
  name: string;
  avatar?: string;
  email?: string;
  isGuest?: boolean;
};

export type FlatMember = {
  id: number;
  userId: number;
  user: User;
};

export type GroupType = "FLAT" | "TRIP" | "PARTY" | "OFFICE";

export type Flat = {
  id: number;
  name: string;
  inviteCode: string;
  adminId: number;
  groupType: GroupType;
  members: FlatMember[];
  books?: Book[];
};

export type BookStatus = "OPEN" | "CLOSED";

export type Book = {
  id: number;
  flatId: number;
  name: string;
  status: BookStatus;
  createdBy: number;
  createdAt: string;
  closedAt: string | null;
};

export type ExpenseSplit = {
  id: number;
  userId: number;
  shareAmount: string;
  user: { id: number; name: string };
};

export type Expense = {
  id: number;
  bookId: number;
  paidById: number;
  addedById: number;
  amount: string;
  category: string;
  remarks: string | null;
  createdAt: string;
  paidBy: { id: number; name: string };
  addedBy: { id: number; name: string };
  splits: ExpenseSplit[];
  book?: { id: number; name: string; status: BookStatus };
};

export type SettlementStatus = "PENDING" | "PAID";

export type Settlement = {
  id?: number;
  bookId?: number;
  fromUserId: number;
  toUserId: number;
  amount: string | number;
  status?: SettlementStatus;
  fromUser?: { id: number; name: string };
  toUser?: { id: number; name: string };
};

export type NetBalance = { userId: number; name: string; net: number };

export type LiveBalances = { transactions: Settlement[]; netByUser: NetBalance[] };

export type FlatBalances = { netByUser: NetBalance[]; transactions: Settlement[] };

export type BookDetail = {
  book: Book;
  expenses: Expense[];
  balances: Settlement[] | LiveBalances;
};

export type SplitType = "EQUAL" | "EXACT" | "PERCENTAGE";

export type FlatReport = {
  total: number;
  expenseCount: number;
  byCategory: { category: string; amount: number }[];
  byMember: { userId: number; name: string; amount: number }[];
};

export type PollOption = {
  id: number;
  label: string;
  votes: number;
};

export type Poll = {
  id: number;
  flatId: number;
  question: string;
  createdBy: number;
  createdAt: string;
  closedAt: string | null;
  totalVotes: number;
  options: PollOption[];
  myOptionId: number | null;
};

export type ChoreFrequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type Chore = {
  id: number;
  flatId: number;
  title: string;
  description: string | null;
  frequency: ChoreFrequency;
  assignedUserId: number | null;
  createdBy: number;
  isCompleted: boolean;
  dueDate: string | null;
  createdAt: string;
  assignedUser?: User | null;
  creator: User;
};

export type TaskDifficulty = "EASY" | "MEDIUM" | "HARD";
export type TaskType = "ONE_TIME" | "RECURRING" | "ROTATING";
export type TaskAssignmentType = "MANUAL" | "AUTO_FAIR" | "ROTATING";
export type TaskStatus = "PENDING" | "COMPLETED" | "OVERDUE" | "SKIPPED";

export type TaskSwap = {
  id: number;
  taskId: number;
  requesterId: number;
  targetId: number;
  reason: string | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  requester: { id: number; name: string };
  target: { id: number; name: string };
};

export type Task = {
  id: number;
  flatId: number;
  title: string;
  description: string | null;
  category: string;
  dueDate: string;
  dueTime: string | null;
  taskType: TaskType;
  repeatInterval: string | null;
  difficulty: TaskDifficulty;
  points: number;
  assignmentType: TaskAssignmentType;
  assignedUserId: number | null;
  createdBy: number;
  status: TaskStatus;
  completedAt: string | null;
  createdAt: string;
  creator: { id: number; name: string };
  assignedUser?: { id: number; name: string } | null;
  swaps?: TaskSwap[];
};

export type TaskWorkloadMember = {
  userId: number;
  name: string;
  points: number;
};

export type TaskWorkload = {
  members: TaskWorkloadMember[];
  average: number;
  fairnessScore: number;
};

export type TaskPreference = {
  availableDays: string;
  preferredCategories: string;
  avoidCategories: string;
  preferredTime: string;
};

export type ShoppingItem = {
  id: number;
  flatId: number;
  title: string;
  quantity: string | null;
  isBought: boolean;
  boughtById: number | null;
  addedById: number;
  expenseId: number | null;
  createdAt: string;
  addedBy: { id: number; name: string };
  boughtBy?: { id: number; name: string } | null;
};

export type ExpenseBook = Book;

export type CategoryBudget = {
  id: number;
  category: string;
  amountLimit: number;
  spent: number;
  percentUsed: number;
  status: "OK" | "WARNING" | "OVER";
};

export type BookBudgetData = {
  bookId: number;
  totalLimit: number;
  totalSpent: number;
  totalPercentUsed: number;
  alerts: string[];
  categories: CategoryBudget[];
};

