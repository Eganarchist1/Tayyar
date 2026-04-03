"use client";

import React from "react";
import { Search, User, MapPin } from "lucide-react";
import { Input, Card, CardContent } from "@tayyar/ui";
import { apiFetch } from "@/lib/api";

type CustomerSearchResult = {
  id: string;
  name?: string | null;
  phone: string;
  lastAddress?: string | null;
};

export function CustomerSearch({ onSelect }: { onSelect: (customer: CustomerSearchResult) => void }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length > 2) {
      setIsLoading(true);
      try {
        const customers = await apiFetch<CustomerSearchResult[]>(`/customers/search?q=${encodeURIComponent(val)}`);
        setResults(customers);
      } catch (error) {
        console.error(error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setResults([]);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
        <Input 
          placeholder="Search by phone or name..." 
          className="ps-10 h-14 bg-[var(--bg-surface-2)] border-[var(--border-default)] text-[var(--text-primary)]"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {results.length > 0 && (
        <Card className="absolute top-16 inset-x-0 z-50 bg-[var(--bg-glass-strong)] backdrop-blur-2xl border-[var(--border-default)] shadow-[var(--shadow-xl)]">
          <CardContent className="p-2 space-y-1">
            {results.map((c) => (
              <button 
                key={c.id}
                onClick={() => {
                   onSelect(c);
                   setResults([]);
                   setQuery("");
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--bg-surface-2)] transition-colors text-start"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--primary-600)] bg-opacity-10 flex items-center justify-center">
                    <User className="w-5 h-5 text-[var(--primary-600)] dark:text-[var(--primary-300)]" />
                  </div>
                  <div>
                   <p className="text-[var(--text-primary)] font-bold">{c.name}</p>
                    <p className="text-[var(--text-secondary)] text-xs">{c.phone}</p>
                  </div>
                </div>
                <div className="text-end">
                   <div className="flex items-center gap-1 text-[var(--text-tertiary)] flex-row-reverse text-[10px] uppercase font-bold mb-1">
                      <MapPin className="w-3 h-3" />
                      <span>Last Used</span>
                   </div>
                   <p className="text-[var(--text-secondary)] text-xs">{c.lastAddress || "No recent address"}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <p className="mt-2 text-xs text-[var(--text-tertiary)]">Searching...</p>
      )}
    </div>
  );
}
