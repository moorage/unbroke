# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Unbroke** is a personal finance application for managing and categorizing financial transactions. It's built as a Tauri desktop app with a React frontend that imports CSV files from banks and categorizes transactions using user-defined rules.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server (opens desktop app)
pnpm tauri dev

# Build TypeScript and create production build
pnpm build

# Build desktop application
pnpm tauri build

# Frontend development server only (port 1420)
pnpm dev

# Build frontend preview
pnpm preview
```

## Technology Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri v2 (Rust)
- **Database**: SQLite (via @tauri-apps/plugin-sql)
- **UI Components**: Shadcn primitives + Tailwind CSS
- **CSV Processing**: PapaParse
- **Package Manager**: pnpm

## Architecture

### Database Schema
SQLite database with two main tables:
- `transactions` - financial transaction data with fields for date, description, amount, category, memo
- `rules` - keyword-based categorization rules that auto-assign categories to matching transactions

### Key Application Flow
1. **CSV Import**: Users upload bank CSV files → parsed and deduplicated → stored in transactions table
2. **Manual Categorization**: Users assign categories to transactions via dropdown selects
3. **Rule Creation**: When categorizing, users can create rules to auto-categorize future transactions containing specific keywords
4. **Rule Application**: Rules can be applied retroactively to all existing transactions

### State Management Pattern
- **React state** in App.tsx manages all UI state and transaction data
- **localStorage** persists user preferences (name, group, categories list)
- **SQLite database** stores transactions and rules persistently
- No external state management library - uses built-in React hooks

### Data Architecture Notes
- Transaction deduplication uses composite key: `${date}-${description}-${amount}`
- Rules use SQL LIKE pattern matching: `description LIKE %keyword%`
- Categories are dynamically maintained as a string array in localStorage + React state
- All database operations are async and use the `@tauri-apps/plugin-sql` plugin

### UI Component Structure
- **App.tsx** contains all business logic (550+ lines)
- **components/ui/** contains reusable Radix UI + Tailwind components (button, dialog, input, select, etc.)
- **db.ts** handles database connection and table initialization
- Uses shadcn/ui component patterns with `cn()` utility for class merging