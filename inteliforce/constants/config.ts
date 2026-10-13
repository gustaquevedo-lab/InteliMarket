const rawBaseUrl = process.env.EXPO_PUBLIC_API_URL || 'https://inteliforce.intellihouse.lat';
const apiBaseUrl = rawBaseUrl.endsWith('/api/v1/inteliforce')
  ? rawBaseUrl
  : `${rawBaseUrl.replace(/\/+$/, '')}/api/v1/inteliforce`;

export const config = {
  apiBaseUrl,
  companyId: process.env.EXPO_PUBLIC_COMPANY_ID || '00000000-0000-0000-0000-000000000010',
  gps: {
    targetAccuracyM: 50,       // Readings <= 50m are considered good
    acceptableAccuracyM: 100,   // Fallback after timeout
    timeoutMs: 15000,          // Max wait for precision fix
    backgroundIntervalMs: 30000,
    backgroundDistanceM: 50,
  },
  sync: {
    periodicIntervalSec: 60,
    maxRetries: 5,
  },
};
