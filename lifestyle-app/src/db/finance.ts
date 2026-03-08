import { getDb } from './client';
import { uuid } from '@/src/utils/id';

export type FinanceGoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

export type DebtRow = {
  id: string;
  name: string;
  principal: number;
  current_balance: number;
  apr: number | null;
  minimum_payment: number | null;
  due_day: number | null;
  created_at: string;
  updated_at: string;
};

export function listFinanceGoals() {
  const db = getDb();
  return db.getAllSync<FinanceGoalRow>(
    `SELECT id, name, target_amount, current_amount, target_date, created_at, updated_at
     FROM finance_goals
     ORDER BY created_at DESC`
  );
}

export function addFinanceGoal(input: { name: string; targetAmount: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.runSync(
    `INSERT INTO finance_goals (id, name, target_amount, current_amount, target_date, created_at, updated_at)
     VALUES (?, ?, ?, 0, NULL, ?, ?)`,
    uuid(),
    input.name,
    input.targetAmount,
    now,
    now
  );
}

export function listDebts() {
  const db = getDb();
  return db.getAllSync<DebtRow>(
    `SELECT id, name, principal, current_balance, apr, minimum_payment, due_day, created_at, updated_at
     FROM debts
     ORDER BY created_at DESC`
  );
}

export function addDebt(input: { name: string; balance: number; principal?: number }) {
  const db = getDb();
  const now = new Date().toISOString();
  const principal = input.principal ?? input.balance;
  db.runSync(
    `INSERT INTO debts (id, name, principal, current_balance, apr, minimum_payment, due_day, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
    uuid(),
    input.name,
    principal,
    input.balance,
    now,
    now
  );
}

