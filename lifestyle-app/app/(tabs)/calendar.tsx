import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';
import { format } from 'date-fns';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { addAppointment, listUpcomingAppointments, type AppointmentRow } from '@/src/db/appointments';

function parseLocalDateTime(input: string) {
  const s = input.trim().replace(' ', 'T');
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0, 0);
}

export default function CalendarScreen() {
  const colorScheme = useColorScheme();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() => format(new Date(), 'yyyy-MM-dd HH:mm'));

  function refresh() {
    setRows(listUpcomingAppointments(50));
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <View style={styles.container} testID="calendar-screen">
      <Text style={styles.title}>Appointments</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Add</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
        />
        <TextInput
          value={when}
          onChangeText={setWhen}
          placeholder="YYYY-MM-DD HH:mm"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            const t = title.trim();
            if (!t) return;
            const dt = parseLocalDateTime(when);
            if (!dt) {
              Alert.alert('Invalid date', 'Use format: YYYY-MM-DD HH:mm');
              return;
            }
            addAppointment({ title: t, startsAt: dt });
            setTitle('');
            refresh();
          }}>
          <Text style={styles.primaryButtonText}>Add appointment</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Upcoming</Text>
        {rows.length === 0 ? (
          <Text style={styles.muted}>No upcoming appointments.</Text>
        ) : (
          rows.map((a) => (
            <View key={a.id} style={styles.row}>
              <Text style={styles.rowTitle}>{a.title}</Text>
              <Text style={styles.muted}>{format(new Date(a.starts_at), 'PPpp')}</Text>
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
  row: { paddingVertical: 8, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
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
});

