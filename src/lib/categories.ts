// The hub categories, in the order they're shown. The database keeps the same list (hub_category_list).
export const CATEGORIES: [slug: string, label: string][] = [
  ["discussion", "Discussion"], ["news", "News"], ["politics", "Politics"], ["philippines", "Philippines"],
  ["humor", "Humor & Memes"], ["entertainment", "Entertainment"], ["movies-tv", "Movies & TV"], ["music", "Music"],
  ["gaming", "Gaming"], ["tech", "Technology"], ["science", "Science"], ["learning", "Learning"],
  ["books", "Books & Writing"], ["horror", "Horror & Mystery"], ["food", "Food & Drink"], ["travel", "Travel"],
  ["health", "Health & Fitness"], ["sports", "Sports"], ["money", "Money & Business"], ["careers", "Jobs & Careers"],
  ["art", "Art & Design"], ["lifestyle", "Lifestyle"], ["relationships", "Relationships"], ["buy-sell", "Buy & Sell"],
  ["freebies", "Freebies & Deals"],
];

export const categoryLabel = (slug: string) => CATEGORIES.find(c => c[0] === slug)?.[1] ?? slug;
