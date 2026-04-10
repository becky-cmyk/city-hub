import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, Check, AlertTriangle } from "lucide-react";
import { useDefaultCityId } from "@/hooks/use-city";

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === "," || ch === "\t") {
          row.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    row.push(current.trim());
    return row;
  });
}

export default function CsvImport({ cityId }: { cityId?: string }) {
  const CITY_ID = useDefaultCityId();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: number; errorDetails?: string[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length > 0) {
        setHeaders(rows[0]);
        const dataRows = rows.slice(1);
        setTotalRows(dataRows.length);
        setPreview(dataRows.slice(0, 10));
      }
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith(".csv") || f.name.endsWith(".tsv"))) {
        handleFile(f);
      } else {
        toast({ title: "Please upload a .csv or .tsv file", variant: "destructive" });
      }
    },
    [handleFile, toast]
  );

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cityId", CITY_ID);
      const resp = await fetch("/api/admin/businesses/csv-import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await resp.json();
      const imported = data.imported ?? data.success ?? 0;
      const errors = data.errors ?? data.failed ?? 0;
      const errorDetails = data.errorDetails ?? data.failures ?? [];
      setResult({ imported, errors, errorDetails });
      toast({ title: `Import complete: ${imported} imported, ${errors} errors` });
    } catch {
      toast({ title: "Import failed", variant: "destructive" });
    }
    setImporting(false);
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setHeaders([]);
    setTotalRows(0);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-lg" data-testid="text-csv-import-title">CSV Import</h2>
          <p className="text-sm text-muted-foreground">Bulk import businesses from CSV/TSV files</p>
        </div>
        <Button variant="outline" asChild data-testid="button-download-template">
          <a href="/api/admin/businesses/csv-template" download>
            <Download className="h-4 w-4 mr-1" /> Download Template
          </a>
        </Button>
      </div>

      <Card
        className={`p-8 border-2 border-dashed text-center transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        data-testid="dropzone-csv"
      >
        <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
        <h3 className="font-semibold mb-1">
          {file ? file.name : "Drop CSV/TSV file here or click to browse"}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {file ? `${totalRows} rows found, ready to import` : "Supports .csv and .tsv files"}
        </p>
        <input
          type="file"
          accept=".csv,.tsv"
          ref={fileRef}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          data-testid="input-csv-file"
        />
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => fileRef.current?.click()} data-testid="button-browse-file">
            <Upload className="h-4 w-4 mr-1" /> Browse Files
          </Button>
          {file && (
            <>
              <Button onClick={handleImport} disabled={importing} data-testid="button-import-csv">
                {importing ? "Importing..." : "Import"}
              </Button>
              <Button variant="ghost" onClick={reset} data-testid="button-reset-csv">
                Clear
              </Button>
            </>
          )}
        </div>
      </Card>

      {preview && preview.length > 0 && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium text-sm">Preview (first {preview.length} of {totalRows} rows)</h3>
            <Badge variant="secondary" data-testid="badge-row-count">{totalRows} rows</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" data-testid="table-csv-preview">
              <thead>
                <tr className="border-b">
                  {headers.map((h, i) => (
                    <th key={i} className="text-left p-1.5 font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, ri) => (
                  <tr key={ri} className="border-b last:border-0">
                    {headers.map((_, ci) => (
                      <td key={ci} className="p-1.5 whitespace-nowrap max-w-[200px] truncate">{row[ci] || ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-4 space-y-3" data-testid="card-import-result">
          <div className="flex items-center gap-2">
            {result.errors === 0 ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            <h3 className="font-medium">Import Results</h3>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-green-500" />
              <span data-testid="text-import-success">{result.imported} imported successfully</span>
            </div>
            {result.errors > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span data-testid="text-import-errors">{result.errors} errors</span>
              </div>
            )}
          </div>
          {result.errorDetails && result.errorDetails.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {result.errorDetails.map((err, i) => (
                <div key={i} className="text-xs text-destructive bg-destructive/5 rounded px-2 py-1" data-testid={`text-error-detail-${i}`}>
                  {err}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
