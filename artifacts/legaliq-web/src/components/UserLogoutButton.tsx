import { LogOut } from "lucide-react";
import { useClerk } from "@clerk/react";
import { useStore } from "@/store/useStore";
import { basePath } from "@/lib/clerk";

export function UserLogoutButton({ showLabel = true }: { showLabel?: boolean }) {
  const { signOut } = useClerk();
  const reset = useStore((state) => state.reset);

  async function handleLogout() {
    reset();
    await signOut({ redirectUrl: `${basePath}/`.replace(/\/\//g, "/") });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-sm liq-text-2 hover:text-[#C9A84C] border border-[#C9A84C]/20 hover:border-[#C9A84C]/40 px-3 py-2 rounded-lg transition-all"
      title="Log out"
      aria-label="Log out"
    >
      <LogOut size={14} />
      {showLabel && <span>Log out</span>}
    </button>
  );
}