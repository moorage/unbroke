import { memo } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";
import { Input } from "./ui/input";

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

interface TransactionsTableProps {
  transactions: Transaction[];
  categories: string[];
  onSort: (column: keyof Transaction) => void;
  updateCategory: (t: Transaction, category: string) => void;
  updateMemo: (id: number, memo: string) => void;
}

const TransactionsTable = memo(
  ({
    transactions,
    categories,
    onSort,
    updateCategory,
    updateMemo,
  }: TransactionsTableProps) => {
    return (
      <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="min-w-full border">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th
                className="p-2 border cursor-pointer"
                onClick={() => onSort("transaction_date")}
              >
                Date
              </th>
              <th
                className="p-2 border cursor-pointer"
                onClick={() => onSort("description")}
              >
                Description
              </th>
              <th
                className="p-2 border cursor-pointer text-right"
                onClick={() => onSort("amount")}
              >
                Amount
              </th>
              <th
                className="p-2 border cursor-pointer"
                onClick={() => onSort("category")}
              >
                Category
              </th>
              <th className="p-2 border">Memo</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-2 border">{t.transaction_date}</td>
                <td className="p-2 border">{t.description}</td>
                <td className="p-2 border text-right">{t.amount.toFixed(2)}</td>
                <td className="p-2 border w-48">
                  <Select
                    value={t.category}
                    onValueChange={(v) => updateCategory(t, v)}
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
    );
  }
);

TransactionsTable.displayName = "TransactionsTable";

export default TransactionsTable;
