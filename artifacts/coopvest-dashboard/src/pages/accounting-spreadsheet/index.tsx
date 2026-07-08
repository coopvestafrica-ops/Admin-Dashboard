import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Plus,
  Copy,
  Clipboard,
  Grid3X3,
  DollarSign,
  Percent,
  Equal,
  Minus,
  Divide,
  X,
  Hash,
  Type,
  Calendar,
  FileText,
  Save,
  RotateCcw,
  MoreVertical,
  ArrowDownToLine,
  TrendingUp,
  PiggyBank,
  CreditCard,
  Receipt,
} from "lucide-react";

// Types
interface Cell {
  id: string;
  value: string;
  formula?: string;
  format: CellFormat;
  locked?: boolean;
}

interface CellFormat {
  type: "text" | "number" | "currency" | "percentage" | "date";
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
}

interface SpreadsheetRow {
  id: string;
  cells: Record<string, Cell>;
}

interface Spreadsheet {
  id: string;
  name: string;
  rows: SpreadsheetRow[];
  columns: string[];
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  rows: SpreadsheetRow[];
  columns: string[];
}

// Default column headers
const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

const createCell = (col: string, row: number): Cell => ({
  id: `${col}${row}`,
  value: "",
  format: { type: "text" },
});

const createRow = (columns: string[], rowNum: number): SpreadsheetRow => ({
  id: `row-${rowNum}`,
  cells: columns.reduce((acc, col) => {
    acc[col] = createCell(col, rowNum);
    return acc;
  }, {} as Record<string, Cell>),
});

// Pre-built accounting templates
const ACCOUNTING_TEMPLATES: Template[] = [
  {
    id: "daily-collection",
    name: "Daily Collection Sheet",
    description: "Track daily cash collections",
    icon: <Receipt className="h-5 w-5" />,
    rows: [],
    columns: ["A", "B", "C", "D", "E", "F", "G", "H"],
  },
  {
    id: "member-ledger",
    name: "Member Ledger",
    description: "Individual member account tracking",
    icon: <PiggyBank className="h-5 w-5" />,
    rows: [],
    columns: ["A", "B", "C", "D", "E", "F", "G"],
  },
  {
    id: "loan-amortization",
    name: "Loan Amortization",
    description: "Calculate loan repayment schedules",
    icon: <CreditCard className="h-5 w-5" />,
    rows: [],
    columns: ["A", "B", "C", "D", "E", "F", "G", "H"],
  },
  {
    id: "interest-calculation",
    name: "Interest Calculation",
    description: "Calculate interest on savings/loans",
    icon: <Percent className="h-5 w-5" />,
    rows: [],
    columns: ["A", "B", "C", "D", "E"],
  },
  {
    id: "trial-balance",
    name: "Trial Balance",
    description: "Prepare trial balance sheet",
    icon: <Equal className="h-5 w-5" />,
    rows: [],
    columns: ["A", "B", "C", "D"],
  },
  {
    id: "blank",
    name: "Blank Spreadsheet",
    description: "Start from scratch",
    icon: <Grid3X3 className="h-5 w-5" />,
    rows: [],
    columns: DEFAULT_COLUMNS,
  },
];

// Initialize Daily Collection Sheet template
const initDailyCollection = (): { rows: SpreadsheetRow[]; columns: string[] } => {
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rows: SpreadsheetRow[] = [];
  
  // Header row
  rows.push({
    id: "row-1",
    cells: {
      A: { id: "A1", value: "DATE", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
      B: { id: "B1", value: "RECEIPT NO", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
      C: { id: "C1", value: "MEMBER NAME", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
      D: { id: "D1", value: "SAVINGS", format: { type: "currency", bold: true, backgroundColor: "#dcfce7" } },
      E: { id: "E1", value: "LEVY", format: { type: "currency", bold: true, backgroundColor: "#dbeafe" } },
      F: { id: "F1", value: "LOAN REPAYMENT", format: { type: "currency", bold: true, backgroundColor: "#fef3c7" } },
      G: { id: "G1", value: "OTHER", format: { type: "currency", bold: true, backgroundColor: "#f3e8ff" } },
      H: { id: "H1", value: "TOTAL", format: { type: "currency", bold: true, backgroundColor: "#e5e7eb" } },
    },
  });

  // Data rows (empty with formulas for totals)
  for (let i = 2; i <= 31; i++) {
    rows.push({
      id: `row-${i}`,
      cells: {
        A: { id: `A${i}`, value: "", format: { type: "date" } },
        B: { id: `B${i}`, value: "", format: { type: "text" } },
        C: { id: `C${i}`, value: "", format: { type: "text" } },
        D: { id: `D${i}`, value: "", format: { type: "currency" } },
        E: { id: `E${i}`, value: "", format: { type: "currency" } },
        F: { id: `F${i}`, value: "", format: { type: "currency" } },
        G: { id: `G${i}`, value: "", format: { type: "currency" } },
        H: { id: `H${i}`, value: `=D${i}+E${i}+F${i}+G${i}`, format: { type: "currency", bold: true } },
      },
    });
  }

  // Totals row
  rows.push({
    id: "row-totals",
    cells: {
      A: { id: "Atotals", value: "TOTALS", format: { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" } },
      B: { id: "Btotals", value: "", format: { type: "text" } },
      C: { id: "Ctotals", value: "", format: { type: "text" } },
      D: { id: "Dtotals", value: "=SUM(D2:D31)", format: { type: "currency", bold: true, backgroundColor: "#dcfce7" } },
      E: { id: "Etotals", value: "=SUM(E2:E31)", format: { type: "currency", bold: true, backgroundColor: "#dbeafe" } },
      F: { id: "Ftotals", value: "=SUM(F2:F31)", format: { type: "currency", bold: true, backgroundColor: "#fef3c7" } },
      G: { id: "Gtotals", value: "=SUM(G2:G31)", format: { type: "currency", bold: true, backgroundColor: "#f3e8ff" } },
      H: { id: "Htotals", value: "=SUM(H2:H31)", format: { type: "currency", bold: true, backgroundColor: "#e5e7eb" } },
    },
  });

  return { rows, columns };
};

// Initialize Loan Amortization template
const initLoanAmortization = (): { rows: SpreadsheetRow[]; columns: string[] } => {
  const columns = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const rows: SpreadsheetRow[] = [];

  // Header row
  rows.push({
    id: "row-1",
    cells: {
      A: { id: "A1", value: "INSTALLMENT #", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
      B: { id: "B1", value: "MONTH", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
      C: { id: "C1", value: "OPENING BALANCE", format: { type: "currency", bold: true, backgroundColor: "#e5e7eb" } },
      D: { id: "D1", value: "INSTALLMENT", format: { type: "currency", bold: true, backgroundColor: "#dcfce7" } },
      E: { id: "E1", value: "PRINCIPAL", format: { type: "currency", bold: true, backgroundColor: "#dbeafe" } },
      F: { id: "F1", value: "INTEREST", format: { type: "currency", bold: true, backgroundColor: "#fef3c7" } },
      G: { id: "G1", value: "CLOSING BALANCE", format: { type: "currency", bold: true, backgroundColor: "#f3e8ff" } },
      H: { id: "H1", value: "STATUS", format: { type: "text", bold: true, backgroundColor: "#e5e7eb" } },
    },
  });

  // Data rows
  for (let i = 2; i <= 13; i++) {
    const prevRow = i - 1;
    rows.push({
      id: `row-${i}`,
      cells: {
        A: { id: `A${i}`, value: String(i - 1), format: { type: "number" } },
        B: { id: `B${i}`, value: "", format: { type: "text" } },
        C: { id: `C${i}`, value: i === 2 ? "=1000000" : `=G${prevRow}`, format: { type: "currency" } },
        D: { id: `D${i}`, value: "=83333.33", format: { type: "currency" } },
        E: { id: `E${i}`, value: `=D${i}*0.7`, format: { type: "currency" } },
        F: { id: `F${i}`, value: `=D${i}*0.3`, format: { type: "currency" } },
        G: { id: `G${i}`, value: `=C${i}-E${i}`, format: { type: "currency" } },
        H: { id: `H${i}`, value: "Pending", format: { type: "text" } },
      },
    });
  }

  return { rows, columns };
};

// Simple formula evaluator
const evaluateFormula = (formula: string, rows: SpreadsheetRow[], columns: string[]): string => {
  if (!formula.startsWith("=")) return formula;

  const expr = formula.slice(1).toUpperCase();
  
  // SUM function
  const sumMatch = expr.match(/SUM\(([A-Z])(\d+):([A-Z])(\d+)\)/);
  if (sumMatch) {
    const [, startCol, startRow, endCol, endRow] = sumMatch;
    const startColIdx = columns.indexOf(startCol);
    const endColIdx = columns.indexOf(endCol);
    let sum = 0;
    
    for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
      for (let col = startColIdx; col <= endColIdx; col++) {
        const rowData = rows.find(r => r.id === `row-${row}`);
        if (rowData) {
          const cell = rowData.cells[columns[col]];
          if (cell) {
            const val = parseFloat(cell.value) || 0;
            sum += val;
          }
        }
      }
    }
    return sum.toFixed(2);
  }

  // Simple arithmetic
  try {
    // Replace cell references with values
    let evalExpr = expr;
    const cellRefMatch = expr.match(/([A-Z]+)(\d+)/g);
    if (cellRefMatch) {
      const uniqueRefs = [...new Set(cellRefMatch)];
      for (const ref of uniqueRefs) {
        const col = ref.match(/([A-Z]+)/)?.[1] || "";
        const row = ref.match(/(\d+)/)?.[1] || "";
        const rowData = rows.find(r => r.id === `row-${row}`);
        if (rowData && rowData.cells[col]) {
          const value = rowData.cells[col].value;
          const numValue = parseFloat(value) || 0;
          evalExpr = evalExpr.replace(new RegExp(ref, 'g'), String(numValue));
        }
      }
    }
    
    // Evaluate simple arithmetic
    if (/^[\d\s+\-*/().]+$/.test(evalExpr)) {
      // Safe eval using Function constructor
      const result = Function(`"use strict"; return (${evalExpr})`)();
      return typeof result === 'number' ? result.toFixed(2) : String(result);
    }
  } catch (e) {
    return formula;
  }

  return formula;
};

export default function AccountingSpreadsheet() {
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>({
    id: "1",
    name: "Untitled Spreadsheet",
    rows: [],
    columns: DEFAULT_COLUMNS,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeTab, setActiveTab] = useState("template");
  const [showTemplates, setShowTemplates] = useState(true);
  const [cellFormat, setCellFormat] = useState<CellFormat>({ type: "text" });
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Initialize with blank spreadsheet
  useEffect(() => {
    if (spreadsheet.rows.length === 0) {
      initializeSpreadsheet("blank");
    }
  }, []);

  const initializeSpreadsheet = useCallback((templateId: string) => {
    let newData: { rows: SpreadsheetRow[]; columns: string[] };

    switch (templateId) {
      case "daily-collection":
        newData = initDailyCollection();
        break;
      case "loan-amortization":
        newData = initLoanAmortization();
        break;
      default:
        newData = {
          rows: Array.from({ length: 20 }, (_, i) => createRow(DEFAULT_COLUMNS, i + 1)),
          columns: DEFAULT_COLUMNS,
        };
    }

    setSpreadsheet({
      ...spreadsheet,
      name: ACCOUNTING_TEMPLATES.find(t => t.id === templateId)?.name || "Untitled",
      rows: newData.rows,
      columns: newData.columns,
      updatedAt: new Date().toISOString(),
    });
    setShowTemplates(false);
    setSelectedCell(null);
  }, [spreadsheet]);

  const updateCell = useCallback((cellId: string, value: string) => {
    setSpreadsheet(prev => ({
      ...prev,
      rows: prev.rows.map(row => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).map(([key, cell]) =>
            key === cellId
              ? [key, { ...cell, value, formula: value.startsWith("=") ? value : undefined }]
              : [key, cell]
          )
        ),
      })),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleCellClick = useCallback((cellId: string) => {
    setSelectedCell(cellId);
    const [col, row] = [cellId.match(/[A-Z]+/)?.[0] || "", cellId.match(/\d+/)?.[0] || ""];
    const rowData = spreadsheet.rows.find(r => r.id === `row-${row}`);
    const cell = rowData?.cells[col];
    if (cell) {
      setCellFormat(cell.format);
    }
  }, [spreadsheet.rows]);

  const handleCellDoubleClick = useCallback((cellId: string) => {
    setEditingCell(cellId);
    const [col, row] = [cellId.match(/[A-Z]+/)?.[0] || "", cellId.match(/\d+/)?.[0] || ""];
    const rowData = spreadsheet.rows.find(r => r.id === `row-${row}`);
    const cell = rowData?.cells[col];
    setEditValue(cell?.value || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleEditComplete = useCallback(() => {
    if (editingCell) {
      updateCell(editingCell, editValue);
      setEditingCell(null);
      setEditValue("");
    }
  }, [editingCell, editValue, updateCell]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleEditComplete();
    } else if (e.key === "Escape") {
      setEditingCell(null);
      setEditValue("");
    } else if (e.key === "Tab" && !editingCell) {
      e.preventDefault();
      // Move to next cell
      if (selectedCell) {
        const col = selectedCell.match(/[A-Z]+/)?.[0] || "";
        const row = parseInt(selectedCell.match(/\d+/)?.[0] || "1");
        const colIdx = spreadsheet.columns.indexOf(col);
        if (colIdx < spreadsheet.columns.length - 1) {
          setSelectedCell(`${spreadsheet.columns[colIdx + 1]}${row}`);
        }
      }
    }
  }, [handleEditComplete, selectedCell, spreadsheet.columns]);

  const addRow = useCallback(() => {
    const newRowNum = spreadsheet.rows.length + 1;
    const newRow = createRow(spreadsheet.columns, newRowNum);
    setSpreadsheet(prev => ({
      ...prev,
      rows: [...prev.rows, newRow],
    }));
  }, [spreadsheet.columns, spreadsheet.rows.length]);

  const deleteRow = useCallback((rowId: string) => {
    setSpreadsheet(prev => ({
      ...prev,
      rows: prev.rows.filter(r => r.id !== rowId),
    }));
  }, []);

  const formatCellValue = useCallback((cell: Cell): string => {
    if (cell.value.startsWith("=")) {
      return evaluateFormula(cell.value, spreadsheet.rows, spreadsheet.columns);
    }
    
    switch (cell.format.type) {
      case "currency":
        const num = parseFloat(cell.value);
        return isNaN(num) ? cell.value : formatCurrency(num);
      case "percentage":
        const pct = parseFloat(cell.value);
        return isNaN(pct) ? cell.value : `${pct}%`;
      default:
        return cell.value;
    }
  }, [spreadsheet.rows, spreadsheet.columns]);

  const exportToCSV = useCallback(() => {
    const headers = spreadsheet.columns.join(",");
    const rows = spreadsheet.rows.map(row => 
      spreadsheet.columns.map(col => {
        const cell = row.cells[col];
        const value = cell?.value || "";
        return `"${value.replace(/"/g, '""')}"`;
      }).join(",")
    );
    
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spreadsheet.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Spreadsheet exported as CSV" });
  }, [spreadsheet, toast]);

  const copyToClipboard = useCallback(() => {
    if (!selectedCell) return;
    const [col, row] = [selectedCell.match(/[A-Z]+/)?.[0] || "", selectedCell.match(/\d+/)?.[0] || ""];
    const rowData = spreadsheet.rows.find(r => r.id === `row-${row}`);
    const cell = rowData?.cells[col];
    if (cell) {
      navigator.clipboard.writeText(cell.value);
      toast({ title: "Copied", description: "Cell value copied to clipboard" });
    }
  }, [selectedCell, spreadsheet.rows, toast]);

  // Calculate totals for display
  const totals = useMemo(() => {
    let numericTotal = 0;
    let count = 0;
    
    spreadsheet.rows.forEach(row => {
      spreadsheet.columns.forEach(col => {
        const cell = row.cells[col];
        if (cell && cell.format.type === "currency") {
          const num = parseFloat(cell.value) || 0;
          numericTotal += num;
          count++;
        }
      });
    });
    
    return { total: numericTotal, count };
  }, [spreadsheet.rows, spreadsheet.columns]);

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-7 w-7" />
              Accounting Spreadsheet
            </h1>
            <p className="text-muted-foreground">
              Professional accounting calculations and data entry
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={copyToClipboard} disabled={!selectedCell}>
              <Copy className="h-4 w-4 mr-1" />
              Copy Cell
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Grid3X3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{spreadsheet.rows.length}</div>
                <div className="text-xs text-muted-foreground">Rows</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{totals.count}</div>
                <div className="text-xs text-muted-foreground">Numeric Cells</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="text-lg font-bold">{formatCurrency(totals.total)}</div>
                <div className="text-xs text-muted-foreground">Total Value</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <FileSpreadsheet className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-lg font-bold truncate max-w-[150px]">{spreadsheet.name}</div>
                <div className="text-xs text-muted-foreground">Active Sheet</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-1" />
                Templates
              </Button>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add Row
              </Button>
              <div className="h-6 w-px bg-border" />
              <Badge variant="outline" className="text-xs">
                <Type className="h-3 w-3 mr-1" />
                Text
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Hash className="h-3 w-3 mr-1" />
                Number
              </Badge>
              <Badge variant="outline" className="text-xs">
                <DollarSign className="h-3 w-3 mr-1" />
                Currency
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Percent className="h-3 w-3 mr-1" />
                Percentage
              </Badge>
              <div className="h-6 w-px bg-border" />
              <div className="text-xs text-muted-foreground">
                Tip: Start formulas with = (e.g., =SUM(A1:A10))
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Template Selection Modal */}
        {showTemplates && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose a Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {ACCOUNTING_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 hover:border-primary transition-all text-center"
                    onClick={() => initializeSpreadsheet(template.id)}
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                      {template.icon}
                    </div>
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spreadsheet */}
        {!showTemplates && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="w-12 h-10 border p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10">
                        #
                      </th>
                      {spreadsheet.columns.map((col) => (
                        <th
                          key={col}
                          className="min-w-[120px] h-10 border p-2 text-xs font-medium text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                      <th className="w-12 border p-2 sticky right-0 bg-muted/50 z-10">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addRow}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {spreadsheet.rows.map((row, rowIdx) => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="w-12 h-10 border p-1 text-xs text-muted-foreground text-center sticky left-0 bg-background z-10">
                          {rowIdx + 1}
                        </td>
                        {spreadsheet.columns.map((col) => {
                          const cell = row.cells[col];
                          const cellId = `${col}${rowIdx + 1}`;
                          const isSelected = selectedCell === cellId;
                          const isEditing = editingCell === cellId;
                          const displayValue = cell ? formatCellValue(cell) : "";
                          const isFormula = cell?.value?.startsWith("=");

                          return (
                            <td
                              key={col}
                              className={`min-w-[120px] h-10 border p-0 ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                              onClick={() => handleCellClick(cellId)}
                              onDoubleClick={() => handleCellDoubleClick(cellId)}
                            >
                              {isEditing ? (
                                <input
                                  ref={inputRef}
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onBlur={handleEditComplete}
                                  onKeyDown={handleKeyDown}
                                  className="w-full h-full px-2 text-sm outline-none bg-background"
                                />
                              ) : (
                                <div
                                  className={`w-full h-full px-2 text-sm flex items-center truncate ${
                                    isFormula ? "font-mono text-blue-600" : ""
                                  } ${
                                    cell?.format.bold ? "font-bold" : ""
                                  }`}
                                  style={{
                                    color: cell?.format.color || "inherit",
                                    backgroundColor: cell?.format.backgroundColor || "inherit",
                                  }}
                                >
                                  {displayValue}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="w-12 border p-1 sticky right-0 bg-background z-10">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteRow(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Formula Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-mono font-medium text-blue-600">=SUM(A1:A10)</div>
                <div className="text-muted-foreground mt-1">Sum a range of cells</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-mono font-medium text-blue-600">=A1+B1</div>
                <div className="text-muted-foreground mt-1">Add two cells</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-mono font-medium text-blue-600">=A1*0.1</div>
                <div className="text-muted-foreground mt-1">Multiply by value</div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="font-mono font-medium text-blue-600">=A1-B1</div>
                <div className="text-muted-foreground mt-1">Subtract cells</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
