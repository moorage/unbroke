import { useEffect, useState, useRef } from "react";
import Papa from "papaparse";
import { Toaster, toast } from "sonner";
import { listen } from "@tauri-apps/api/event";
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
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingRule: Rule | null;
  onConfirm: (apply: boolean) => void;
  loading: boolean;
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
          <Button 
            variant="secondary" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => onConfirm(applyToAll)}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create"}
          </Button>
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
  const [sortColumn, setSortColumn] =
    useState<keyof Transaction>("transaction_date");
  const [sortDesc, setSortDesc] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const [addCategoryLoading, setAddCategoryLoading] = useState(false);
  const [applyAllRulesLoading, setApplyAllRulesLoading] = useState(false);
  const [addRuleLoading, setAddRuleLoading] = useState(false);
  const [applyRuleLoading, setApplyRuleLoading] = useState<number | null>(null);
  const [updateCategoryLoading, setUpdateCategoryLoading] = useState<number | null>(null);
  const [createRuleLoading, setCreateRuleLoading] = useState(false);

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

    console.log("Setting up Tauri v2 file drop listeners...");

    // Setup Tauri v2 file drop event listeners
    const setupTauriFileDropListeners = async () => {
      try {
        const unlistenDragEnter = await listen(
          "tauri://drag-enter",
          (event) => {
            console.log("Tauri drag-enter event:", event);
            setIsDragOver(true);
          }
        );

        const unlistenDragOver = await listen("tauri://drag-over", (event) => {
          console.log("Tauri drag-over event:", event);
          setIsDragOver(true);
        });

        const unlistenDragLeave = await listen(
          "tauri://drag-leave",
          (event) => {
            console.log("Tauri drag-leave event:", event);
            setIsDragOver(false);
          }
        );

        const unlistenDrop = await listen(
          "tauri://drag-drop",
          async (event) => {
            console.log("Tauri drag-drop event:", event);
            setIsDragOver(false);

            const payload = event.payload as {
              paths: string[];
              position: { x: number; y: number };
            };
            const filePaths = payload.paths;
            console.log("Dropped file paths:", filePaths);

            const csvFile = filePaths.find((path) =>
              path.toLowerCase().endsWith(".csv")
            );

            if (csvFile) {
              try {
                console.log("Processing CSV file:", csvFile);
                const { readTextFile } = await import("@tauri-apps/plugin-fs");
                const text = await readTextFile(csvFile);
                const fileName = csvFile.split("/").pop() || "file.csv";
                const file = new File([text], fileName, { type: "text/csv" });
                await processFile(file);
                toast.success(`Imported ${fileName}`);
              } catch (err) {
                console.error("Error reading dropped file:", err);
                toast.error("Error reading dropped file");
              }
            } else {
              toast.error("Please drop a CSV file");
            }
          }
        );

        console.log("Tauri file drop listeners registered successfully");

        return () => {
          unlistenDragEnter();
          unlistenDragOver();
          unlistenDragLeave();
          unlistenDrop();
        };
      } catch (error) {
        console.error("Error setting up Tauri file drop listeners:", error);
        return () => {};
      }
    };

    let cleanup: (() => void) | undefined;
    setupTauriFileDropListeners().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    return () => {
      if (cleanup) cleanup();
    };
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

  async function processFile(file: File) {
    const text = await file.text();
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
    await applyAllRules();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Drag enter detected");
    setIsDragOver(true);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Drag over detected");
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Drag leave detected");
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Drop detected");
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    console.log("Files dropped:", files);
    const csvFile = files.find(
      (file) => file.type === "text/csv" || file.name.endsWith(".csv")
    );

    if (csvFile) {
      console.log("Processing CSV file:", csvFile.name);
      await processFile(csvFile);
      toast.success(`Imported ${csvFile.name}`);
    } else {
      toast.error("Please drop a CSV file");
    }
  }

  async function updateCategory(tx: Transaction, category: string) {
    setUpdateCategoryLoading(tx.id!);
    try {
      const db = await getDb();
      await db.execute("UPDATE transactions SET category = ? WHERE id = ?", [
        category,
        tx.id,
      ]);
      setTransactions((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, category } : t))
      );
      if (!categories.includes(category))
        setCategories([...categories, category]);
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
    } finally {
      setUpdateCategoryLoading(null);
    }
  }

  async function updateMemo(id: number, memo: string) {
    const db = await getDb();
    await db.execute("UPDATE transactions SET memo = ? WHERE id = ?", [
      memo,
      id,
    ]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, memo } : t))
    );
  }

  async function addCategory() {
    const cat = newCategoryRef.current?.value.trim() || "";
    if (!cat) return;
    if (categories.some((c) => c.toLowerCase() === cat.toLowerCase())) return;
    setAddCategoryLoading(true);
    try {
      setCategories([...categories, cat]);
      if (newCategoryRef.current) newCategoryRef.current.value = "";
    } finally {
      setAddCategoryLoading(false);
    }
  }

  async function deleteAllData() {
    const db = await getDb();
    await db.execute("DELETE FROM transactions");
    setTransactions([]);
  }

  async function addRule() {
    if (!newRule.keyword || !newRule.category) return;
    setAddRuleLoading(true);
    try {
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
    } finally {
      setAddRuleLoading(false);
    }
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

  async function applyRule(rule: Rule, ruleIndex: number) {
    setApplyRuleLoading(ruleIndex);
    try {
      await applyAllRules([rule]);
    } finally {
      setApplyRuleLoading(null);
    }
  }

  async function applyAllRules(rulesToApply: Rule[] = rules) {
    if (rulesToApply === rules) {
      setApplyAllRulesLoading(true);
    }
    try {
      const db = await getDb();
      for (const rule of rulesToApply) {
        await db.execute(
          "UPDATE transactions SET category = ? WHERE description LIKE ?",
          [rule.category, `%${rule.keyword}%`]
        );
      }
      await loadTransactions();
    } finally {
      if (rulesToApply === rules) {
        setApplyAllRulesLoading(false);
      }
    }
  }

  async function confirmRule(applyAll: boolean) {
    if (!pendingRule) return;
    setCreateRuleLoading(true);
    try {
      const db = await getDb();
      const res = await db.execute(
        "INSERT INTO rules (keyword, category) VALUES (?, ?)",
        [pendingRule.keyword, pendingRule.category]
      );
      const rule = { ...pendingRule, id: res.lastInsertId };
      setRules([...rules, rule]);
      if (!categories.includes(pendingRule.category))
        setCategories([...categories, pendingRule.category]);
      if (applyAll) await applyAllRules([rule]);
      setPendingRule(null);
      setRuleDialogOpen(false);
    } finally {
      setCreateRuleLoading(false);
    }
  }

  function handleSort(column: keyof Transaction) {
    if (sortColumn === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortColumn(column);
      setSortDesc(column === "transaction_date");
    }
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    const dir = sortDesc ? -1 : 1;
    const col = sortColumn;
    if (col === "amount") return dir * (a.amount - b.amount);
    if (col === "transaction_date" || col === "post_date")
      return dir * (new Date(a[col]).getTime() - new Date(b[col]).getTime());
    return dir * String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
  });

  return (
    <div
      className={`p-4 space-y-4 min-h-screen transition-colors ${
        isDragOver ? "bg-blue-50 border-2 border-dashed border-blue-300" : ""
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
      <div className="space-y-2">
        <input type="file" accept=".csv" onChange={handleFile} />
        <p className="text-sm text-gray-500">
          Or drag and drop a CSV file anywhere on this window{" "}
          {isDragOver && "(Drop detected!)"}
        </p>
        <p className="text-xs text-gray-400">
          Check browser console for debug messages
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          className="w-48"
          placeholder="New category"
          ref={newCategoryRef}
        />
        <Button onClick={addCategory} disabled={addCategoryLoading}>
          {addCategoryLoading ? "Adding..." : "Add Category"}
        </Button>
      </div>
      <div className="w-48">
        <Select
          value={action}
          onValueChange={async (v) => {
            if (v === "delete") setDeleteDialogOpen(true);
            if (v === "apply") await applyAllRules();
            setAction(undefined);
          }}
          disabled={applyAllRulesLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apply">
              {applyAllRulesLoading ? "Applying Rules..." : "Apply All Rules"}
            </SelectItem>
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
            onChange={(e) =>
              setNewRule({ ...newRule, keyword: e.target.value })
            }
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
          <Button onClick={addRule} disabled={addRuleLoading}>
            {addRuleLoading ? "Adding..." : "Add Rule"}
          </Button>
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
            <Button 
              onClick={() => applyRule(r, idx)} 
              disabled={applyRuleLoading === idx}
            >
              {applyRuleLoading === idx ? "Applying..." : "Apply"}
            </Button>
            <Button variant="destructive" onClick={() => deleteRule(idx)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="min-w-full border">
            <thead className="sticky top-0 bg-gray-100">
              <tr>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("transaction_date")}
                >
                  Date
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("description")}
                >
                  Description
                </th>
                <th
                  className="p-2 text-right border cursor-pointer"
                  onClick={() => handleSort("amount")}
                >
                  Amount
                </th>
                <th
                  className="p-2 border cursor-pointer"
                  onClick={() => handleSort("category")}
                >
                  Category
                </th>
                <th className="p-2 border">Memo</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="p-2 border">{t.transaction_date}</td>
                  <td className="p-2 border">{t.description}</td>
                  <td className="p-2 text-right border">
                    {t.amount.toFixed(2)}
                  </td>
                  <td className="w-48 p-2 border">
                    <Select
                      value={t.category}
                      onValueChange={(v) => updateCategory(t, v)}
                      disabled={updateCategoryLoading === t.id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="w-64 p-2 border">
                    <Input
                      defaultValue={t.memo}
                      onBlur={(e) => updateMemo(t.id!, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
        loading={createRuleLoading}
      />
    </div>
  );
}

export default App;
