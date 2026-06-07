export const queryKeys = {
  stats: ["stats"] as const,
  popular: ["popular"] as const,
  trending: (type: string, region: string) => ["trending", type, region] as const,
  search: (paramsKey: string) => ["search", paramsKey] as const,
  suggestions: (q: string) => ["search-suggestions", q] as const,
  video: (videoId: string, region: string) => ["video", videoId, region] as const,
  comments: (videoId: string, sortBy: string, continuation?: string) =>
    ["comments", videoId, sortBy, continuation ?? ""] as const,
  captions: (videoId: string) => ["captions", videoId] as const,
  channel: (authorId: string) => ["channel", authorId] as const,
  channelVideos: (authorId: string, sortBy: string, continuation?: string) =>
    ["channel-videos", authorId, sortBy, continuation ?? ""] as const,
  channelShorts: (authorId: string, continuation?: string) => ["channel-shorts", authorId, continuation ?? ""] as const,
  channelStreams: (authorId: string, continuation?: string) =>
    ["channel-streams", authorId, continuation ?? ""] as const,
  channelPlaylists: (authorId: string, continuation?: string) =>
    ["channel-playlists", authorId, continuation ?? ""] as const,
  playlist: (playlistId: string, page?: number) => ["playlist", playlistId, page ?? 1] as const,
  authFeed: (page = 1) => ["auth-feed", page] as const,
  authPlaylists: ["auth-playlists"] as const,
  authSubscriptions: ["auth-subscriptions"] as const,
  localSubscriptions: (userId: string) => ["local-subscriptions", userId] as const,
  preferences: ["preferences"] as const,
};
