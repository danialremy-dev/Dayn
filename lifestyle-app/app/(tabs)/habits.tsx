import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addHabit, listHabits, type HabitRow } from '@/src/db/habits';

export default function HabitsScreen() {
  const colorScheme = useColorScheme();
  const [rows, setRows] = useState<HabitRow[]>([]);
  const [name, setName] = useState('');

  function refresh() {
    setRows(listHabits());
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={styles.container} testID="habits-screen">
      <Text style={styles.title}>Habits</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Habit name (e.g., Drink water)"
            placeholderTextColor="#888"
            style={[styles.input, { color: Colors[colorScheme].text }]}
            onSubmitEditing={() => {
              const n = name.trim();
              if (!n) return;
              addHabit({ name: n });
              setName('');
              refresh();
            }}
          />
          <Pressable
            style={styles.addButton}
            onPress={() => {
              const n = name.trim();
              if (!n) return;
              addHabit({ name: n });
              setName('');
              refresh();
            }}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Tip: mark habits as done from the Today tab.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>All habits</Text>
        {rows.length === 0 ? (
          <Text style={styles.muted}>No habits yet.</Text>
        ) : (
          rows.map((h) => (
            <View key={h.id} style={styles.row}>
              <Text style={styles.rowTitle}>{h.name}</Text>
              <Text style={styles.muted}>{h.is_active ? 'Active' : 'Inactive'}</Text>
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
  inputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.5)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(99,102,241,0.85)',
  },
  addButtonText: { fontWeight: '700' },
  row: { paddingVertical: 8, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
});

