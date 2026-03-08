import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';

const configKey = 'strava_config_v1';
const tokensKey = 'strava_tokens_v1';

const StravaConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

const StravaTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int(),
  athleteId: z.number().int().optional(),
  scope: z.string().optional(),
});

export type StravaConfig = z.infer<typeof StravaConfigSchema>;
export type StravaTokens = z.infer<typeof StravaTokensSchema>;

export async function getStravaConfig(): Promise<StravaConfig | null> {
  const raw = await SecureStore.getItemAsync(configKey);
  if (!raw) return null;
  const parsed = StravaConfigSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function setStravaConfig(config: StravaConfig) {
  await SecureStore.setItemAsync(configKey, JSON.stringify(config));
}

export async function getStravaTokens(): Promise<StravaTokens | null> {
  const raw = await SecureStore.getItemAsync(tokensKey);
  if (!raw) return null;
  const parsed = StravaTokensSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export async function setStravaTokens(tokens: StravaTokens) {
  await SecureStore.setItemAsync(tokensKey, JSON.stringify(tokens));
}

export async function clearStravaTokens() {
  await SecureStore.deleteItemAsync(tokensKey);
}

