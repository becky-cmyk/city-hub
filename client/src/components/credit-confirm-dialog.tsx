import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, Loader2 } from "lucide-react";

interface CreditConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionLabel: string;
  creditCost: number;
  currentBalance: number;
  isPending?: boolean;
}

export function CreditConfirmDialog({
  open,
  onClose,
  onConfirm,
  actionLabel,
  creditCost,
  currentBalance,
  isPending,
}: CreditConfirmDialogProps) {
  const balanceAfter = currentBalance - creditCost;
  const canAfford = currentBalance >= creditCost;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-credit-confirm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Confirm Credit Spend
          </DialogTitle>
          <DialogDescription>
            {actionLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Cost</span>
            <span className="text-sm font-semibold">{creditCost} credits</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Current Balance</span>
            <span className="text-sm font-semibold">{currentBalance} credits</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <span className="text-sm">Balance After</span>
            <span className={`text-sm font-semibold ${balanceAfter < 0 ? "text-destructive" : ""}`}>
              {canAfford ? balanceAfter : "Insufficient"} {canAfford ? "credits" : ""}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isPending} data-testid="button-credit-cancel">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!canAfford || isPending}
            data-testid="button-credit-confirm"
          >
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing</>
            ) : (
              <>Use {creditCost} Credits</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
