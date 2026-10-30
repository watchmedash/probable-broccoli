export type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at?: string;
  cover_url?: string | null;
  banned_at?: string | null;
};

export type Hub = {
  id: number;
  name: string;
  description: string;
  color: string;
  created_by: string | null;
  who_can_post: string;
  member_count: number;
  icon_url: string | null;
  banner_url: string | null;
  rules: string;
  privacy: string;
  status: string;
  who_can_comment: string;
  allow_images: boolean;
  allow_polls: boolean;
  is_mature: boolean;
  link_domains: string[] | null;
  flair_required: boolean;
  members_only: boolean;
  allow_crossposts?: boolean;
  automod_words?: string[];
  automod_domains?: string[];
  automod_min_days?: number;
  allow_user_flair?: boolean;
  /** 18+ hubs only: keep the swearing filter on anyway. */
  filter_swearing?: boolean;
};

export type PollOption = { id: number; position: number; label: string; votes: number };
export type Flair = { id: number; label: string; color: string };

export type Post = {
  id: number;
  community_id: number | null;
  title: string;
  body: string;
  score: number;
  comment_count: number;
  created_at: string;
  edited_at: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  pinned_at: string | null;
  locked: boolean;
  spoiler: boolean;
  mature: boolean;
  community: (Pick<Hub, "id" | "name" | "color" | "icon_url" | "is_mature" | "link_domains" | "status" | "who_can_comment" | "created_by" | "privacy" | "who_can_post"> & { allow_crossposts?: boolean; allow_user_flair?: boolean }) | null;
  author: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  poll: PollOption[] | null;
  flair: Flair | null;
  my_vote?: { value: number }[];
  my_poll?: { option_id: number }[];
  my_save?: { post_id: number }[];
  original?: {
    id: number; title: string; body: string; image_url: string | null; image_urls: string[] | null; created_at: string;
    community: Pick<Hub, "id" | "name" | "color" | "icon_url"> | null;
    author: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  } | null;
};

export type Comment = {
  id: number;
  post_id: number;
  parent_id: number | null;
  body: string;
  score: number;
  depth: number;
  deleted: boolean;
  created_at: string;
  edited_at: string | null;
  author: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  my_vote?: { value: number }[] | number;
};

export type Notification = {
  id: number;
  type: string;
  read: boolean;
  created_at: string;
  comment_id: number | null;
  detail: string | null;
  thread_id: number | null;
  actor: Pick<Profile, "id" | "username" | "avatar_url"> | null;
  post: { id: number; title: string } | null;
};

export const myVote = (rows?: { value: number }[] | number): number =>
  typeof rows === "number" ? rows : rows?.[0]?.value ?? 0;
