import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from './ui/dialog';

interface RadialMenuProps {
  name: string;
  group: string;
  onNameChange: (name: string) => void;
  onGroupChange: (name: string) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAllData: () => void;
  categories: string[];
  onAddCategory: (category: string) => void;
  addCategoryLoading: boolean;
  rules: Array<{ id?: number; keyword: string; category: string }>;
  onApplyAllRules: () => void;
  onDeleteAllRules: () => void;
  applyAllRulesLoading: boolean;
  onNavigateToRules: () => void;
}

export function RadialMenu({
  name,
  group,
  onNameChange,
  onGroupChange,
  onFileUpload,
  onDeleteAllData,
  categories,
  onAddCategory,
  addCategoryLoading,
  rules,
  onApplyAllRules,
  onDeleteAllRules,
  applyAllRulesLoading,
  onNavigateToRules,
}: RadialMenuProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  
  // Dialog states
  const [editNameOpen, setEditNameOpen] = useState(false);
  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  
  // Form states
  const [tempName, setTempName] = useState(name);
  const [tempGroup, setTempGroup] = useState(group);
  const [tempCategory, setTempCategory] = useState('');
  
  // Loading states for dialogs
  const [nameLoading, setNameLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const menuItems = [
    {
      id: 'transactions',
      label: 'Transactions',
      icon: '💰',
      subItems: [
        { id: 'add-transactions', label: 'Add Transactions', icon: '📁' },
        { id: 'delete-transactions', label: 'Delete All', icon: '🗑️' },
      ],
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: '⚙️',
      subItems: [
        { id: 'manage-rules', label: 'Manage Rules', icon: '📋' },
        { id: 'apply-rules', label: 'Apply All Rules', icon: '✅' },
        { id: 'delete-rules', label: 'Delete All Rules', icon: '🗑️' },
      ],
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: '👤',
      subItems: [
        { id: 'edit-name', label: 'Edit Name', icon: '✏️' },
        { id: 'edit-group', label: 'Edit Group', icon: '👥' },
        { id: 'add-category', label: 'Add Category', icon: '📝' },
      ],
    },
  ];

  const handleMainItemHover = (itemId: string | null) => {
    setActiveMenu(itemId);
    setActiveSubMenu(null);
  };

  const handleSubItemHover = (subItemId: string | null) => {
    setActiveSubMenu(subItemId);
  };

  const handleSubItemClick = (subItemId: string) => {
    switch (subItemId) {
      case 'add-transactions':
        document.getElementById('file-input')?.click();
        break;
      case 'delete-transactions':
        onDeleteAllData();
        break;
      case 'manage-rules':
        onNavigateToRules();
        break;
      case 'apply-rules':
        onApplyAllRules();
        break;
      case 'delete-rules':
        onDeleteAllRules();
        break;
      case 'edit-name':
        setTempName(name);
        setEditNameOpen(true);
        break;
      case 'edit-group':
        setTempGroup(group);
        setEditGroupOpen(true);
        break;
      case 'add-category':
        setTempCategory('');
        setAddCategoryOpen(true);
        break;
    }
    setActiveMenu(null);
    setActiveSubMenu(null);
  };

  const handleNameSave = async () => {
    if (nameLoading) return;
    setNameLoading(true);
    try {
      await onNameChange(tempName);
      setEditNameOpen(false);
    } finally {
      setNameLoading(false);
    }
  };

  const handleGroupSave = async () => {
    if (groupLoading) return;
    setGroupLoading(true);
    try {
      await onGroupChange(tempGroup);
      setEditGroupOpen(false);
    } finally {
      setGroupLoading(false);
    }
  };

  const handleCategorySave = async () => {
    if (!tempCategory.trim() || categoryLoading) return;
    setCategoryLoading(true);
    try {
      await onAddCategory(tempCategory.trim());
      setAddCategoryOpen(false);
      setTempCategory('');
    } finally {
      setCategoryLoading(false);
    }
  };

  const getItemPosition = (index: number, total: number) => {
    // Position items directly adjacent to main button with no gaps
    const positions = [
      { x: -68, y: 0 },     // left of main button
      { x: -48, y: 48 },    // bottom-left diagonal
      { x: 0, y: 68 },      // bottom of main button
    ];
    return positions[index] || { x: 0, y: 0 };
  };

  const getSubItemPosition = (parentIndex: number, subIndex: number, total: number) => {
    // Position sub-items directly adjacent to their parent main item
    const parentPos = getItemPosition(parentIndex, 3);
    const itemSize = 40; // Size of sub-items (w-10 h-10)
    
    // Create positions directly adjacent to each parent with no gaps
    const subPositions: Record<number, { x: number; y: number }[]> = {
      0: [ // Transactions (left parent) - extend further left
        { x: parentPos.x - itemSize - 12, y: parentPos.y - itemSize/2 },
        { x: parentPos.x - itemSize - 12, y: parentPos.y + itemSize/2 },
      ],
      1: [ // Rules (bottom-left parent) - extend down and left
        { x: parentPos.x - itemSize, y: parentPos.y + itemSize + 8 },
        { x: parentPos.x, y: parentPos.y + itemSize + 8 },
        { x: parentPos.x + itemSize, y: parentPos.y + itemSize + 8 },
      ],
      2: [ // Profile (bottom parent) - extend straight down
        { x: parentPos.x - itemSize, y: parentPos.y + itemSize + 8 },
        { x: parentPos.x, y: parentPos.y + itemSize + 8 },
        { x: parentPos.x + itemSize, y: parentPos.y + itemSize + 8 },
      ],
    };
    
    return subPositions[parentIndex]?.[subIndex] || { x: 0, y: 0 };
  };

  return (
    <div className="fixed top-2 right-2 z-50">
      <input
        id="file-input"
        type="file"
        accept=".csv"
        onChange={onFileUpload}
        className="hidden"
      />

      {/* Main radial menu with expanded hover area */}
      <div
        className="relative w-60 h-60"
        onMouseEnter={() => handleMainItemHover('menu')}
        onMouseLeave={() => handleMainItemHover(null)}
      >
        {/* Main menu button - positioned at top-right of the container */}
        <div 
          className="absolute top-0 right-0 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors"
        >
          <span className="text-white text-xl">☰</span>
        </div>

        {/* Main menu items */}
        {activeMenu && (
          <>
            {menuItems.map((item, index) => {
              const { x, y } = getItemPosition(index, menuItems.length);
              const isActiveItem = activeMenu === item.id;
              const opacity = isActiveItem ? 1 : 0.7;
              
              return (
                <div
                  key={item.id}
                  className="absolute w-12 h-12 bg-white border-2 border-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-all shadow-lg"
                  style={{
                    left: `calc(100% - 32px + ${x}px - 24px)`,
                    top: `calc(0px + 32px + ${y}px - 24px)`,
                    opacity: opacity,
                  }}
                  onMouseEnter={() => handleMainItemHover(item.id)}
                  title={item.label}
                >
                  <span className="text-lg">{item.icon}</span>
                </div>
              );
            })}

            {/* Sub menu items */}
            {activeMenu !== 'menu' && (
              <>
                {menuItems
                  .find((item) => item.id === activeMenu)
                  ?.subItems.map((subItem, subIndex) => {
                    const parentIndex = menuItems.findIndex(item => item.id === activeMenu);
                    const subItems = menuItems.find((item) => item.id === activeMenu)?.subItems || [];
                    const { x, y } = getSubItemPosition(parentIndex, subIndex, subItems.length);
                    const isActiveSubItem = activeSubMenu === subItem.id;
                    const opacity = isActiveSubItem ? 1 : 0.9;
                    
                    return (
                      <div
                        key={subItem.id}
                        className="absolute w-10 h-10 bg-green-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-600 transition-all shadow-lg"
                        style={{
                          left: `calc(100% - 32px + ${x}px - 20px)`,
                          top: `calc(0px + 32px + ${y}px - 20px)`,
                          opacity: opacity,
                        }}
                        onMouseEnter={() => handleSubItemHover(subItem.id)}
                        onClick={() => handleSubItemClick(subItem.id)}
                        title={subItem.label}
                      >
                        <span className="text-sm text-white">{subItem.icon}</span>
                      </div>
                    );
                  })}
              </>
            )}
          </>
        )}
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={editNameOpen} onOpenChange={nameLoading ? undefined : setEditNameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Your name"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !nameLoading && handleNameSave()}
              disabled={nameLoading}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setEditNameOpen(false)}
              disabled={nameLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleNameSave}
              disabled={nameLoading}
            >
              {nameLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={editGroupOpen} onOpenChange={groupLoading ? undefined : setEditGroupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group Name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Group name"
              value={tempGroup}
              onChange={(e) => setTempGroup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !groupLoading && handleGroupSave()}
              disabled={groupLoading}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setEditGroupOpen(false)}
              disabled={groupLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleGroupSave}
              disabled={groupLoading}
            >
              {groupLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={addCategoryOpen} onOpenChange={categoryLoading ? undefined : setAddCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Category name"
              value={tempCategory}
              onChange={(e) => setTempCategory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !categoryLoading && handleCategorySave()}
              disabled={categoryLoading}
            />
          </div>
          <DialogFooter>
            <Button 
              variant="secondary" 
              onClick={() => setAddCategoryOpen(false)}
              disabled={categoryLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCategorySave} 
              disabled={!tempCategory.trim() || categoryLoading}
            >
              {categoryLoading ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}