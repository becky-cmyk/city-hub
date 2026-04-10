import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  Type, Image, Columns, Minus, ArrowUp, ArrowDown, Trash2, Plus, Eye, Code,
  ChevronDown, ChevronUp, MousePointerClick, Layout, AlignLeft, Hash
} from "lucide-react";

export type BlockType = "header" | "text" | "button" | "image" | "divider" | "spacer" | "two-column" | "footer";

export interface EmailBlock {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

const BRAND = {
  purple: "#5B1D8F",
  amber: "#F2C230",
  dark: "#1a1a2e",
  white: "#ffffff",
  lightGray: "#f5f5f5",
  gray: "#666666",
};

const MERGE_TAGS = [
  { label: "Name", value: "{{name}}" },
  { label: "Business Name", value: "{{businessName}}" },
  { label: "Claim URL", value: "{{claimUrl}}" },
  { label: "View URL", value: "{{viewUrl}}" },
  { label: "Site URL", value: "{{siteUrl}}" },
  { label: "Email", value: "{{email}}" },
  { label: "Phone", value: "{{phone}}" },
  { label: "City", value: "{{city}}" },
  { label: "Spanish Version Link", value: "{{spanishUrl}}" },
];

const BLOCK_TYPES: { type: BlockType; label: string; icon: any }[] = [
  { type: "header", label: "Header", icon: Layout },
  { type: "text", label: "Text", icon: Type },
  { type: "button", label: "Button", icon: MousePointerClick },
  { type: "image", label: "Image", icon: Image },
  { type: "divider", label: "Divider", icon: Minus },
  { type: "spacer", label: "Spacer", icon: AlignLeft },
  { type: "two-column", label: "Two Column", icon: Columns },
  { type: "footer", label: "Footer", icon: Hash },
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultBlockData(type: BlockType): Record<string, any> {
  switch (type) {
    case "header":
      return { title: "CLT Metro Hub", subtitle: "", bgColor: BRAND.purple, textColor: BRAND.white };
    case "text":
      return { content: "Enter your text here...", fontSize: "16", color: "#333333" };
    case "button":
      return { label: "Click Here", url: "https://", bgColor: BRAND.amber, textColor: BRAND.dark, align: "center" };
    case "image":
      return { src: "", alt: "", width: "100" };
    case "divider":
      return { color: "#e0e0e0", thickness: "1" };
    case "spacer":
      return { height: "20" };
    case "two-column":
      return { left: "Left column content", right: "Right column content", leftWidth: "50" };
    case "footer":
      return { text: "CLT Metro Hub | Charlotte, NC\nYou're receiving this because you're listed on our directory.", unsubscribeText: "Unsubscribe", color: BRAND.gray };
    default:
      return {};
  }
}

function blockToHtml(block: EmailBlock): string {
  const { type, data } = block;
  switch (type) {
    case "header":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${data.bgColor || BRAND.purple};">
  <tr><td style="padding:28px 32px;text-align:center;">
    <h1 style="margin:0;font-family:Arial,sans-serif;font-size:26px;font-weight:700;color:${data.textColor || BRAND.white};">${esc(data.title)}</h1>
    ${data.subtitle ? `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:14px;color:${data.textColor || BRAND.white};opacity:0.85;">${esc(data.subtitle)}</p>` : ""}
  </td></tr>
</table>`;
    case "text":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:16px 32px;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:${data.fontSize || 16}px;line-height:1.6;color:${data.color || "#333333"};">${nlToBr(esc(data.content))}</p>
  </td></tr>
</table>`;
    case "button":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:16px 32px;text-align:${data.align || "center"};">
    <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(data.url)}" style="height:48px;v-text-anchor:middle;width:200px;" arcsize="13%" fillcolor="${data.bgColor || BRAND.amber}"><w:anchorlock/><center style="color:${data.textColor || BRAND.dark};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${esc(data.label)}</center></v:roundrect><![endif]-->
    <!--[if !mso]><!--><a href="${esc(data.url)}" style="display:inline-block;padding:14px 32px;background-color:${data.bgColor || BRAND.amber};color:${data.textColor || BRAND.dark};font-family:Arial,sans-serif;font-size:16px;font-weight:700;text-decoration:none;border-radius:6px;mso-hide:all;">${esc(data.label)}</a><!--<![endif]-->
  </td></tr>
</table>`;
    case "image":
      if (!data.src) return "";
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:16px 32px;text-align:center;">
    <img src="${esc(data.src)}" alt="${esc(data.alt)}" width="${Math.round(600 * (parseInt(data.width) || 100) / 100)}" style="max-width:${data.width || 100}%;height:auto;display:block;margin:0 auto;border:0;" />
  </td></tr>
</table>`;
    case "divider":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:8px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:${data.thickness || 1}px solid ${data.color || "#e0e0e0"};font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
  </td></tr>
</table>`;
    case "spacer":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="height:${data.height || 20}px;line-height:${data.height || 20}px;font-size:1px;">&nbsp;</td></tr>
</table>`;
    case "two-column": {
      const lw = parseInt(data.leftWidth) || 50;
      const rw = 100 - lw;
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td width="${lw}%" style="padding:16px 16px 16px 32px;vertical-align:top;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#333333;">${nlToBr(esc(data.left))}</td>
    <td width="${rw}%" style="padding:16px 32px 16px 16px;vertical-align:top;font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#333333;">${nlToBr(esc(data.right))}</td>
  </tr>
</table>`;
    }
    case "footer":
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f5;">
  <tr><td style="padding:24px 32px;text-align:center;">
    <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:1.6;color:${data.color || BRAND.gray};">${nlToBr(esc(data.text))}</p>
    ${data.unsubscribeText ? `<p style="margin:8px 0 0;font-family:Arial,sans-serif;font-size:11px;"><a href="{{unsubscribeUrl}}" style="color:${data.color || BRAND.gray};">${esc(data.unsubscribeText)}</a></p>` : ""}
  </td></tr>
</table>`;
    default:
      return "";
  }
}

function esc(s: string): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nlToBr(s: string): string {
  return s.replace(/\n/g, "<br/>");
}

const BLOCKS_MARKER_START = "<!-- CCH_BLOCKS:";
const BLOCKS_MARKER_END = " -->";

export function extractBlocksFromHtml(html: string): EmailBlock[] | null {
  const startIdx = html.indexOf(BLOCKS_MARKER_START);
  if (startIdx < 0) return null;
  const dataStart = startIdx + BLOCKS_MARKER_START.length;
  const endIdx = html.indexOf(BLOCKS_MARKER_END, dataStart);
  if (endIdx < 0) return null;
  try {
    const encoded = html.substring(dataStart, endIdx);
    return JSON.parse(atob(encoded));
  } catch {
    return null;
  }
}

export function blocksToHtml(blocks: EmailBlock[]): string {
  const body = blocks.map(blockToHtml).filter(Boolean).join("\n");
  const blocksData = btoa(JSON.stringify(blocks));
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Email</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f0f0;">
<tr><td align="center" style="padding:20px 0;">
<!--[if mso]><table width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;">
${body}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
${BLOCKS_MARKER_START}${blocksData}${BLOCKS_MARKER_END}
</body>
</html>`;
}

function BlockIcon({ type }: { type: BlockType }) {
  const entry = BLOCK_TYPES.find((b) => b.type === type);
  if (!entry) return null;
  const Icon = entry.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

function BlockEditor({ block, onChange }: { block: EmailBlock; onChange: (data: Record<string, any>) => void }) {
  const { type, data } = block;

  const updateField = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  switch (type) {
    case "header":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={data.title} onChange={(e) => updateField("title", e.target.value)} data-testid="input-block-header-title" />
          </div>
          <div>
            <Label className="text-xs">Subtitle</Label>
            <Input value={data.subtitle || ""} onChange={(e) => updateField("subtitle", e.target.value)} placeholder="Optional subtitle" data-testid="input-block-header-subtitle" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Background</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.bgColor} onChange={(e) => updateField("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.bgColor} onChange={(e) => updateField("bgColor", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.textColor} onChange={(e) => updateField("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.textColor} onChange={(e) => updateField("textColor", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
          </div>
        </div>
      );
    case "text":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Content</Label>
            <Textarea value={data.content} onChange={(e) => updateField("content", e.target.value)} rows={4} data-testid="input-block-text-content" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Font Size (px)</Label>
              <Input type="number" value={data.fontSize} onChange={(e) => updateField("fontSize", e.target.value)} min="10" max="36" />
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.color} onChange={(e) => updateField("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.color} onChange={(e) => updateField("color", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
          </div>
        </div>
      );
    case "button":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Label</Label>
              <Input value={data.label} onChange={(e) => updateField("label", e.target.value)} data-testid="input-block-button-label" />
            </div>
            <div>
              <Label className="text-xs">URL</Label>
              <Input value={data.url} onChange={(e) => updateField("url", e.target.value)} placeholder="https://..." data-testid="input-block-button-url" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Button Color</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.bgColor} onChange={(e) => updateField("bgColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.bgColor} onChange={(e) => updateField("bgColor", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.textColor} onChange={(e) => updateField("textColor", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.textColor} onChange={(e) => updateField("textColor", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Align</Label>
              <Select value={data.align || "center"} onValueChange={(v) => updateField("align", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
    case "image":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Image URL</Label>
            <Input value={data.src} onChange={(e) => updateField("src", e.target.value)} placeholder="https://..." data-testid="input-block-image-src" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Alt Text</Label>
              <Input value={data.alt || ""} onChange={(e) => updateField("alt", e.target.value)} placeholder="Image description" />
            </div>
            <div>
              <Label className="text-xs">Width (%)</Label>
              <Input type="number" value={data.width} onChange={(e) => updateField("width", e.target.value)} min="10" max="100" />
            </div>
          </div>
        </div>
      );
    case "divider":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Color</Label>
            <div className="flex gap-1 items-center">
              <input type="color" value={data.color} onChange={(e) => updateField("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Input value={data.color} onChange={(e) => updateField("color", e.target.value)} className="text-xs font-mono" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Thickness (px)</Label>
            <Input type="number" value={data.thickness} onChange={(e) => updateField("thickness", e.target.value)} min="1" max="5" />
          </div>
        </div>
      );
    case "spacer":
      return (
        <div>
          <Label className="text-xs">Height (px)</Label>
          <Input type="number" value={data.height} onChange={(e) => updateField("height", e.target.value)} min="5" max="80" />
        </div>
      );
    case "two-column":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Left Column Width (%)</Label>
            <Input type="number" value={data.leftWidth} onChange={(e) => updateField("leftWidth", e.target.value)} min="20" max="80" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Left Content</Label>
              <Textarea value={data.left} onChange={(e) => updateField("left", e.target.value)} rows={3} data-testid="input-block-twocol-left" />
            </div>
            <div>
              <Label className="text-xs">Right Content</Label>
              <Textarea value={data.right} onChange={(e) => updateField("right", e.target.value)} rows={3} data-testid="input-block-twocol-right" />
            </div>
          </div>
        </div>
      );
    case "footer":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Footer Text</Label>
            <Textarea value={data.text} onChange={(e) => updateField("text", e.target.value)} rows={3} data-testid="input-block-footer-text" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Unsubscribe Text</Label>
              <Input value={data.unsubscribeText || ""} onChange={(e) => updateField("unsubscribeText", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Text Color</Label>
              <div className="flex gap-1 items-center">
                <input type="color" value={data.color || BRAND.gray} onChange={(e) => updateField("color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={data.color || BRAND.gray} onChange={(e) => updateField("color", e.target.value)} className="text-xs font-mono" />
              </div>
            </div>
          </div>
        </div>
      );
    default:
      return null;
  }
}

interface EmailBlockEditorProps {
  blocks: EmailBlock[];
  onBlocksChange: (blocks: EmailBlock[]) => void;
  onHtmlChange: (html: string) => void;
  legacyHtml?: string;
}

export default function EmailBlockEditor({ blocks, onBlocksChange, onHtmlChange, legacyHtml }: EmailBlockEditorProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addAtIndex, setAddAtIndex] = useState<number | null>(null);
  const isLegacy = blocks.length === 0 && !!legacyHtml;
  const [mode, setMode] = useState<"visual" | "code">(isLegacy ? "code" : "visual");
  const [codeHtml, setCodeHtml] = useState(isLegacy ? legacyHtml || "" : "");

  const generatedHtml = useMemo(() => blocksToHtml(blocks), [blocks]);
  const previewHtml = mode === "code" ? codeHtml : generatedHtml;

  const updateBlocks = useCallback((newBlocks: EmailBlock[]) => {
    onBlocksChange(newBlocks);
    onHtmlChange(blocksToHtml(newBlocks));
  }, [onBlocksChange, onHtmlChange]);

  const addBlock = (type: BlockType, atIndex?: number) => {
    const newBlock: EmailBlock = { id: uid(), type, data: defaultBlockData(type) };
    const newBlocks = [...blocks];
    const insertAt = atIndex !== undefined ? atIndex : blocks.length;
    newBlocks.splice(insertAt, 0, newBlock);
    updateBlocks(newBlocks);
    setExpandedId(newBlock.id);
    setShowAddMenu(false);
    setAddAtIndex(null);
  };

  const removeBlock = (id: string) => {
    updateBlocks(blocks.filter((b) => b.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[target]] = [newBlocks[target], newBlocks[idx]];
    updateBlocks(newBlocks);
  };

  const updateBlockData = (id: string, data: Record<string, any>) => {
    updateBlocks(blocks.map((b) => (b.id === id ? { ...b, data } : b)));
  };

  const insertMergeTag = (tag: string) => {
    if (!expandedId) return;
    const block = blocks.find((b) => b.id === expandedId);
    if (!block) return;
    const textField = block.type === "text" ? "content" :
      block.type === "footer" ? "text" :
        block.type === "two-column" ? "left" :
          block.type === "header" ? "title" :
            block.type === "button" ? "label" : null;
    if (!textField) return;
    updateBlockData(expandedId, { ...block.data, [textField]: (block.data[textField] || "") + tag });
  };

  const switchToCode = () => {
    setCodeHtml(blocks.length > 0 ? generatedHtml : codeHtml || legacyHtml || "");
    setMode("code");
  };

  const switchToVisual = () => {
    if (blocks.length === 0) {
      const starterBlocks: EmailBlock[] = [
        { id: uid(), type: "header", data: defaultBlockData("header") },
        { id: uid(), type: "text", data: defaultBlockData("text") },
        { id: uid(), type: "button", data: defaultBlockData("button") },
        { id: uid(), type: "footer", data: defaultBlockData("footer") },
      ];
      updateBlocks(starterBlocks);
    } else {
      onHtmlChange(blocksToHtml(blocks));
    }
    setMode("visual");
  };

  if (mode === "code") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Code className="h-3.5 w-3.5" /> HTML Source
          </h4>
          <div className="flex gap-1.5">
            <Select value="" onValueChange={(v) => {
              setCodeHtml((prev) => prev + v);
              onHtmlChange(codeHtml + v);
            }}>
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-merge-tag-code">
                <SelectValue placeholder="Insert tag..." />
              </SelectTrigger>
              <SelectContent>
                {MERGE_TAGS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={switchToVisual} data-testid="button-switch-visual">
              <Eye className="h-3.5 w-3.5 mr-1" /> Visual Editor
            </Button>
          </div>
        </div>
        {isLegacy && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-3 py-2 rounded">
            This template was created with raw HTML. You can edit it here, or switch to the Visual Editor to start fresh with blocks.
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Textarea
            value={codeHtml}
            onChange={(e) => {
              setCodeHtml(e.target.value);
              onHtmlChange(e.target.value);
            }}
            rows={20}
            className="font-mono text-xs"
            data-testid="input-html-source"
          />
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
              <Eye className="h-3 w-3" /> Preview
            </p>
            <div className="border rounded-lg overflow-hidden bg-[#f0f0f0]" style={{ minHeight: 300 }}>
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: 480 }}
                title="Email Preview"
                sandbox="allow-same-origin"
                data-testid="iframe-email-preview-code"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Layout className="h-3.5 w-3.5" /> Email Builder
        </h4>
        <div className="flex gap-1.5">
          <Select value="" onValueChange={(v) => insertMergeTag(v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-merge-tag">
              <SelectValue placeholder="Insert tag..." />
            </SelectTrigger>
            <SelectContent>
              {MERGE_TAGS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={switchToCode} data-testid="button-switch-code">
            <Code className="h-3.5 w-3.5 mr-1" /> Code
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Blocks</p>
          {blocks.length === 0 && (
            <div className="border border-dashed rounded-lg p-6 text-center text-muted-foreground text-sm">
              No blocks yet. Click "Add Block" to start building.
            </div>
          )}
          {blocks.map((block, idx) => {
            const isExpanded = expandedId === block.id;
            const entry = BLOCK_TYPES.find((b) => b.type === block.type);
            return (
              <Card key={block.id} className="overflow-hidden" data-testid={`card-block-${block.id}`}>
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-muted/30 hover:bg-muted/60 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : block.id)}
                  data-testid={`block-toggle-${block.id}`}
                >
                  <BlockIcon type={block.type} />
                  <span className="text-xs font-medium flex-1">{entry?.label || block.type}</span>
                  <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                  <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} data-testid={`button-move-up-${block.id}`}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} data-testid={`button-move-down-${block.id}`}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeBlock(block.id)} data-testid={`button-remove-block-${block.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </div>
                {isExpanded && (
                  <div className="p-3 border-t">
                    <BlockEditor block={block} onChange={(data) => updateBlockData(block.id, data)} />
                  </div>
                )}
              </Card>
            );
          })}

          <div className="relative">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setShowAddMenu(!showAddMenu); setAddAtIndex(blocks.length); }}
              data-testid="button-add-block"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Block
            </Button>
            {showAddMenu && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border rounded-lg shadow-lg p-2 grid grid-cols-2 gap-1">
                {BLOCK_TYPES.map((bt) => {
                  const Icon = bt.icon;
                  return (
                    <button
                      key={bt.type}
                      onClick={() => addBlock(bt.type, addAtIndex ?? undefined)}
                      className="flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium hover:bg-accent transition-colors text-left"
                      data-testid={`button-add-${bt.type}`}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {bt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
            <Eye className="h-3 w-3" /> Live Preview
          </p>
          <div className="border rounded-lg overflow-hidden bg-[#f0f0f0]" style={{ minHeight: 300 }}>
            <iframe
              srcDoc={previewHtml}
              className="w-full border-0"
              style={{ height: 500 }}
              title="Email Preview"
              sandbox="allow-same-origin"
              data-testid="iframe-email-preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
