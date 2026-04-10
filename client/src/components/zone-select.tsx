import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useMemo, useState } from "react";

interface ZoneOption {
  id: string;
  slug: string;
  name: string;
  county?: string | null;
  stateCode?: string | null;
  type?: string;
}

interface ZoneSelectProps {
  zones: ZoneOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  testId?: string;
}

const TYPE_ORDER = ["COUNTY", "DISTRICT", "NEIGHBORHOOD", "ZIP"] as const;
const TYPE_LABELS: Record<string, string> = {
  COUNTY: "County",
  DISTRICT: "City / Town",
  NEIGHBORHOOD: "Neighborhood",
  ZIP: "Zip Code",
  MICRO_HUB: "Micro Hub",
};

export function ZoneSelect({ zones, value, onValueChange, placeholder, triggerClassName, testId }: ZoneSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const resolvedPlaceholder = placeholder || t("directory.allZones");

  const grouped = useMemo(() => {
    const byType: Record<string, ZoneOption[]> = {};
    for (const z of zones) {
      const type = z.type || "NEIGHBORHOOD";
      if (!byType[type]) byType[type] = [];
      byType[type].push(z);
    }

    const result: { label: string; type: string; items: ZoneOption[] }[] = [];
    for (const type of TYPE_ORDER) {
      if (byType[type] && byType[type].length > 0) {
        result.push({
          label: TYPE_LABELS[type] || type,
          type,
          items: byType[type].sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }
    for (const [type, items] of Object.entries(byType)) {
      if (!TYPE_ORDER.includes(type as typeof TYPE_ORDER[number]) && items.length > 0) {
        result.push({
          label: TYPE_LABELS[type] || type,
          type,
          items: items.sort((a, b) => a.name.localeCompare(b.name)),
        });
      }
    }
    return result;
  }, [zones]);

  const selectedZone = zones.find((z) => z.slug === value);
  const displayLabel = value && value !== "all" && selectedZone ? selectedZone.name : resolvedPlaceholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", triggerClassName)}
          data-testid={testId || "select-zone"}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search zip, neighborhood..." data-testid="input-zone-search-dropdown" />
          <CommandList>
            <CommandEmpty>No location found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-locations"
                onSelect={() => { onValueChange("all"); setOpen(false); }}
                data-testid="select-zone-all"
              >
                <Check className={cn("mr-2 h-4 w-4", (!value || value === "all") ? "opacity-100" : "opacity-0")} />
                {resolvedPlaceholder}
              </CommandItem>
            </CommandGroup>
            {grouped.map((group) => (
              <CommandGroup key={group.type} heading={group.label}>
                {group.items.map((z) => (
                  <CommandItem
                    key={z.id}
                    value={`${z.name} ${z.county || ""}`}
                    onSelect={() => { onValueChange(z.slug); setOpen(false); }}
                    data-testid={`select-zone-${z.slug}`}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === z.slug ? "opacity-100" : "opacity-0")} />
                    {z.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
