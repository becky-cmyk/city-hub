import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAdminEdit } from "@/hooks/use-admin-edit";
import { Button } from "@/components/ui/button";

export function AdminEditFab() {
  const { isAdmin } = useAuth();
  const { target } = useAdminEdit();

  if (!isAdmin || !target) return null;

  const adminPath = `/admin/${target.section}?entityId=${encodeURIComponent(target.entityId)}`;

  return (
    <a
      href={adminPath}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50"
      data-testid="link-admin-fab"
    >
      <Button
        size="sm"
        className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-lg rounded-full px-4"
        data-testid="button-admin-fab"
      >
        <Settings className="h-4 w-4" />
        {target.label || "Edit"}
      </Button>
    </a>
  );
}
