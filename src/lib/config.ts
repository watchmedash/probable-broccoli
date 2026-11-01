// Public values only. The publishable key is meant for browsers; every rule is enforced in the database.
export const SUPABASE_URL = "https://ofyhrdxecqwnhbchvitq.supabase.co";
export const SUPABASE_KEY = "sb_publishable_91vqr8Q8o0f6xBxdXIcUcA_BSqtf_nz";
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFshuKwP7mwgwjPw";
export const SITE_URL = "https://nakodu.top";
export const PLAY_URL = "https://play.google.com/store/apps/details?id=com.nakodu.app";
export const PAGE_SIZE = 20;

// Google AdSense. Feed ads stay off until the in-feed ad unit's slot and layout key are filled in.
export const ADSENSE_CLIENT = "ca-pub-5412699736062085";
export const ADSENSE_FEED_SLOT = "6274516221";
export const ADSENSE_FEED_LAYOUT = "-6h+ca+1m-10+au";
/** One ad after this many posts. */
export const AD_EVERY = 8;

/** Accounts are a username and a password; Supabase gets a placeholder address that never receives mail. */
export const hiddenEmail = (username: string) => `${username.trim().toLowerCase()}@users.nakodu.invalid`;
