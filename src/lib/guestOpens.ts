import type { useRouter } from "next/navigation";

/** Guests read feeds, and clicking through to a post asks them to log in. The links stay real, so shared links and search engines still reach the post. */
export function guestOpens(signedIn: boolean, router: ReturnType<typeof useRouter>, href: string) {
  return (e: React.MouseEvent) => {
    if (signedIn || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    router.push(`/login?next=${href}`);
  };
}
