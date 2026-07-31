import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { supabase } from "@/lib/supabase";
import {
  Calculator,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Plus,
  Copy,
  Grid3X3,
  DollarSign,
  Percent,
  Equal,
  Minus,
  Hash,
  Type,
  Calendar,
  Save,
  RotateCcw,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  FileSpreadsheetIcon,
  TableIcon,
  RefreshCw,
} from "lucide-react";

// Types
interface Cell {
  id: string;
  value: string;
  formula?: string;
  format: CellFormat;
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
}

interface ReportConfig {
  title: string;
  dateFrom: string;
  dateTo: string;
  groupBy: "day" | "week" | "month" | "member";
  includeTypes: string[];
}

interface FinancialData {
  id: string;
  type: string;
  amount: number;
  date: string;
  memberName: string;
  category: string;
  reference: string;
  description: string;
}

// Default columns
const DEFAULT_COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];

const createCell = (col: string, row: number, value = "", format?: Partial<CellFormat>): Cell => ({
  id: `${col}${row}`,
  value,
  format: { type: "text", ...format },
});

const createRow = (columns: string[], rowNum: number): SpreadsheetRow => ({
  id: `row-${rowNum}`,
  cells: columns.reduce((acc, col) => {
    acc[col] = createCell(col, rowNum);
    return acc;
  }, {} as Record<string, Cell>),
});

// Enhanced formula parser
const evaluateFormula = (
  formula: string,
  rows: SpreadsheetRow[],
  columns: string[]
): string => {
  if (!formula.startsWith("=")) return formula;

  const expr = formula.slice(1).toUpperCase().replace(/\s/g, "");
  
  // Get cell value helper
  const getCellValue = (ref: string): number => {
    const col = ref.match(/[A-Z]+/)?.[0] || "";
    const row = ref.match(/\d+/)?.[0] || "";
    const rowData = rows.find((r) => r.id === `row-${row}`);
    const cell = rowData?.cells[col];
    if (!cell) return 0;
    const val = parseFloat(cell.value) || 0;
    return val;
  };

  try {
    // SUM function
    const sumMatch = expr.match(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    if (sumMatch) {
      const [, startCol, startRow, endCol, endRow] = sumMatch;
      const startColIdx = columns.indexOf(startCol);
      const endColIdx = columns.indexOf(endCol);
      let sum = 0;
      for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
        for (let col = startColIdx; col <= endColIdx; col++) {
          sum += getCellValue(`${columns[col]}${row}`);
        }
      }
      return sum.toFixed(2);
    }

    // AVERAGE function
    const avgMatch = expr.match(/AVERAGE\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    if (avgMatch) {
      const [, startCol, startRow, endCol, endRow] = avgMatch;
      const startColIdx = columns.indexOf(startCol);
      const endColIdx = columns.indexOf(endCol);
      let sum = 0;
      let count = 0;
      for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
        for (let col = startColIdx; col <= endColIdx; col++) {
          const val = getCellValue(`${columns[col]}${row}`);
          if (val !== 0 || rows.find((r) => r.id === `row-${row}`)?.cells[columns[col]]) {
            sum += val;
            count++;
          }
        }
      }
      return count > 0 ? (sum / count).toFixed(2) : "0";
    }

    // COUNT function
    const countMatch = expr.match(/COUNT\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    if (countMatch) {
      const [, startCol, startRow, endCol, endRow] = countMatch;
      const startColIdx = columns.indexOf(startCol);
      const endColIdx = columns.indexOf(endCol);
      let count = 0;
      for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
        for (let col = startColIdx; col <= endColIdx; col++) {
          const rowData = rows.find((r) => r.id === `row-${row}`);
          const cell = rowData?.cells[columns[col]];
          if (cell && cell.value !== "") count++;
        }
      }
      return String(count);
    }

    // MAX function
    const maxMatch = expr.match(/MAX\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    if (maxMatch) {
      const [, startCol, startRow, endCol, endRow] = maxMatch;
      const startColIdx = columns.indexOf(startCol);
      const endColIdx = columns.indexOf(endCol);
      let max = -Infinity;
      for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
        for (let col = startColIdx; col <= endColIdx; col++) {
          const val = getCellValue(`${columns[col]}${row}`);
          if (!isNaN(val)) max = Math.max(max, val);
        }
      }
      return max === -Infinity ? "0" : max.toFixed(2);
    }

    // MIN function
    const minMatch = expr.match(/MIN\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    if (minMatch) {
      const [, startCol, startRow, endCol, endRow] = minMatch;
      const startColIdx = columns.indexOf(startCol);
      const endColIdx = columns.indexOf(endCol);
      let min = Infinity;
      for (let row = parseInt(startRow); row <= parseInt(endRow); row++) {
        for (let col = startColIdx; col <= endColIdx; col++) {
          const val = getCellValue(`${columns[col]}${row}`);
          if (!isNaN(val)) min = Math.min(min, val);
        }
      }
      return min === Infinity ? "0" : min.toFixed(2);
    }

    // Arithmetic with cell references
    let evalExpr = expr;
    const cellRefs = [...expr.matchAll(/([A-Z]+\d+)/g)].map((m) => m[1]);
    const uniqueRefs = [...new Set(cellRefs)];
    for (const ref of uniqueRefs) {
      const val = getCellValue(ref);
      evalExpr = evalExpr.replace(new RegExp(ref, "g"), String(val));
    }

    // Safe evaluation
    if (/^[0-9+\-*/().]+$/.test(evalExpr)) {
      const result = Function(`"use strict"; return (${evalExpr})`)();
      return typeof result === "number" ? result.toFixed(2) : String(result);
    }
  } catch (e) {
    return formula;
  }

  return formula;
};

// Templates
const TEMPLATES = [
  {
    id: "daily-collection",
    name: "Daily Collection",
    description: "Track daily collections",
    icon: <DollarSign className="h-5 w-5" />,
    create: (columns: string[]) => {
      const rows: SpreadsheetRow[] = [
        {
          id: "row-1",
          cells: {
            A: createCell("A", 1, "DATE", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 1, "DESCRIPTION", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            C: createCell("C", 1, "SAVINGS", { type: "currency", bold: true, backgroundColor: "#059669", color: "#ffffff" }),
            D: createCell("D", 1, "LEVY", { type: "currency", bold: true, backgroundColor: "#2563eb", color: "#ffffff" }),
            E: createCell("E", 1, "LOAN REPAY", { type: "currency", bold: true, backgroundColor: "#d97706", color: "#ffffff" }),
            F: createCell("F", 1, "OTHER", { type: "currency", bold: true, backgroundColor: "#7c3aed", color: "#ffffff" }),
            G: createCell("G", 1, "TOTAL", { type: "currency", bold: true, backgroundColor: "#374151", color: "#ffffff" }),
          },
        },
        ...Array.from({ length: 31 }, (_, i) => ({
          id: `row-${i + 2}`,
          cells: {
            A: createCell("A", i + 2, "", { type: "date" }),
            B: createCell("B", i + 2, ""),
            C: createCell("C", i + 2, "", { type: "currency" }),
            D: createCell("D", i + 2, "", { type: "currency" }),
            E: createCell("E", i + 2, "", { type: "currency" }),
            F: createCell("F", i + 2, "", { type: "currency" }),
            G: createCell("G", i + 2, `=C${i + 2}+D${i + 2}+E${i + 2}+F${i + 2}`, { type: "currency", bold: true }),
          },
        })),
        {
          id: "row-totals",
          cells: {
            A: createCell("A", 34, "TOTALS", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 34, ""),
            C: createCell("C", 34, "=SUM(C2:C33)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            D: createCell("D", 34, "=SUM(D2:D33)", { type: "currency", bold: true, backgroundColor: "#dbeafe" }),
            E: createCell("E", 34, "=SUM(E2:E33)", { type: "currency", bold: true, backgroundColor: "#fef3c7" }),
            F: createCell("F", 34, "=SUM(F2:F33)", { type: "currency", bold: true, backgroundColor: "#f3e8ff" }),
            G: createCell("G", 34, "=SUM(G2:G33)", { type: "currency", bold: true, backgroundColor: "#e5e7eb" }),
          },
        },
      ];
      return { rows, columns: ["A", "B", "C", "D", "E", "F", "G"] };
    },
  },
  {
    id: "trial-balance",
    name: "Trial Balance",
    description: "Prepare trial balance",
    icon: <Equal className="h-5 w-5" />,
    create: (columns: string[]) => {
      const rows: SpreadsheetRow[] = [
        {
          id: "row-1",
          cells: {
            A: createCell("A", 1, "ACCOUNT", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 1, "DEBIT", { type: "currency", bold: true, backgroundColor: "#059669", color: "#ffffff" }),
            C: createCell("C", 1, "CREDIT", { type: "currency", bold: true, backgroundColor: "#dc2626", color: "#ffffff" }),
          },
        },
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `row-${i + 2}`,
          cells: {
            A: createCell("A", i + 2, ""),
            B: createCell("B", i + 2, "", { type: "currency" }),
            C: createCell("C", i + 2, "", { type: "currency" }),
          },
        })),
        {
          id: "row-totals",
          cells: {
            A: createCell("A", 23, "TOTAL", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 23, "=SUM(B2:B22)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            C: createCell("C", 23, "=SUM(C2:C22)", { type: "currency", bold: true, backgroundColor: "#fee2e2" }),
          },
        },
      ];
      return { rows, columns: ["A", "B", "C"] };
    },
  },
  {
    id: "loan-amortization",
    name: "Loan Amortization",
    description: "Calculate loan schedules",
    icon: <Calculator className="h-5 w-5" />,
    create: (columns: string[]) => {
      const rows: SpreadsheetRow[] = [
        {
          id: "row-1",
          cells: {
            A: createCell("A", 1, "#", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 1, "DATE", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            C: createCell("C", 1, "OPENING", { type: "currency", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            D: createCell("D", 1, "INSTALLMENT", { type: "currency", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            E: createCell("E", 1, "PRINCIPAL", { type: "currency", bold: true, backgroundColor: "#059669", color: "#ffffff" }),
            F: createCell("F", 1, "INTEREST", { type: "currency", bold: true, backgroundColor: "#2563eb", color: "#ffffff" }),
            G: createCell("G", 1, "CLOSING", { type: "currency", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
          },
        },
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `row-${i + 2}`,
          cells: {
            A: createCell("A", i + 2, String(i + 1)),
            B: createCell("B", i + 2, ""),
            C: createCell("C", i + 2, i === 0 ? "=1000000" : `=G${i + 1}`, { type: "currency" }),
            D: createCell("D", i + 2, "=41666.67", { type: "currency" }),
            E: createCell("E", i + 2, `=D${i + 2}*0.7`, { type: "currency" }),
            F: createCell("F", i + 2, `=D${i + 2}*0.3`, { type: "currency" }),
            G: createCell("G", i + 2, `=C${i + 2}-E${i + 2}`, { type: "currency" }),
          },
        })),
        {
          id: "row-totals",
          cells: {
            A: createCell("A", 27, "TOTALS", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 27, ""),
            C: createCell("C", 27, ""),
            D: createCell("D", 27, "=SUM(D2:D26)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            E: createCell("E", 27, "=SUM(E2:E26)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            F: createCell("F", 27, "=SUM(F2:F26)", { type: "currency", bold: true, backgroundColor: "#dbeafe" }),
            G: createCell("G", 27, ""),
          },
        },
      ];
      return { rows, columns: ["A", "B", "C", "D", "E", "F", "G"] };
    },
  },
  {
    id: "interest-calc",
    name: "Interest Calculator",
    description: "Calculate interest on savings",
    icon: <Percent className="h-5 w-5" />,
    create: (columns: string[]) => {
      const rows: SpreadsheetRow[] = [
        {
          id: "row-1",
          cells: {
            A: createCell("A", 1, "MEMBER", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 1, "BALANCE", { type: "currency", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            C: createCell("C", 1, "RATE (%)", { type: "percentage", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            D: createCell("D", 1, "MONTHS", { type: "number", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            E: createCell("E", 1, "INTEREST", { type: "currency", bold: true, backgroundColor: "#059669", color: "#ffffff" }),
            F: createCell("F", 1, "TOTAL", { type: "currency", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
          },
        },
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `row-${i + 2}`,
          cells: {
            A: createCell("A", i + 2, ""),
            B: createCell("B", i + 2, "", { type: "currency" }),
            C: createCell("C", i + 2, "10", { type: "percentage" }),
            D: createCell("D", i + 2, "12", { type: "number" }),
            E: createCell("E", i + 2, `=B${i + 2}*C${i + 2}/100*D${i + 2}/12`, { type: "currency" }),
            F: createCell("F", i + 2, `=B${i + 2}+E${i + 2}`, { type: "currency", bold: true }),
          },
        })),
        {
          id: "row-totals",
          cells: {
            A: createCell("A", 18, "TOTALS", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
            B: createCell("B", 18, "=SUM(B2:B17)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            C: createCell("C", 18, ""),
            D: createCell("D", 18, ""),
            E: createCell("E", 18, "=SUM(E2:E17)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
            F: createCell("F", 18, "=SUM(F2:F17)", { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
          },
        },
      ];
      return { rows, columns: ["A", "B", "C", "D", "E", "F"] };
    },
  },
  {
    id: "blank",
    name: "Blank Sheet",
    description: "Start from scratch",
    icon: <Grid3X3 className="h-5 w-5" />,
    create: (columns: string[]) => {
      const rows = Array.from({ length: 50 }, (_, i) => createRow(columns, i + 1));
      return { rows, columns };
    },
  },
];

export default function AccountingSpreadsheet() {
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>({
    id: "1",
    name: "Untitled Spreadsheet",
    rows: [],
    columns: DEFAULT_COLUMNS.slice(0, 8),
    createdAt: new Date().toISOString(),
  });
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showTemplates, setShowTemplates] = useState(true);
  const [activeTab, setActiveTab] = useState("grid");
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    title: "Financial Report",
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    groupBy: "day",
    includeTypes: ["savings", "levy", "loan_repayment", "entrance_fee", "refund", "special"],
  });
  const [chartData, setChartData] = useState<{ labels: string[]; values: number[] }>({ labels: [], values: [] });
  inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch financial data for reports
  const { data: financialData } = useQuery({
    queryKey: ["financial-data", reportConfig.dateFrom, reportConfig.dateTo],
    queryFn: async () => {
      const { data: deposits, error: depError } = await supabase
        .from("deposits")
        .select("id, amount, created_at, deposit_type, reference, description, profiles(name)")
        .gte("created_at", reportConfig.dateFrom)
        .lte("created_at", reportConfig.dateTo + "T23:59:59");

      const { data: withdrawals, error: witError } = await supabase
        .from("withdrawals")
        .select("id, amount, created_at, reference, description, profiles(name)")
        .gte("created_at", reportConfig.dateFrom)
        .lte("created_at", reportConfig.dateTo + "T23:59:59");

      if (depError || witError) throw new Error("Failed to fetch data");

      const depositsFormatted: FinancialData[] = (deposits || []).map((d: any) => ({
        id: d.id,
        type: d.deposit_type || "deposit",
        amount: d.amount,
        date: d.created_at,
        memberName: d.profiles?.name || "Unknown",
        category: d.deposit_type || "deposit",
        reference: d.reference || "",
        description: d.description || "",
      }));

      const withdrawalsFormatted: FinancialData[] = (withdrawals || []).map((w: any) => ({
        id: w.id,
        type: "withdrawal",
        amount: w.amount,
        date: w.created_at,
        memberName: w.profiles?.name || "Unknown",
        category: "withdrawal",
        reference: w.reference || "",
        description: w.description || "",
      }));

      return [...depositsFormatted, ...withdrawalsFormatted];
    },
  });

  // Initialize with blank spreadsheet
  useEffect(() => {
    if (spreadsheet.rows.length === 0) {
      const template = TEMPLATES.find((t) => t.id === "blank");
      if (template) {
        const { rows, columns } = template.create(DEFAULT_COLUMNS.slice(0, 8));
        setSpreadsheet({ ...spreadsheet, name: template.name, rows, columns });
      }
    }
  }, []);

  const initializeSpreadsheet = useCallback((templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (template) {
      const { rows, columns } = template.create(DEFAULT_COLUMNS);
      setSpreadsheet({
        ...spreadsheet,
        name: template.name,
        rows,
        columns,
        updatedAt: new Date().toISOString(),
      });
      setShowTemplates(false);
      setSelectedCell(null);
    }
  }, [spreadsheet]);

  const updateCell = useCallback((cellId: string, value: string) => {
    setSpreadsheet((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => ({
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
    const rowData = spreadsheet.rows.find((r) => r.id === `row-${row}`);
    const cell = rowData?.cells[col];
    if (cell) {
      setEditingCell(cellId);
      setEditValue(cell.value);
    }
  }, [spreadsheet.rows]);

  const handleCellDoubleClick = useCallback((cellId: string) => {
    setEditingCell(cellId);
    const [col, row] = [cellId.match(/[A-Z]+/)?.[0] || "", cellId.match(/\d+/)?.[0] || ""];
    const rowData = spreadsheet.rows.find((r) => r.id === `row-${row}`);
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
    } else if (e.key === "Tab" && !editingCell && selectedCell) {
      e.preventDefault();
      const col = selectedCell.match(/[A-Z]+/)?.[0] || "";
      const row = parseInt(selectedCell.match(/\d+/)?.[0] || "1");
      const colIdx = spreadsheet.columns.indexOf(col);
      if (colIdx < spreadsheet.columns.length - 1) {
        setSelectedCell(`${spreadsheet.columns[colIdx + 1]}${row}`);
      }
    }
  }, [handleEditComplete, selectedCell, spreadsheet.columns]);

  const addRow = useCallback(() => {
    const newRowNum = spreadsheet.rows.length + 1;
    const newRow = createRow(spreadsheet.columns, newRowNum);
    setSpreadsheet((prev) => ({ ...prev, rows: [...prev.rows, newRow] }));
  }, [spreadsheet.columns, spreadsheet.rows.length]);

  const deleteRow = useCallback((rowId: string) => {
    setSpreadsheet((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== rowId) }));
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

  // Export to CSV
  const exportCSV = useCallback(() => {
    const headers = spreadsheet.columns.join(",");
    const rows = spreadsheet.rows.map((row) =>
      spreadsheet.columns.map((col) => {
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

  // Export to XLSX (simplified)
  const exportXLSX = useCallback(() => {
    // Create HTML table for Excel
    const headers = spreadsheet.columns.map((col) => `<th>${col}</th>`).join("");
    const rows = spreadsheet.rows.map((row) =>
      `<tr>${spreadsheet.columns.map((col) => {
        const cell = row.cells[col];
        const value = cell ? formatCellValue(cell) : "";
        return `<td>${value}</td>`;
      }).join("")}</tr>`
    ).join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
      <x:Name>${spreadsheet.name}</x:Name><x:WorksheetOptions><x:Print></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></head>
      <body><table>${headers}${rows}</table></body></html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${spreadsheet.name.replace(/\s+/g, "_")}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "Spreadsheet exported as XLS (Excel format)" });
  }, [spreadsheet, formatCellValue, toast]);

  // Generate report from financial data
  const generateReport = useCallback(() => {
    if (!financialData) return;

    const filtered = financialData.filter((d) => reportConfig.includeTypes.includes(d.type));
    const grouped: Record<string, number> = {};

    filtered.forEach((item) => {
      let key: string;
      const date = new Date(item.date);
      switch (reportConfig.groupBy) {
        case "day":
          key = date.toLocaleDateString();
          break;
        case "week":
          const week = Math.ceil(date.getDate() / 7);
          key = `${date.toLocaleDateString(undefined, { year: "numeric", month: "short" })} Week ${week}`;
          break;
        case "month":
          key = date.toLocaleDateString(undefined, { year: "numeric", month: "long" });
          break;
        case "member":
          key = item.memberName;
          break;
        default:
          key = date.toLocaleDateString();
      }
      grouped[key] = (grouped[key] || 0) + item.amount;
    });

    // Create report rows
    const reportRows: SpreadsheetRow[] = [
      {
        id: "row-1",
        cells: {
          A: createCell("A", 1, reportConfig.title.toUpperCase(), { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
          B: createCell("B", 1, "Period", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
          C: createCell("C", 1, `${reportConfig.dateFrom} to ${reportConfig.dateTo}`, { type: "text", bold: true }),
        },
      },
      {
        id: "row-2",
        cells: {
          A: createCell("A", 2, reportConfig.groupBy.toUpperCase(), { type: "text", bold: true, backgroundColor: "#374151", color: "#ffffff" }),
          B: createCell("B", 2, "TOTAL AMOUNT", { type: "text", bold: true, backgroundColor: "#374151", color: "#ffffff" }),
          C: createCell("C", 2, "TRANSACTIONS", { type: "text", bold: true, backgroundColor: "#374151", color: "#ffffff" }),
        },
      },
    ];

    let rowNum = 3;
    Object.entries(grouped).forEach(([key, amount]) => {
      const count = filtered.filter((d) => {
        const date = new Date(d.date);
        let matches = false;
        switch (reportConfig.groupBy) {
          case "day": matches = date.toLocaleDateString() === key; break;
          case "member": matches = d.memberName === key; break;
          default: matches = true;
        }
        return matches;
      }).length;

      reportRows.push({
        id: `row-${rowNum}`,
        cells: {
          A: createCell("A", rowNum, key),
          B: createCell("B", rowNum, String(amount), { type: "currency" }),
          C: createCell("C", rowNum, String(count), { type: "number" }),
        },
      });
      rowNum++;
    });

    // Add totals
    reportRows.push({
      id: `row-${rowNum}`,
      cells: {
        A: createCell("A", rowNum, "TOTAL", { type: "text", bold: true, backgroundColor: "#1f2937", color: "#ffffff" }),
        B: createCell("B", rowNum, `=SUM(B3:B${rowNum - 1})`, { type: "currency", bold: true, backgroundColor: "#dcfce7" }),
        C: createCell("C", rowNum, `=SUM(C3:C${rowNum - 1})`, { type: "number", bold: true, backgroundColor: "#dcfce7" }),
      },
    });

    setSpreadsheet({
      ...spreadsheet,
      name: reportConfig.title,
      rows: reportRows,
      columns: ["A", "B", "C"],
      updatedAt: new Date().toISOString(),
    });

    // Set chart data
    const entries = Object.entries(grouped).slice(0, 10);
    setChartData({
      labels: entries.map(([k]) => k.slice(0, 15)),
      values: entries.map(([, v]) => v),
    });

    setShowTemplates(false);
    setActiveTab("grid");
    toast({ title: "Report Generated", description: `${entries.length} rows created` });
  }, [financialData, reportConfig, spreadsheet, toast]);

  // Calculate totals
  const totals = useMemo(() => {
    let numericTotal = 0;
    let currencyCells = 0;
    spreadsheet.rows.forEach((row) => {
      spreadsheet.columns.forEach((col) => {
        const cell = row.cells[col];
        if (cell && cell.format.type === "currency") {
          const num = parseFloat(cell.value) || 0;
          numericTotal += num;
          currencyCells++;
        }
      });
    });
    return { total: numericTotal, cells: currencyCells };
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
              Perform accounting calculations, generate reports, and visualize data
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportXLSX}><FileSpreadsheetIcon className="h-4 w-4 mr-1" />Export XLSX</Button>
            <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100"><Grid3X3 className="h-5 w-5 text-blue-600" /></div>
            <div><div className="text-lg font-bold">{spreadsheet.rows.length}</div><div className="text-xs text-muted-foreground">Rows</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100"><DollarSign className="h-5 w-5 text-emerald-600" /></div>
            <div><div className="text-lg font-bold">{totals.cells}</div><div className="text-xs text-muted-foreground">Currency Cells</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
            <div><div className="text-lg font-bold truncate max-w-[120px]">{formatCurrency(totals.total)}</div><div className="text-xs text-muted-foreground">Total Value</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100"><FileSpreadsheet className="h-5 w-5 text-amber-600" /></div>
            <div><div className="text-lg font-bold truncate max-w-[120px]">{spreadsheet.name}</div><div className="text-xs text-muted-foreground">Active Sheet</div></div>
          </CardContent></Card>
          <Card><CardContent className="p-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100"><TableIcon className="h-5 w-5 text-cyan-600" /></div>
            <div><div className="text-lg font-bold">{spreadsheet.columns.length}</div><div className="text-xs text-muted-foreground">Columns</div></div>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="grid"><Grid3X3 className="h-4 w-4 mr-1" />Spreadsheet</TabsTrigger>
            <TabsTrigger value="templates"><FileSpreadsheet className="h-4 w-4 mr-1" />Templates</TabsTrigger>
            <TabsTrigger value="reports"><BarChart3 className="h-4 w-4 mr-1" />Reports</TabsTrigger>
          </TabsList>

          {/* Grid Tab */}
          <TabsContent value="grid" className="space-y-4">
            {/* Toolbar */}
            <Card><CardContent className="p-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}><FileSpreadsheet className="h-4 w-4 mr-1" />Templates</Button>
                <Button variant="outline" size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" />Add Row</Button>
                <div className="h-6 w-px bg-border" />
                <Badge variant="outline" className="text-xs"><Type className="h-3 w-3 mr-1" />Text</Badge>
                <Badge variant="outline" className="text-xs"><Hash className="h-3 w-3 mr-1" />Number</Badge>
                <Badge variant="outline" className="text-xs"><DollarSign className="h-3 w-3 mr-1" />Currency</Badge>
                <Badge variant="outline" className="text-xs"><Percent className="h-3 w-3 mr-1" />Percentage</Badge>
                <div className="h-6 w-px bg-border" />
                <span className="text-xs text-muted-foreground">Formulas: =SUM() =AVERAGE() =COUNT() =MAX() =MIN()</span>
              </div>
            </CardContent></Card>

            {/* Spreadsheet */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="w-12 h-10 border p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-muted/50 z-10">#</th>
                        {spreadsheet.columns.map((col) => (
                          <th key={col} className="min-w-[120px] h-10 border p-2 text-xs font-medium text-muted-foreground">{col}</th>
                        ))}
                        <th className="w-12 border p-2 sticky right-0 bg-muted/50 z-10">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addRow}><Plus className="h-4 w-4" /></Button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {spreadsheet.rows.map((row, rowIdx) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="w-12 h-10 border p-1 text-xs text-muted-foreground text-center sticky left-0 bg-background z-10">{rowIdx + 1}</td>
                          {spreadsheet.columns.map((col) => {
                            const cell = row.cells[col];
                            const cellId = `${col}${rowIdx + 1}`;
                            const isSelected = selectedCell === cellId;
                            const isEditing = editingCell === cellId;
                            const displayValue = cell ? formatCellValue(cell) : "";
                            const isFormula = cell?.value?.startsWith("=");

                            return (
                              <td key={col} className={`min-w-[120px] h-10 border p-0 ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                                onClick={() => handleCellClick(cellId)}
                                onDoubleClick={() => handleCellDoubleClick(cellId)}>
                                {isEditing ? (
                                  <input ref={inputRef} type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleEditComplete} onKeyDown={handleKeyDown}
                                    className="w-full h-full px-2 text-sm outline-none bg-background" />
                                ) : (
                                  <div className={`w-full h-full px-2 text-sm flex items-center truncate ${isFormula ? "font-mono text-blue-600" : ""} ${cell?.format.bold ? "font-bold" : ""}`}
                                    style={{ color: cell?.format.color || "inherit", backgroundColor: cell?.format.backgroundColor || "inherit" }}>
                                    {displayValue}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                          <td className="w-12 border p-1 sticky right-0 bg-background z-10">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Chart Visualization */}
            {chartData.labels.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5" />Data Visualization</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Simple bar chart representation */}
                    <div className="flex items-end gap-2 h-48">
                      {chartData.values.map((val, idx) => {
                        const max = Math.max(...chartData.values);
                        const height = max > 0 ? (val / max) * 100 : 0;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w-full bg-gradient-to-t from-primary to-primary/50 rounded-t relative" style={{ height: `${Math.max(height, 5)}%` }}>
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap">{formatCurrency(val)}</div>
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-full">{chartData.labels[idx]}</div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center"><div className="text-2xl font-bold text-emerald-600">{formatCurrency(totals.total)}</div><div className="text-xs text-muted-foreground">Total</div></div>
                      <div className="text-center"><div className="text-2xl font-bold text-blue-600">{chartData.values.length}</div><div className="text-xs text-muted-foreground">Categories</div></div>
                      <div className="text-center"><div className="text-2xl font-bold text-purple-600">{chartData.values.length > 0 ? formatCurrency(totals.total / chartData.values.length) : "0"}</div><div className="text-xs text-muted-foreground">Average</div></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formula Help */}
            <Card>
              <CardHeader><CardTitle className="text-base">Formula Reference</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg"><div className="font-mono text-blue-600 font-medium">=SUM(A1:A10)</div><div className="text-muted-foreground mt-1">Sum range</div></div>
                  <div className="p-3 bg-muted rounded-lg"><div className="font-mono text-blue-600 font-medium">=AVERAGE(A1:A10)</div><div className="text-muted-foreground mt-1">Average range</div></div>
                  <div className="p-3 bg-muted rounded-lg"><div className="font-mono text-blue-600 font-medium">=COUNT(A1:A10)</div><div className="text-muted-foreground mt-1">Count non-empty</div></div>
                  <div className="p-3 bg-muted rounded-lg"><div className="font-mono text-blue-600 font-medium">=MAX(A1:A10)</div><div className="text-muted-foreground mt-1">Maximum value</div></div>
                  <div className="p-3 bg-muted rounded-lg"><div className="font-mono text-blue-600 font-medium">=MIN(A1:A10)</div><div className="text-muted-foreground mt-1">Minimum value</div></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader><CardTitle className="text-base">Choose a Template</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {TEMPLATES.map((template) => (
                    <button key={template.id}
                      className="flex flex-col items-center p-4 border rounded-lg hover:bg-muted/50 hover:border-primary transition-all text-center"
                      onClick={() => initializeSpreadsheet(template.id)}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">{template.icon}</div>
                      <div className="font-medium text-sm">{template.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-5 w-5" />Generate Custom Report</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Report Title</Label>
                    <Input value={reportConfig.title} onChange={(e) => setReportConfig({ ...reportConfig, title: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Group By</Label>
                    <Select value={reportConfig.groupBy} onValueChange={(v) => setReportConfig({ ...reportConfig, groupBy: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">By Day</SelectItem>
                        <SelectItem value="week">By Week</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="member">By Member</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>From Date</Label>
                    <Input type="date" value={reportConfig.dateFrom} onChange={(e) => setReportConfig({ ...reportConfig, dateFrom: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>To Date</Label>
                    <Input type="date" value={reportConfig.dateTo} onChange={(e) => setReportConfig({ ...reportConfig, dateTo: e.target.value })} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Include Transaction Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {["savings", "levy", "loan_repayment", "entrance_fee", "refund", "special", "withdrawal"].map((type) => (
                        <Badge key={type} variant={reportConfig.includeTypes.includes(type) ? "default" : "outline"}
                          className="cursor-pointer" onClick={() => {
                            const types = reportConfig.includeTypes.includes(type)
                              ? reportConfig.includeTypes.filter((t) => t !== type)
                              : [...reportConfig.includeTypes, type];
                            setReportConfig({ ...reportConfig, includeTypes: types });
                          }}>
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={generateReport} className="w-full" disabled={!financialData}>
                  <BarChart3 className="h-4 w-4 mr-2" />Generate Report
                </Button>
              </CardContent>
            </Card>

            {/* Report Preview */}
            {financialData && (
              <Card>
                <CardHeader><CardTitle className="text-base">Data Preview ({financialData.length} records)</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-left">Member</th>
                          <th className="p-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {financialData.slice(0, 50).map((item) => (
                          <tr key={item.id} className="hover:bg-muted/30">
                            <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="p-2"><Badge variant="outline">{item.type}</Badge></td>
                            <td className="p-2">{item.memberName}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
