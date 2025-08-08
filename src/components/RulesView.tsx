import React from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';

interface Rule {
  id?: number;
  keyword: string;
  category: string;
}

interface RulesViewProps {
  rules: Rule[];
  categories: string[];
  newRule: Rule;
  setNewRule: React.Dispatch<React.SetStateAction<Rule>>;
  onAddRule: () => void;
  onUpdateRule: (index: number, update: Partial<Rule>) => void;
  onDeleteRule: (index: number) => void;
  onApplyRule: (rule: Rule, ruleIndex: number) => void;
  onGoBack: () => void;
  addRuleLoading: boolean;
  applyRuleLoading: number | null;
}

export function RulesView({
  rules,
  categories,
  newRule,
  setNewRule,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onApplyRule,
  onGoBack,
  addRuleLoading,
  applyRuleLoading,
}: RulesViewProps) {
  return (
    <div className="p-4 space-y-4 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rules Management</h1>
        <Button onClick={onGoBack} variant="outline">
          ← Back to Transactions
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Add New Rule</h2>
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
          <Button onClick={onAddRule} disabled={addRuleLoading}>
            {addRuleLoading ? "Adding..." : "Add Rule"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Existing Rules ({rules.length})</h2>
        {rules.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No rules created yet. Add a rule above to automatically categorize transactions.
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((r, idx) => (
              <div key={r.id ?? idx} className="flex items-center gap-2 p-3 border rounded-lg">
                <Input
                  className="w-48"
                  value={r.keyword}
                  onChange={(e) => onUpdateRule(idx, { keyword: e.target.value })}
                  placeholder="Keyword"
                />
                <Select
                  value={r.category}
                  onValueChange={(v) => onUpdateRule(idx, { category: v })}
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
                  onClick={() => onApplyRule(r, idx)} 
                  disabled={applyRuleLoading === idx}
                  variant="outline"
                >
                  {applyRuleLoading === idx ? "Applying..." : "Apply"}
                </Button>
                <Button variant="destructive" onClick={() => onDeleteRule(idx)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}