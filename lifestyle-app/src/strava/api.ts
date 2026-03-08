import { z } from 'zod';

const TokenResponseSchema = z.object({
  token_type: z.string().optional(),
  access_token: z.string(),
  expires_at: z.number().int(),
  expires_in: z.number().int().optional(),
  refresh_token: z.string(),
  athlete: z
    .object({
      id: z.number().int(),
    })
    .optional(),
  scope: z.string().optional(),
});

export type StravaTokenResponse = z.infer<typeof TokenResponseSchema>;

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava request failed (${res.status}): ${text || res.statusText}`);
  }
  return res.json();
}

export async function exchangeCodeForToken(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}) {
  const json = await postForm('https://www.strava.com/oauth/token', {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: 'authorization_code',
  });
  const parsed = TokenResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error('Unexpected Strava token response.');
  return parsed.data;
}

export async function refreshStravaToken(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const json = await postForm('https://www.strava.com/oauth/token', {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  });
  const parsed = TokenResponseSchema.safeParse(json);
  if (!parsed.success) throw new Error('Unexpected Strava refresh response.');
  return parsed.data;
}

const ActivitySchema = z.object({
  id: z.number().int(),
  name: z.string().optional(),
  type: z.string().optional(),
  sport_type: z.string().optional(),
  start_date: z.string().optional(),
  distance: z.number().optional(),
  moving_time: z.number().int().optional(),
  elapsed_time: z.number().int().optional(),
  total_elevation_gain: z.number().optional(),
  average_speed: z.number().optional(),
  kudos_count: z.number().int().optional(),
});
export type StravaActivity = z.infer<typeof ActivitySchema>;

export async function fetchStravaActivities(input: {
  accessToken: string;
  page?: number;
  perPage?: number;
}) {
  const page = input.page ?? 1;
  const perPage = input.perPage ?? 30;
  const url = `https://www.strava.com/api/v3/athlete/activities?page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava activities failed (${res.status}): ${text || res.statusText}`);
  }
  const json = await res.json();
  if (!Array.isArray(json)) throw new Error('Unexpected Strava activities response.');
  const parsed = z.array(ActivitySchema).safeParse(json);
  if (!parsed.success) throw new Error('Unexpected Strava activities shape.');
  return parsed.data;
}

