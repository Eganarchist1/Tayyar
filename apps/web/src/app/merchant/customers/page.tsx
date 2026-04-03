"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Phone, Search, Users } from "lucide-react";
import { Button, Card, EmptyStateCard, InputWithIcon, PageHeader, PageShell, StatCard, useLocale } from "@tayyar/ui";
import type { CustomerListRow } from "@tayyar/types";
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

export default function MerchantCustomersPage() {
  const { locale } = useLocale();
  const [customers, setCustomers] = React.useState<CustomerListRow[]>([]);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  const loadCustomers = React.useCallback(async (search = "") => {
    const params = new URLSearchParams();
    if (search.trim()) {
      params.set("q", search.trim());
    }

    const path = params.size ? `/v1/merchants/customers?${params.toString()}` : "/v1/merchants/customers";
    const data = await apiFetch<CustomerListRow[]>(path);
    setCustomers(data);
  }, []);

  React.useEffect(() => {
    loadCustomers()
      .finally(() => setLoading(false));
  }, [loadCustomers]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCustomers(query).catch(() => undefined);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [loadCustomers, query]);

  return (
    <PageShell
      role="MERCHANT_OWNER"
      user={{ name: { ar: "مالك المتجر", en: "Store owner" }, email: "owner@merchant.com" }}
      pageTitle={{ ar: "العملاء", en: "Customers" }}
      pageSubtitle={{ ar: "بيانات العملاء والعناوين المحفوظة.", en: "Customer records and saved addresses." }}
      topbarActions={
        <Link href="/merchant/orders/new">
          <Button variant="gold" size="sm">
            {tx(locale, "طلب جديد", "New order")}
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        <PageHeader
          eyebrow={{ ar: "قاعدة العملاء", en: "Customer base" }}
          title={{ ar: "كل عملاء متجرك في مكان واحد", en: "Your customers in one place" }}
          subtitle={{ ar: "راجع الاسم والرقم والعناوين المحفوظة من شاشة واحدة.", en: "Review names, phones, and saved addresses from one screen." }}
          breadcrumbs={[
            { label: { ar: "لوحة التحكم", en: "Dashboard" }, href: "/merchant" },
            { label: { ar: "العملاء", en: "Customers" } },
          ]}
          chips={[
            { label: { ar: `${customers.length} عميل`, en: `${customers.length} customers` }, tone: "primary" },
            { label: { ar: "جاهز للطلب السريع", en: "Ready for quick orders" }, tone: "gold" },
          ]}
        />

        <section className="panel-grid">
          <StatCard label={tx(locale, "إجمالي العملاء", "Customers")} value={customers.length} icon={<Users className="h-5 w-5" />} loading={loading} />
          <StatCard label={tx(locale, "بعناوين محفوظة", "With saved addresses")} value={customers.filter((customer) => customer.addressCount > 0).length} icon={<Phone className="h-5 w-5" />} accentColor="success" loading={loading} />
          <StatCard label={tx(locale, "محتاجين تنظيف بيانات", "Need cleanup")} value={customers.filter((customer) => !customer.name || customer.name.trim().length < 2).length} icon={<Search className="h-5 w-5" />} accentColor="gold" loading={loading} />
        </section>

        <Card className="space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="subtle-label">{tx(locale, "بحث سريع", "Quick search")}</p>
              <h2 className="mt-2 text-2xl font-black">{tx(locale, "ابحث بالاسم أو الرقم", "Search by name or phone")}</h2>
            </div>
            <InputWithIcon
              icon={<Search className="h-4 w-4" />}
              containerClassName="w-full max-w-xl"
              placeholder={tx(locale, "ابحث باسم العميل أو رقمه", "Search by customer name or phone")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
                <Link key={customer.id} href={`/merchant/customers/${customer.id}`} className="block">
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="text-xs text-text-tertiary">{tx(locale, "الطلبات", "Orders")}</div>
                        <div className="mt-2 font-mono text-lg font-black">{customer.totalOrders}</div>
                      </div>
                      <div className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4">
                        <div className="text-xs text-text-tertiary">{tx(locale, "العناوين", "Addresses")}</div>
                        <div className="mt-2 font-mono text-lg font-black">{customer.addressCount}</div>
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4 text-sm text-text-secondary">
                      <div className="mb-2 text-text-primary">{customer.lastAddress || tx(locale, "لسه مفيش عنوان محفوظ", "No saved address yet")}</div>
                      <div>{tx(locale, "آخر نشاط", "Last activity")}: {formatDate(customer.lastOrderAt, locale)}</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyStateCard
              title={{ ar: "لسه مفيش عملا ظاهرين", en: "No customers yet" }}
              description={{ ar: "أول ما تعمل طلبات أكتر، عملاك وعناوينهم هيتجمعوا هنا عشان تشتغل أسرع بعد كده.", en: "Once you start serving more orders, repeat customers and saved addresses will show up here." }}
              action={
                <Link href="/merchant/orders/new">
                  <Button variant="gold">{tx(locale, "اعمل أول طلب", "Create an order")}</Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>
    </PageShell>
  );
}
