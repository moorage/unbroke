import { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./components/ui/select";
import { Input } from "./components/ui/input";
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
  keyword: string;
  category: string;
}

function App() {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [groupTouched, setGroupTouched] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [newRule, setNewRule] = useState<Rule>({ keyword: "", category: "" });
  const [sortColumn, setSortColumn] = useState<keyof Transaction>(
    "transaction_date"
  );
  const [sortDesc, setSortDesc] = useState(true);

  useEffect(() => {
    const savedName = localStorage.getItem("name") || "";
    const savedGroup = localStorage.getItem("group") || "";
    const savedRules = JSON.parse(
      localStorage.getItem("rules") || "[]"
    ) as Rule[];
    if (savedName) setName(savedName);
    if (savedGroup) {
      setGroup(savedGroup);
      setGroupTouched(true);
    }
    setRules(savedRules);
    loadTransactions().then(() => {
      if (savedRules.length) applyAllRules(savedRules);
    });
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
    localStorage.setItem("rules", JSON.stringify(rules));
  }, [rules]);

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

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  async function updateCategory(id: number, category: string) {
    const db = await getDb();
    await db.execute("UPDATE transactions SET category = ? WHERE id = ?", [
      category,
      id,
    ]);
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category } : t))
    );
    if (!categories.includes(category)) setCategories([...categories, category]);
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

  function addCategory() {
    const cat = newCategory.trim();
    if (!cat) return;
    if (categories.some((c) => c.toLowerCase() === cat.toLowerCase())) return;
    setCategories([...categories, cat]);
    setNewCategory("");
  }

  async function deleteAllData() {
    if (!confirm("Delete all data?")) return;
    const db = await getDb();
    await db.execute("DELETE FROM transactions");
    setTransactions([]);
  }

  function addRule() {
    if (!newRule.keyword || !newRule.category) return;
    setRules([...rules, newRule]);
    if (!categories.includes(newRule.category))
      setCategories([...categories, newRule.category]);
    setNewRule({ keyword: "", category: "" });
  }

  function updateRule(index: number, update: Partial<Rule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...update } : r)));
  }

  function deleteRule(index: number) {
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
      return (
        dir *
        (new Date(a[col]).getTime() - new Date(b[col]).getTime())
      );
    return dir * String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
  });

  return (
    <div className="p-4 space-y-4">
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
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
        <button className="px-2 py-1 border rounded" onClick={addCategory}>
          Add Category
        </button>
      </div>
      <div className="w-48">
        <Select
          onValueChange={(v) => {
            if (v === "delete") deleteAllData();
            if (v === "apply") applyAllRules();
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
          <button className="px-2 py-1 border rounded" onClick={addRule}>
            Add Rule
          </button>
        </div>
        {rules.map((r, idx) => (
          <div key={idx} className="flex items-center gap-2">
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
            <button
              className="px-2 py-1 border rounded"
              onClick={() => applyRule(r)}
            >
              Apply
            </button>
            <button
              className="px-2 py-1 border rounded"
              onClick={() => deleteRule(idx)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-100 sticky top-0">
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
                className="p-2 border cursor-pointer text-right"
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
                <td className="p-2 border text-right">{t.amount.toFixed(2)}</td>
                <td className="p-2 border w-48">
                  <Select
                    value={t.category}
                    onValueChange={(v) => updateCategory(t.id!, v)}
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
                <td className="p-2 border w-64">
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
    </div>
  );
}

export default App;
