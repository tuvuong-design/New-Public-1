export const analyticsKeys = {
  // ZSET sessionId -> lastSeenMs
  realtimeViewers(videoId: string) {
    return `videoshare:realtime:viewers:v1:${videoId}`;
  },

  // SET of sessionIds per video/day for unique view counting
  uniqueViewSet(videoId: string, dayIso: string) {
    return `videoshare:analytics:uv:v1:${videoId}:${dayIso}`;
  },

  // HASH sessionId -> maxPctBp (0..10000) per video/day
  retentionMaxHash(videoId: string, dayIso: string) {
    return `videoshare:analytics:retmax:v1:${videoId}:${dayIso}`;
  },
};
