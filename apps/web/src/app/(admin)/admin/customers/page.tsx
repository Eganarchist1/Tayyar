"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Search, Users } from "lucide-react";
import { Card, EmptyStateCard, InputWithIcon, PageHeader, PageShell, StatCard, useLocale } from "@tayyar/ui";
import type { CustomerListRow, MerchantSummary } from "@tayyar/types";
import { apiFetch } from "@/lib/api";

const tx = (locale: "ar" | "en", ar: string, en: string) => (locale === "ar" ? ar : en);

function formatDate(value: string | null | undefined, locale: "ar" | "en") {
  if (!value) return locale === "ar" ? "لسه مفيش" : "No activity yet";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

type MerchantFilter = MerchantSummary & { nameAr?: string | null };

export default function AdminCustomersPage() {
  const { locale } = useLocale();
  const [customers, setCustomers] = React.useState<CustomerListRow[]>([]);
  const [merchants, setMerchants] = React.useState<MerchantFilter[]>([]);
  const [query, setQuery] = React.useState("");
  const [merchantId, setMerchantId] = React.useState("ALL");
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async (search = "", merchant = "ALL") => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (merchant !== "ALL") params.set("merchantId", merchant);

    const [customersData, merchantsData] = await Promise.all([
      apiFetch<CustomerListRow[]>(params.size ? `/v1/admin/customers?${params.toString()}` : "/v1/admin/customers", undefined, "ADMIN"),
      apiFetch<MerchantFilter[]>("/v1/admin/merchants", undefined, "ADMIN"),
    ]);

    setCustomers(customersData);
    setMerchants(merchantsData);
  }, []);

  React.useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData(query, merchantId).catch(() => undefined);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [loadData, merchantId, query]);

  return (
    <PageShell
      role="ADMIN"
      user={{ name: { ar: "مدير المنصة", en: "Platform admin" }, email: "admin@tayyar.app" }}
      pageTitle={{ ar: "العملاء", en: "Customers" }}
      pageSubtitle={{ ar: "سجلات العملاء على مستوى المنصة.", en: "Platform-wide customer records." }}
      showLive
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "إدارة العملاء", en: "Customer control" }}
          title={{ ar: "كل العملاء من مكان واحد", en: "All customers in one place" }}
          subtitle={{ ar: "ابحث بالتاجر أو بالاسم أو بالرقم وافتح السجل المطلوب.", en: "Filter by merchant, name, or phone and open the matching record." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/admin" },
            { label: { ar: "العملاء", en: "Customers" } },
          ]}
          chips={[
            { label: { ar: `${customers.length} عميل ظاهر`, en: `${customers.length} visible customers` }, tone: "primary" },
            { label: { ar: `${merchants.length} تاجر`, en: `${merchants.length} merchants` }, tone: "gold" },
          ]}
        />

        <section className="panel-grid">
          <StatCard label={tx(locale, "إجمالي العملاء", "Customers")} value={customers.length} icon={<Users className="h-5 w-5" />} loading={loading} />
          <StatCard label={tx(locale, "بعناوين محفوظة", "With saved addresses")} value={customers.filter((customer) => customer.addressCount > 0).length} icon={<Building2 className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={tx(locale, "نشاط آخر 24 ساعة", "Active in 24h")} value={customers.filter((customer) => customer.lastOrderAt && Date.now() - new Date(customer.lastOrderAt).getTime() < 86400000).length} icon={<Search className="h-5 w-5" />} accentColor="gold" loading={loading} />
        </section>

        <Card className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_240px]">
            <InputWithIcon
              icon={<Search className="h-4 w-4" />}
              placeholder={tx(locale, "ابحث بالاسم أو الرقم أو العنوان", "Search by name, phone, or address")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <select
              value={merchantId}
              onChange={(event) => setMerchantId(event.target.value)}
              className="h-12 rounded-[18px] border border-white/10 bg-white/[0.04] px-4 text-sm text-text-primary outline-none focus:border-primary-400/60"
            >
              <option value="ALL" className="bg-slate-950 text-white">{tx(locale, "كل التجار", "All merchants")}</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id} className="bg-slate-950 text-white">
                  {merchant.nameAr || merchant.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-44 animate-pulse rounded-[24px] bg-white/[0.05]" />
              ))}
            </div>
          ) : customers.length ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {customers.map((customer) => (
                <Link key={customer.id} href={`/admin/customers/${customer.id}`} className="block">
                  <Card className="h-full space-y-5 transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-primary-500/12 text-primary-200">
                        <Users className="h-6 w-6" />
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-text-tertiary" />
                    </div>

                    <div>
                      <h3 className="text-xl font-black text-text-primary">{customer.name || tx(locale, "عميل من غير اسم", "Unnamed customer")}</h3>
                      <p className="mt-1 font-mono text-sm text-text-secondary">{customer.phone}</p>
                    </div>

                    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                      <div className="mb-2 text-text-primary">{customer.merchant.nameAr || customer.merchant.name}</div>
                      <div>{customer.lastAddress || tx(locale, "لسه مفيش عنوان محفوظ", "No saved address yet")}</div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <div className="text-xs text-text-tertiary">{tx(locale, "طلبات", "Orders")}</div>
                        <div className="mt-2 font-mono text-base font-black">{customer.totalOrders}</div>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <div className="text-xs text-text-tertiary">{tx(locale, "عناوين", "Addresses")}</div>
                        <div className="mt-2 font-mono text-base font-black">{customer.addressCount}</div>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-3">
                        <div className="text-xs text-text-tertiary">{tx(locale, "آخر نشاط", "Last active")}</div>
                        <div className="mt-2 text-xs font-bold">{formatDate(customer.lastOrderAt, locale)}</div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateCard
              title={{ ar: "مفيش عملا بالشكل ده", en: "No customers match this filter" }}
              description={{ ar: "غيّر التاجر أو جرّب كلمة بحث تانية.", en: "Try another merchant or search term." }}
            />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
