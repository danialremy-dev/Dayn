import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import {
  addDebt,
  addFinanceGoal,
  listDebts,
  listFinanceGoals,
  type DebtRow,
  type FinanceGoalRow,
} from '@/src/db/finance';

export default function FinanceScreen() {
  const colorScheme = useColorScheme();
  const [goals, setGoals] = useState<FinanceGoalRow[]>([]);
  const [debts, setDebts] = useState<DebtRow[]>([]);

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');

  const [debtName, setDebtName] = useState('');
  const [debtBalance, setDebtBalance] = useState('');

  function refresh() {
    setGoals(listFinanceGoals());
    setDebts(listDebts());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={styles.container} testID="finance-screen">
      <Text style={styles.title}>Finance</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Savings goals</Text>
        <TextInput
          value={goalName}
          onChangeText={setGoalName}
          placeholder="Goal name (e.g., Emergency fund)"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
        />
        <TextInput
          value={goalTarget}
          onChangeText={setGoalTarget}
          placeholder="Target amount"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
          keyboardType="decimal-pad"
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            const n = goalName.trim();
            const t = Number(goalTarget);
            if (!n) return;
            if (!Number.isFinite(t) || t <= 0) {
              Alert.alert('Invalid target', 'Enter a positive number.');
              return;
            }
            addFinanceGoal({ name: n, targetAmount: t });
            setGoalName('');
            setGoalTarget('');
            refresh();
          }}>
          <Text style={styles.primaryButtonText}>Add goal</Text>
        </Pressable>

        {goals.length === 0 ? (
          <Text style={styles.muted}>No goals yet.</Text>
        ) : (
          goals.map((g) => (
            <View key={g.id} style={styles.row}>
              <Text style={styles.rowTitle}>{g.name}</Text>
              <Text style={styles.muted}>
                {g.current_amount.toFixed(2)} / {g.target_amount.toFixed(2)}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Debts</Text>
        <TextInput
          value={debtName}
          onChangeText={setDebtName}
          placeholder="Debt name (e.g., Credit card)"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
        />
        <TextInput
          value={debtBalance}
          onChangeText={setDebtBalance}
          placeholder="Current balance"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
          keyboardType="decimal-pad"
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            const n = debtName.trim();
            const b = Number(debtBalance);
            if (!n) return;
            if (!Number.isFinite(b) || b <= 0) {
              Alert.alert('Invalid balance', 'Enter a positive number.');
              return;
            }
            addDebt({ name: n, balance: b });
            setDebtName('');
            setDebtBalance('');
            refresh();
          }}>
          <Text style={styles.primaryButtonText}>Add debt</Text>
        </Pressable>

        {debts.length === 0 ? (
          <Text style={styles.muted}>No debts yet.</Text>
        ) : (
          debts.map((d) => (
            <View key={d.id} style={styles.row}>
              <Text style={styles.rowTitle}>{d.name}</Text>
              <Text style={styles.muted}>{d.current_balance.toFixed(2)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: 'bold' },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.35)',
  },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  muted: { opacity: 0.7 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.85)',
    alignItems: 'center',
  },
  primaryButtonText: { fontWeight: '700' },
  row: { paddingVertical: 8, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
});

