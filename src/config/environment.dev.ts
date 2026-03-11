export const environment = {
  production: false,
  staging: false,
  development: true,
  batchApiUrl: 'https://t61o9djpm8.execute-api.us-east-1.amazonaws.com/stage',
  apiUrl: 'https://api-staging.getkarta.ai/',
  dashboardUrl: 'https://dashboard.getkarta.ai',
  /** When true, call details API only and show transcript from its response. When false, use transcript API only. */
  useDetailsApiForTranscript: true,
  livekit: {
    url: 'wss://karta-plivo-u3xjbqle.livekit.cloud',
    serverUrl: 'https://karta-plivo-u3xjbqle.livekit.cloud/settings/regions',
    apiKey: 'APIEF8rSicsTTjv',
    apiSecret: 'RXoByeJyCVTGL7OJqYcmqlx4X9GQbfSpBbjsgidnRHW'
  },
  region: 'us-east-1'
}; 
