"use client";

import React from "react";
import { Settings2 } from "lucide-react";
import { cn } from "../lib/cn";
import { resolveText, useLocale, type LocalizedText } from "../locale-context";

export interface ColumnDef<T> {
  key?: string;
  header: string | LocalizedText;
  cell: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  hiddenOnMobile?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  mobileCardContent?: (item: T) => React.ReactNode;
  emptyMessage?: string | LocalizedText;
  emptyStateTitle?: string | LocalizedText;
  emptyStateMessage?: string | LocalizedText;
  loading?: boolean;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  mobileCardContent,
  emptyMessage,
  emptyStateTitle,
  emptyStateMessage,
  loading,
  className,
}: DataTableProps<T>) {
  const { locale } = useLocale();

  if (loading) {
    return (
      <div className={cn("grid gap-3", className)}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-16 w-full animate-shimmer rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] opacity-70"
          />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-12 text-center",
          className
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-tertiary)]">
          <Settings2 className="h-6 w-6" />
        </div>
        <h3 className="app-font-body mt-5 text-lg font-bold text-[var(--text-primary)]">
          {emptyStateTitle
            ? resolveText(emptyStateTitle, locale)
            : locale === "ar"
              ? "لا توجد بيانات"
              : "No data available"}
        </h3>
        <p className="app-font-body mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
          {emptyStateMessage
            ? resolveText(emptyStateMessage, locale)
            : emptyMessage
              ? resolveText(emptyMessage, locale)
              : locale === "ar"
                ? "لم نجد أية سجلات مطابقة في الوقت الحالي."
                : "We couldn't find any matching records at this time."}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="hidden w-full overflow-hidden rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] md:block">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--bg-base)]">
                {columns.map((column, columnIndex) => (
                  <th
                    key={column.key ?? `${String(resolveText(column.header, locale))}-${columnIndex}`}
                    className={cn(
                      "app-font-body whitespace-nowrap px-6 py-4 font-bold text-[var(--text-tertiary)]",
                      column.align === "center" ? "text-center" : column.align === "right" ? "text-end" : "text-start"
                    )}
                    style={{ width: column.width }}
                  >
                    {resolveText(column.header, locale)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {data.map((row) => (
                <tr
                  key={keyExtractor(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "group transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-[var(--bg-surface-2)] active:bg-[var(--bg-base)]" : ""
                  )}
                >
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.key ?? `${String(resolveText(column.header, locale))}-${columnIndex}`}
                      className={cn(
                        "app-font-body px-6 py-4 text-[var(--text-primary)]",
                        column.align === "center" ? "text-center" : column.align === "right" ? "text-end" : "text-start"
                      )}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "animate-fade-up flex flex-col gap-3 rounded-[22px] border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition-colors",
              onRowClick ? "active:scale-[0.98] active:bg-[var(--bg-base)]" : ""
            )}
          >
            {mobileCardContent
              ? mobileCardContent(row)
              : columns.map((column, columnIndex) => {
                  if (column.hiddenOnMobile) {
                    return null;
                  }

                  return (
                    <div key={column.key ?? `${String(resolveText(column.header, locale))}-${columnIndex}`} className="flex flex-col gap-1">
                      <span className="app-font-body text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                        {resolveText(column.header, locale)}
                      </span>
                      <div className="app-font-body text-sm text-[var(--text-primary)]">{column.cell(row)}</div>
                    </div>
                  );
                })}
          </div>
        ))}
      </div>
    </div>
  );
}
