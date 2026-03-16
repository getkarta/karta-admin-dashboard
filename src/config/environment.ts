export const environment = {
  production: false,
  staging: false,
  development: true,
  apiUrl: 'https://api-staging.getkarta.ai/',
  batchApiUrl: 'https://pw6m59869d.execute-api.us-east-1.amazonaws.com/prod',
  callLogsApiUrl: 'https://c1ne1qg5v5.execute-api.us-east-1.amazonaws.com/default',
  toolsApiUrl: 'https://4nvjwcqbdl.execute-api.us-east-1.amazonaws.com/stage',
  dashboardUrl: 'https://dashboard-dev.getkarta.ai',
  /** When true, call details API only and show transcript from its response. When false, use transcript API only. */
  useDetailsApiForTranscript: false,
  livekit: {
    url: 'wss://karta-plivo-u3xjbqle.livekit.cloud',
    serverUrl: 'https://karta-plivo-u3xjbqle.livekit.cloud',
    apiKey: 'APIEF8rSicsTTjv',
    apiSecret: 'eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoidXNlciIsInZpZGVvIjp7InJvb20iOiJ2b2ljZV9hc3Npc3RhbnRfcm9vbV83NjE2Iiwicm9vbUpvaW4iOnRydWUsImNhblB1Ymxpc2giOnRydWUsImNhblB1Ymxpc2hEYXRhIjp0cnVlLCJjYW5TdWJzY3JpYmUiOnRydWV9LCJpc3MiOiJBUElFRjhyU2ljc1RUanYiLCJleHAiOjE3NTA0MzEyMTAsIm5iZiI6MCwic3ViIjoidm9pY2VfYXNzaXN0YW50X3VzZXJfNjQ4NiJ9.UTugHMEUh03sc0yZdaizzuNiziIdT4YaE1sbXKFBdeQ'
  }
}; 
