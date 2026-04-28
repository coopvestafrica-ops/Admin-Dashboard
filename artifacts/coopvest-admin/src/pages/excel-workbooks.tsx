import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Plus, Save, Trash2, ArrowLeft, Download, Upload, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Workbook {
  id: number; name: string; description: string; sheetNames: string[];
  createdBy: string; updatedBy?: string; createdAt: string; updatedAt: string;
}
interface WorkbookFull extends Workbook {
  data: Record<string, { cells: CellData[][] }>;
}
interface CellData { value: string; bold?: boolean; italic?: boolean; bg?: string; }

const COLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const ROWS = 50;

function emptyGrid(cols = 26, rows = ROWS): CellData[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ value: "" })));
}

function SpreadsheetEditor({ data, sheetName, onChange }: {
  data: CellData[][];
  sheetName: string;
  onChange: (grid: CellData[][]) => void;
}) {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const grid: CellData[][] = data && data.length > 0 ? data : emptyGrid();

  const handleCellClick = (r: number, c: number) => {
    setSelected([r, c]);
    setEditValue(grid[r]?.[c]?.value ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = useCallback((r: number, c: number, val: string) => {
    const newGrid = grid.map((row) => [...row]);
    if (!newGrid[r]) newGrid[r] = Array.from({ length: COLS.length }, () => ({ value: "" }));
    newGrid[r][c] = { ...newGrid[r][c], value: val };
    onChange(newGrid);
  }, [grid, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      commitEdit(r, c, editValue);
      const next: [number, number] = e.key === "Tab" ? [r, Math.min(c + 1, COLS.length - 1)] : [Math.min(r + 1, ROWS - 1), c];
      setSelected(next);
      setEditValue(grid[next[0]]?.[next[1]]?.value ?? "");
    } else if (e.key === "Escape") {
      setEditValue(grid[r]?.[c]?.value ?? "");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {selected && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          <div className="font-mono text-xs bg-background border rounded px-2 py-1 min-w-[48px] text-center">
            {COLS[selected[1]]}{selected[0] + 1}
          </div>
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => commitEdit(selected[0], selected[1], editValue)}
            onKeyDown={(e) => handleKeyDown(e, selected[0], selected[1])}
            className="font-mono text-sm h-7 flex-1"
          />
        </div>
      )}
      <div className="overflow-auto flex-1">
        <table className="border-collapse text-xs select-none">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-muted w-10 h-7 border text-center text-muted-foreground font-normal" />
              {COLS.slice(0, 26).map((col) => (
                <th key={col} className="sticky top-0 z-10 bg-muted border h-7 min-w-[80px] text-center text-muted-foreground font-normal">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, r) => (
              <tr key={r}>
                <td className="sticky left-0 z-10 bg-muted border text-center text-muted-foreground font-normal h-6 w-10">{r + 1}</td>
                {COLS.slice(0, 26).map((_, c) => {
                  const cell = grid[r]?.[c];
                  const isSel = selected?.[0] === r && selected?.[1] === c;
                  return (
                    <td
                      key={c}
                      className={`border h-6 min-w-[80px] cursor-cell relative ${isSel ? "outline outline-2 outline-primary outline-offset-[-1px] bg-primary/5" : "hover:bg-muted/40"}`}
                      onClick={() => handleCellClick(r, c)}
                    >
                      <span className={`block px-1 truncate ${cell?.bold ? "font-bold" : ""} ${cell?.italic ? "italic" : ""}`}>
                        {isSel ? editValue : (cell?.value ?? "")}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExcelWorkbooksPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [openWorkbook, setOpenWorkbook] = useState<WorkbookFull | null>(null);
  const [activeSheet, setActiveSheet] = useState("Sheet1");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const { data, isLoading } = useQuery({
    queryKey: ["excel"],
    queryFn: () => apiRequest<{ workbooks: Workbook[] }>("/excel"),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description: string }) => apiRequest("/excel", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["excel"] }); setShowCreate(false); setNewName(""); setNewDesc(""); },
  });

  const openMutation = useMutation({
    mutationFn: (id: number) => apiRequest<{ workbook: WorkbookFull }>(`/excel/${id}`),
    onSuccess: (data) => { setOpenWorkbook(data.workbook); setActiveSheet(data.workbook.sheetNames[0] ?? "Sheet1"); setIsDirty(false); },
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest(`/excel/${id}`, { method: "PUT", body: JSON.stringify({ data }) }),
    onSuccess: () => { setSaveStatus("saved"); setIsDirty(false); qc.invalidateQueries({ queryKey: ["excel"] }); setTimeout(() => setSaveStatus("idle"), 2000); },
    onMutate: () => setSaveStatus("saving"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/excel/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["excel"] }); },
  });

  const handleCellChange = (sheetName: string, grid: CellData[][]) => {
    if (!openWorkbook) return;
    setOpenWorkbook({ ...openWorkbook, data: { ...openWorkbook.data, [sheetName]: { cells: grid } } });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!openWorkbook) return;
    saveMutation.mutate({ id: openWorkbook.id, data: openWorkbook.data });
  };

  const workbooks: Workbook[] = data?.workbooks ?? [];

  if (openWorkbook) {
    const sheetData = openWorkbook.data?.[activeSheet]?.cells ?? emptyGrid();
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        <div className="flex items-center justify-between p-3 border-b bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setOpenWorkbook(null)}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            <span className="font-semibold">{openWorkbook.name}</span>
            {isDirty && <Badge variant="outline" className="text-xs">Unsaved changes</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved ✓" : ""}
            </span>
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />{saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <SpreadsheetEditor
            key={activeSheet}
            data={sheetData}
            sheetName={activeSheet}
            onChange={(grid) => handleCellChange(activeSheet, grid)}
          />
        </div>

        <div className="flex items-center gap-1 border-t px-2 py-1 bg-muted/30">
          {openWorkbook.sheetNames.map((name) => (
            <button key={name} onClick={() => setActiveSheet(name)}
              className={`px-3 py-1 text-xs rounded-t border-t-2 transition-colors ${activeSheet === name ? "border-primary bg-background font-medium" : "border-transparent hover:bg-muted"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileSpreadsheet className="w-6 h-6 text-green-500" />Excel Workbooks</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, edit, and collaborate on spreadsheets directly in the browser.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />New Workbook</Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading workbooks...</div>
      ) : workbooks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-2">No workbooks yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first workbook to start working with spreadsheets.</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-2" />Create Workbook</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {workbooks.map((wb) => (
            <Card key={wb.id} className="hover:shadow-md transition-shadow cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <FileSpreadsheet className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{wb.name}</div>
                      <div className="text-xs text-muted-foreground">{wb.sheetNames.length} sheet{wb.sheetNames.length !== 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(wb.id); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                {wb.description && <p className="text-xs text-muted-foreground mt-3">{wb.description}</p>}
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    <div>By {wb.createdBy}</div>
                    <div>Updated {format(new Date(wb.updatedAt), "MMM d, yyyy")}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openMutation.mutate(wb.id)} disabled={openMutation.isPending}>
                    Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Workbook</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Workbook Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Q1 Loan Portfolio Analysis" /></div>
            <div className="space-y-2"><Label>Description (optional)</Label><Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What is this workbook for?" /></div>
            <Button className="w-full" onClick={() => createMutation.mutate({ name: newName, description: newDesc })} disabled={!newName || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Workbook"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
