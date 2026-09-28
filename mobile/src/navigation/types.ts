import type { Expense } from "../types";

export type AuthStackParamList = {
  Onboarding: undefined;
  CreateProfile: undefined;
};

export type AppStackParamList = {
  Flats: undefined;
  CreateFlat: { initialTab?: "create" | "join" } | undefined;
  FlatDetail: { flatId: number; flatName: string };
  CreateBook: { flatId: number };
  BookDetail: { bookId: number; bookName: string; flatId: number };
  AddExpense: { bookId: number; flatId: number; expenseToEdit?: Expense };
  Profile: undefined;
};


export type FlatTabParamList = {
  Home: undefined;
  Expenses: undefined;
  Balances: undefined;
  Tasks: undefined;
  More: undefined;
};
