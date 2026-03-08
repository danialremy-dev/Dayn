import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { dayKeyLocal } from '@/src/utils/dates';
import { addTodo, getTodosForDay, toggleTodoDone, type TodoRow } from '@/src/db/todos';
import { getHabitsForToday, toggleHabitForDay, type HabitWithTodayStatus } from '@/src/db/habits';

export default function TodayScreen() {
  const colorScheme = useColorScheme();
  const today = useMemo(() => dayKeyLocal(new Date()), []);
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [habits, setHabits] = useState<HabitWithTodayStatus[]>([]);
  const [newTodo, setNewTodo] = useState('');

  async function refresh() {
    try {
      setTodos(getTodosForDay(today));
      setHabits(getHabitsForToday(today));
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load today view.');
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container} testID="today-screen">
      <Text style={styles.title}>Today</Text>

      <Text style={styles.sectionTitle}>Habits</Text>
      <View style={styles.card}>
        {habits.length === 0 ? (
          <Text style={styles.muted}>No habits yet. Add some in the Habits tab.</Text>
        ) : (
          habits.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => {
                toggleHabitForDay(h.id, today);
                refresh();
              }}
              style={styles.row}>
              <Text style={[styles.rowTitle, h.isDoneToday ? styles.done : undefined]}>
                {h.name}
              </Text>
              <Text style={styles.muted}>{h.isDoneToday ? 'Done' : 'Tap to mark'}</Text>
            </Pressable>
          ))
        )}
      </View>

      <Text style={styles.sectionTitle}>To-dos</Text>
      <View style={styles.card}>
        <View style={styles.inputRow}>
          <TextInput
            value={newTodo}
            onChangeText={setNewTodo}
            placeholder="Add a to-do for today"
            placeholderTextColor="#888"
            style={[styles.input, { color: Colors[colorScheme].text }]}
            onSubmitEditing={() => {
              const title = newTodo.trim();
              if (!title) return;
              addTodo({ title, day: today });
              setNewTodo('');
              refresh();
            }}
          />
          <Pressable
            onPress={() => {
              const title = newTodo.trim();
              if (!title) return;
              addTodo({ title, day: today });
              setNewTodo('');
              refresh();
            }}
            style={styles.addButton}>
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>

        {todos.length === 0 ? (
          <Text style={styles.muted}>No to-dos yet.</Text>
        ) : (
          todos.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => {
                toggleTodoDone(t.id, !t.is_done);
                refresh();
              }}
              style={styles.row}>
              <Text style={[styles.rowTitle, t.is_done ? styles.done : undefined]}>{t.title}</Text>
              <Text style={styles.muted}>{t.is_done ? 'Done' : 'Tap to complete'}</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,150,150,0.35)',
  },
  muted: {
    opacity: 0.7,
  },
  row: {
    paddingVertical: 10,
    gap: 4,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  done: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
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
  addButtonText: {
    fontWeight: '700',
  },
});
