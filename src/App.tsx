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

function App() {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [groupTouched, setGroupTouched] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (name && !groupTouched) {
      setGroup(`${name}'s Family Expenses`);
    }
  }, [name, groupTouched]);

  useEffect(() => {
    loadTransactions();
  }, []);

  async function loadTransactions() {
    const db = await getDb();
    const rows = (await db.select<Transaction[]>(
      "SELECT * FROM transactions ORDER BY transaction_date DESC"
    )) as Transaction[];
    setTransactions(rows);
    const cats = Array.from(new Set(rows.map((r) => r.category).filter(Boolean)));
    setCategories(cats);
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
    await loadTransactions();
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
  }

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
      <div className="overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Date</th>
              <th className="p-2 border">Description</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">Memo</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2 border">{t.transaction_date}</td>
                <td className="p-2 border">{t.description}</td>
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
                    value={t.memo}
                    onChange={(e) =>
                      setTransactions((prev) =>
                        prev.map((p) =>
                          p.id === t.id ? { ...p, memo: e.target.value } : p
                        )
                      )
                    }
                    onBlur={(e) => updateMemo(t.id!, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
