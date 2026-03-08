import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { format } from 'date-fns';

import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { exchangeCodeForToken, fetchStravaActivities, refreshStravaToken } from '@/src/strava/api';
import {
  clearStravaTokens,
  getStravaConfig,
  getStravaTokens,
  setStravaConfig,
  setStravaTokens,
  type StravaConfig,
  type StravaTokens,
} from '@/src/strava/storage';
import {
  getWeeklyDistanceGoalKm,
  listRecentStravaActivities,
  setWeeklyDistanceGoalKm,
  upsertStravaActivities,
  type StravaActivityRow,
} from '@/src/db/sports';

const scopes = ['read', 'activity:read_all'];

export default function SportsScreen() {
  const colorScheme = useColorScheme();
  const redirectUri = useMemo(() => AuthSession.makeRedirectUri({ scheme: 'lifestyleapp' }), []);

  const [config, setConfig] = useState<StravaConfig | null>(null);
  const [tokens, setTokens] = useState<StravaTokens | null>(null);
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [goalKmInput, setGoalKmInput] = useState('');
  const [activities, setActivities] = useState<StravaActivityRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const cfg = await getStravaConfig();
    const t = await getStravaTokens();
    setConfig(cfg);
    setTokens(t);
    setClientIdInput(cfg?.clientId ?? '');
    setClientSecretInput(cfg?.clientSecret ?? '');
    const goal = getWeeklyDistanceGoalKm();
    setGoalKmInput(goal != null ? String(goal) : '');
    setActivities(listRecentStravaActivities(10));
  }

  useEffect(() => {
    load();
  }, []);

  async function ensureFreshAccessToken() {
    if (!config || !tokens) throw new Error('Strava is not connected yet.');
    const now = Math.floor(Date.now() / 1000);
    if (tokens.expiresAt > now + 60) return tokens.accessToken;
    const refreshed = await refreshStravaToken({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: tokens.refreshToken,
    });
    const next: StravaTokens = {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: refreshed.expires_at,
      athleteId: refreshed.athlete?.id,
      scope: refreshed.scope,
    };
    await setStravaTokens(next);
    setTokens(next);
    return next.accessToken;
  }

  async function connectStrava() {
    const cfg = config;
    if (!cfg) {
      Alert.alert('Missing Strava app', 'Save a Client ID + Client Secret first.');
      return;
    }
    setBusy(true);
    try {
      const authUrl =
        'https://www.strava.com/oauth/mobile/authorize' +
        `?client_id=${encodeURIComponent(cfg.clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&approval_prompt=auto` +
        `&scope=${encodeURIComponent(scopes.join(','))}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) return;
      const code = new URL(result.url).searchParams.get('code') ?? undefined;
      if (!code) throw new Error('No authorization code returned.');

      const token = await exchangeCodeForToken({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        code,
      });

      const next: StravaTokens = {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_at,
        athleteId: token.athlete?.id,
        scope: token.scope,
      };
      await setStravaTokens(next);
      setTokens(next);
      Alert.alert('Connected', 'Strava connected successfully.');
    } catch (e) {
      Alert.alert('Strava error', e instanceof Error ? e.message : 'Failed to connect to Strava.');
    } finally {
      setBusy(false);
    }
  }

  async function syncActivities() {
    setBusy(true);
    try {
      const accessToken = await ensureFreshAccessToken();
      const latest = await fetchStravaActivities({ accessToken, perPage: 30, page: 1 });
      upsertStravaActivities(latest);
      setActivities(listRecentStravaActivities(10));
      Alert.alert('Synced', 'Imported latest activities from Strava.');
    } catch (e) {
      Alert.alert('Sync error', e instanceof Error ? e.message : 'Failed to sync activities.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container} testID="sports-screen">
      <Text style={styles.title}>Sports</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Strava connection</Text>
        <TextInput
          value={clientIdInput}
          onChangeText={setClientIdInput}
          placeholder="Strava Client ID"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
          autoCapitalize="none"
        />
        <TextInput
          value={clientSecretInput}
          onChangeText={setClientSecretInput}
          placeholder="Strava Client Secret"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
          autoCapitalize="none"
          secureTextEntry
        />
        <Pressable
          style={styles.primaryButton}
          disabled={busy}
          onPress={async () => {
            const clientId = clientIdInput.trim();
            const clientSecret = clientSecretInput.trim();
            if (!clientId || !clientSecret) return;
            const next = { clientId, clientSecret };
            await setStravaConfig(next);
            setConfig(next);
            Alert.alert('Saved', 'Strava Client ID/Secret saved on this device.');
          }}>
          <Text style={styles.primaryButtonText}>Save Strava app details</Text>
        </Pressable>

        <Pressable style={styles.secondaryButton} disabled={busy || !config} onPress={connectStrava}>
          <Text style={styles.secondaryButtonText}>
            {tokens ? 'Reconnect Strava' : 'Connect Strava'}
          </Text>
        </Pressable>

        {tokens ? (
          <Pressable
            style={styles.secondaryButton}
            disabled={busy}
            onPress={async () => {
              await clearStravaTokens();
              setTokens(null);
            }}>
            <Text style={styles.secondaryButtonText}>Disconnect</Text>
          </Pressable>
        ) : null}
        <Text style={styles.muted}>
          This is a personal/local-only app: your Strava tokens are stored on-device.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Training goal</Text>
        <TextInput
          value={goalKmInput}
          onChangeText={setGoalKmInput}
          placeholder="Weekly distance goal (km)"
          placeholderTextColor="#888"
          style={[styles.input, { color: Colors[colorScheme].text }]}
          keyboardType="decimal-pad"
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            const n = Number(goalKmInput);
            if (!Number.isFinite(n) || n <= 0) return;
            setWeeklyDistanceGoalKm(n);
            Alert.alert('Saved', 'Weekly distance goal updated.');
          }}>
          <Text style={styles.primaryButtonText}>Save goal</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recent activities</Text>
        <Pressable style={styles.primaryButton} disabled={busy || !tokens} onPress={syncActivities}>
          <Text style={styles.primaryButtonText}>Import from Strava</Text>
        </Pressable>

        {activities.length === 0 ? (
          <Text style={styles.muted}>No activities imported yet.</Text>
        ) : (
          activities.map((a) => (
            <View key={a.id} style={styles.row}>
              <Text style={styles.rowTitle}>{a.name || a.sport_type || a.type || 'Activity'}</Text>
              <Text style={styles.muted}>
                {a.start_date ? format(new Date(a.start_date), 'PP') : '—'} ·{' '}
                {a.distance != null ? `${(a.distance / 1000).toFixed(1)} km` : '—'}
              </Text>
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
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(100,100,100,0.35)',
    alignItems: 'center',
  },
  secondaryButtonText: { fontWeight: '700' },
  row: { paddingVertical: 8, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
});

