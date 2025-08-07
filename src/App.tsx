import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import { Toaster, toast } from "sonner";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DragDropEvent } from "@tauri-apps/api/webview";
import type { Event as TauriEvent } from "@tauri-apps/api/event";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Label } from "./components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { getDb } from "./db";
import "./App.css";
import TransactionsTable from "./components/TransactionsTable";

interface Transaction {
  id?: number;
  transaction_date: string;
  post_date: string;
  description: string;
  category: string;
  type: string;
  amount: number;
  memo: string;
}

interface Rule {
  id?: number;
  keyword: string;
  category: string;
}

function RuleDialog({
  open,
  onOpenChange,
  pendingRule,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingRule: Rule | null;
  onConfirm: (apply: boolean) => void;
}) {
  const [applyToAll, setApplyToAll] = useState(false);

  useEffect(() => {
    if (open) setApplyToAll(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Rule</DialogTitle>
          <DialogDescription>
            Map transactions containing "{pendingRule?.keyword}" to "
            {pendingRule?.category}".
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="apply"
            checked={applyToAll}
            onCheckedChange={(v) => setApplyToAll(!!v)}
          />
          <Label htmlFor="apply">Apply to all existing transactions</Label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(applyToAll)}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [groupTouched, setGroupTouched] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const newCategoryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRule, setNewRule] = useState<Rule>({ keyword: "", category: "" });
  const [pendingRule, setPendingRule] = useState<Rule | null>(null);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [action, setAction] = useState<string | undefined>(undefined);
  const [sortColumn, setSortColumn] = useState<keyof Transaction>(
    "transaction_date"
  );
  const [sortDesc, setSortDesc] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  useEffect(() => {
    const savedName = localStorage.getItem("name") || "";
    const savedGroup = localStorage.getItem("group") || "";
    if (savedName) setName(savedName);
    if (savedGroup) {
      setGroup(savedGroup);
      setGroupTouched(true);
    }
    (async () => {
      const db = await getDb();
      const savedRules = (await db.select<Rule[]>(
        "SELECT id, keyword, category FROM rules"
      )) as Rule[];
      setRules(savedRules);
      await loadTransactions();
      if (savedRules.length) await applyAllRules(savedRules);
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("name", name);
    if (name && !groupTouched) {
      setGroup(`${name}'s Family Expenses`);
    }
  }, [name, groupTouched]);

  useEffect(() => {
    localStorage.setItem("group", group);
  }, [group]);

  useEffect(() => {
    localStorage.setItem("categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    if ("__TAURI__" in window) {
      (async () => {
        unlisten = await getCurrentWindow().onDragDropEvent(
          async (event: TauriEvent<DragDropEvent>) => {
            console.log("tauri drag-drop", event.payload);
            const type = event.payload.type;
            if (type === "drop") {
              setDragging(false);
              const filePath = event.payload.paths?.[0];
              console.log("tauri drop", filePath);
              if (filePath) await processFile(filePath);
            } else if (type === "enter" || type === "over") {
              setDragging(true);
            } else if (type === "leave") {
              setDragging(false);
            }
          }
        );
      })();
    }
    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      if (!dragging) console.log("dragover");
      setDragging(true);
    };
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      console.log("dragenter", dragCounter.current);
      setDragging(true);
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      console.log("dragleave", dragCounter.current);
      if (dragCounter.current <= 0) setDragging(false);
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      dragCounter.current = 0;
      if (!("__TAURI__" in window)) {
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          console.log("drop", file.name);
          processFile(file);
        } else {
          console.log("drop event without file");
        }
      }
    };
    const opts = { capture: true } as AddEventListenerOptions;
    window.addEventListener("dragover", handleDragOver, opts);
    window.addEventListener("dragenter", handleDragEnter, opts);
    window.addEventListener("dragleave", handleDragLeave, opts);
    window.addEventListener("drop", handleDrop, opts);
    return () => {
      window.removeEventListener("dragover", handleDragOver, opts);
      window.removeEventListener("dragenter", handleDragEnter, opts);
      window.removeEventListener("dragleave", handleDragLeave, opts);
      window.removeEventListener("drop", handleDrop, opts);
    };
  }, []);


  async function loadTransactions() {
    setLoading(true);
    const db = await getDb();
    const rows = (await db.select<Transaction[]>(
      "SELECT * FROM transactions ORDER BY transaction_date DESC"
    )) as Transaction[];
    setTransactions(rows);
    const savedCats = JSON.parse(
      localStorage.getItem("categories") || "[]"
    ) as string[];
    const cats = Array.from(
      new Set([...savedCats, ...rows.map((r) => r.category).filter(Boolean)])
    );
    setCategories(cats);
    setLoading(false);
  }

  function dedupe(records: Transaction[]): Transaction[] {
    const map = new Map<string, Transaction>();
    for (const r of records) {
      const key = `${r.transaction_date}-${r.description}-${r.amount}`;
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }

  async function processFile(file: File | string) {
    console.log("processFile", typeof file === "string" ? file : file.name);
    const text =
      typeof file === "string"
        ? await (await fetch(convertFileSrc(file))).text()
        : await file.text();
    const parsed = Papa.parse(text, { header: true }).data as any[];
    const recs: Transaction[] = [];
    parsed.forEach((row) => {
      const transaction_date = row["Transaction Date"] || row["Date"];
      const description = row["Description"];
      const amountStr = row["Amount"];
      if (!transaction_date || !description || !amountStr) return;
      recs.push({
        transaction_date,
        post_date: row["Post Date"] || "",
        description,
        category: row["Category"] || "",
        type: row["Type"] || "",
        amount: parseFloat(String(amountStr).replace(/,/g, "")),
        memo: row["Memo"] || "",
      });
    });
    const unique = dedupe(recs);
    const db = await getDb();
    for (const r of unique) {
      const existing = (await db.select<{ id: number }[]>(
        "SELECT id FROM transactions WHERE transaction_date = ? AND description = ? AND amount = ?",
        [r.transaction_date, r.description, r.amount]
      )) as { id: number }[];
      if (!existing.length) {
        const query =
          "INSERT INTO transactions (" +
          "transaction_date, post_date, description, category, type, amount, memo" +
          ") VALUES (?,?,?,?,?,?,?)";
        await db.execute(query, [
          r.transaction_date,
          r.post_date,
          r.description,
          r.category,
          r.type,
          r.amount,
          r.memo,
        ]);
      }
    }
    console.log("processed", unique.length, "transactions");
    await applyAllRules();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  const updateCategory = useCallback(
    async (tx: Transaction, category: string) => {
      const db = await getDb();
      await db.execute("UPDATE transactions SET category = ? WHERE id = ?", [
        category,
        tx.id,
      ]);
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, category } : t))
      );
      if (!categories.includes(category)) setCategories([...categories, category]);
      toast("Create rule?", {
        description: `Use "${tx.description}" for "${category}"?`,
        action: {
          label: "Create Rule",
          onClick: () => {
            setPendingRule({ keyword: tx.description, category });
            setRuleDialogOpen(true);
          },
        },
      });
    },
    [categories]
  );

  const updateMemo = useCallback(async (id: number, memo: string) => {
    const db = await getDb();
    await db.execute("UPDATE transactions SET memo = ? WHERE id = ?", [
      memo,
      id,
    ]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, memo } : t))
    );
  }, []);

  function addCategory() {
    const cat = newCategoryRef.current?.value.trim() || "";
    if (!cat) return;
    if (categories.some((c) => c.toLowerCase() === cat.toLowerCase())) return;
    setCategories([...categories, cat]);
    if (newCategoryRef.current) newCategoryRef.current.value = "";
  }

  async function deleteAllData() {
    const db = await getDb();
    await db.execute("DELETE FROM transactions");
    setTransactions([]);
  }

  async function addRule() {
    if (!newRule.keyword || !newRule.category) return;
    const db = await getDb();
    const res = await db.execute(
      "INSERT INTO rules (keyword, category) VALUES (?, ?)",
      [newRule.keyword, newRule.category]
    );
    const rule = { ...newRule, id: res.lastInsertId };
    setRules([...rules, rule]);
    if (!categories.includes(newRule.category))
      setCategories([...categories, newRule.category]);
    setNewRule({ keyword: "", category: "" });
  }

  async function updateRule(index: number, update: Partial<Rule>) {
    const updated = { ...rules[index], ...update };
    const db = await getDb();
    await db.execute(
      "UPDATE rules SET keyword = ?, category = ? WHERE id = ?",
      [updated.keyword, updated.category, updated.id]
    );
    setRules((prev) => prev.map((r, i) => (i === index ? updated : r)));
  }

  async function deleteRule(index: number) {
    const rule = rules[index];
    const db = await getDb();
    await db.execute("DELETE FROM rules WHERE id = ?", [rule.id]);
    setRules((prev) => prev.filter((_, i) => i !== index));
  }

  async function applyRule(rule: Rule) {
    await applyAllRules([rule]);
  }

  async function applyAllRules(rulesToApply: Rule[] = rules) {
    const db = await getDb();
    for (const rule of rulesToApply) {
      await db.execute(
        "UPDATE transactions SET category = ? WHERE description LIKE ?",
        [rule.category, `%${rule.keyword}%`]
      );
    }
    await loadTransactions();
  }

  async function confirmRule(applyAll: boolean) {
    if (!pendingRule) return;
    const db = await getDb();
    const res = await db.execute(
      "INSERT INTO rules (keyword, category) VALUES (?, ?)",
      [pendingRule.keyword, pendingRule.category]
    );
    const rule = { ...pendingRule, id: res.lastInsertId };
    setRules([...rules, rule]);
    if (!categories.includes(pendingRule.category))
      setCategories([...categories, pendingRule.category]);
    if (applyAll) await applyRule(rule);
    setPendingRule(null);
    setRuleDialogOpen(false);
  }

  const handleSort = useCallback(
    (column: keyof Transaction) => {
      if (sortColumn === column) {
        setSortDesc(!sortDesc);
      } else {
        setSortColumn(column);
        setSortDesc(column === "transaction_date");
      }
    },
    [sortColumn, sortDesc]
  );

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dir = sortDesc ? -1 : 1;
      const col = sortColumn;
      if (col === "amount") return dir * (a.amount - b.amount);
      if (col === "transaction_date" || col === "post_date")
        return (
          dir *
          (new Date(a[col]).getTime() - new Date(b[col]).getTime())
        );
      return dir * String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
    });
  }, [transactions, sortColumn, sortDesc]);

  return (
    <div className="p-4 space-y-4 min-h-screen relative">
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-white text-2xl">
          Drop CSV to add transactions
        </div>
      )}
      <Toaster position="bottom-right" />
      <div className="space-y-2">
        <Input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Input
          placeholder="Group name"
          value={group}
          onChange={(e) => {
            setGroupTouched(true);
            setGroup(e.target.value);
          }}
        />
      </div>
      <div>
        <input type="file" accept=".csv" onChange={handleFile} />
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="w-48"
          placeholder="New category"
          ref={newCategoryRef}
        />
        <Button onClick={addCategory}>Add Category</Button>
      </div>
      <div className="w-48">
        <Select
          value={action}
          onValueChange={async (v) => {
            if (v === "delete") setDeleteDialogOpen(true);
            if (v === "apply") await applyAllRules();
            setAction(undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apply">Apply All Rules</SelectItem>
            <SelectItem value="delete">Delete All Data</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <h2 className="font-semibold">Rules</h2>
        <div className="flex items-center gap-2">
          <Input
            className="w-48"
            placeholder="Keyword"
            value={newRule.keyword}
            onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
          />
          <Select
            value={newRule.category}
            onValueChange={(v) => setNewRule({ ...newRule, category: v })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={addRule}>Add Rule</Button>
        </div>
        {rules.map((r, idx) => (
          <div key={r.id ?? idx} className="flex items-center gap-2">
            <Input
              className="w-48"
              value={r.keyword}
              onChange={(e) => updateRule(idx, { keyword: e.target.value })}
            />
            <Select
              value={r.category}
              onValueChange={(v) => updateRule(idx, { category: v })}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => applyRule(r)}>Apply</Button>
            <Button variant="destructive" onClick={() => deleteRule(idx)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : sortedTransactions.length ? (
        <TransactionsTable
          transactions={sortedTransactions}
          categories={categories}
          onSort={handleSort}
          updateCategory={updateCategory}
          updateMemo={updateMemo}
        />
      ) : (
        <div className="text-center text-gray-500">No transactions found</div>
      )}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete all data?</DialogTitle>
            <DialogDescription>
              This will permanently remove all transactions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deleteAllData();
                setDeleteDialogOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RuleDialog
        open={ruleDialogOpen}
        onOpenChange={setRuleDialogOpen}
        pendingRule={pendingRule}
        onConfirm={confirmRule}
      />
    </div>
  );
}

export default App;
