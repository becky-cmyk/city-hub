import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface LockedFeatureCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isPending?: boolean;
}

export function LockedFeatureCard({ title, description, actionLabel, onAction, isPending }: LockedFeatureCardProps) {
  return (
    <Card className="p-5 border-dashed border-2 border-muted-foreground/20" data-testid="card-locked-feature">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm" data-testid="text-locked-title">{title}</h3>
          <p className="text-xs text-muted-foreground mt-1" data-testid="text-locked-description">{description}</p>
          {actionLabel && onAction && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onAction}
              disabled={isPending}
              data-testid="button-locked-action"
            >
              {actionLabel}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
