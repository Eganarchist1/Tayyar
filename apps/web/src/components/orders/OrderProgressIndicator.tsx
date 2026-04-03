"use client";

import React from "react";
import { Clock, CheckCircle2 } from "lucide-react";

const statuses = [
  { id: "pending", labelAr: "مطلوب", labelEn: "Requested" },
  { id: "accepted", labelAr: "مقبول", labelEn: "Accepted" },
  { id: "picked_up", labelAr: "تم الاستلام", labelEn: "Picked Up" },
  { id: "on_way", labelAr: "قريب منك", labelEn: "Near Customer" },
  { id: "delivered", labelAr: "تم التوصيل", labelEn: "Delivered" },
];

export function OrderProgressIndicator({ currentStatus }: { currentStatus: string }) {
  const currentIndex = statuses.findIndex((s) => s.id === currentStatus);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-6 relative">
        {/* Connector Line Base */}
        <div className="absolute top-[14px] inset-x-0 h-[1px] bg-[var(--border-default)]" />
        
        {statuses.map((s, idx) => {
          const isCompleted = idx < currentIndex;
          const isActive = idx === currentIndex;

          return (
            <div key={s.id} className="flex flex-col items-center gap-3 flex-1 relative z-10 w-full">
              {/* Completed Connector Bar */}
              {idx < statuses.length - 1 && idx < currentIndex && (
                <div 
                   className="absolute top-[14px] start-1/2 rtl:translate-x-1/2 ltr:-translate-x-1/2 w-full h-[2px] bg-[var(--primary-500)] shadow-[0_0_8px_var(--primary-300)]" 
                />
              )}
              
              <div 
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-500 border ${
                  isCompleted ? 'bg-[var(--primary-500)] border-[var(--primary-400)] text-white' : 
                  isActive ? 'bg-[var(--gold-500)] border-[var(--gold-400)] text-white animate-pulse shadow-glow-gold' : 
                  'bg-[var(--bg-surface-2)] border-[var(--border-strong)] text-[var(--text-tertiary)]'
                }`}
              >
                {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-mono font-bold">{idx + 1}</span>}
              </div>
              <div className="flex flex-col items-center">
                 <span className={`text-[9px] font-black uppercase tracking-widest italic font-display-ar ${
                   isActive ? 'text-[var(--gold-600)] dark:text-[var(--gold-400)]' : isCompleted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'
                 }`}>
                   {s.labelAr}
                 </span>
                 <span className="text-[8px] font-mono font-bold text-[var(--text-tertiary)] opacity-60 uppercase tracking-tighter">
                   {s.labelEn}
                 </span>
              </div>
            </div>
          );
        })}
      </div>
      
      {currentStatus !== "delivered" && (
        <div className="bg-[var(--bg-surface-2)] bg-opacity-40 border border-[var(--border-default)] backdrop-blur-md rounded-[20px] p-4 flex items-center justify-between group hover:border-[var(--primary-300)] transition-colors">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--primary-600)] bg-opacity-10 flex items-center justify-center">
                 <Clock className="w-4 h-4 text-[var(--primary-600)] dark:text-[var(--primary-400)]" />
              </div>
              <div>
                 <p className="text-[10px] text-[var(--text-secondary)] uppercase font-black tracking-widest font-display-ar border-b border-[var(--border-default)] pb-1 mb-1">الوقت المتوقع لوصول الطيار</p>
                 <p className="text-[8px] text-[var(--text-tertiary)] uppercase font-mono">Estimated Pilot Arrival</p>
              </div>
           </div>
           <div className="text-end">
              <span className="text-xl font-black text-[var(--text-primary)] italic tracking-tighter tabular-nums drop-shadow-sm">12-15</span>
              <span className="text-[10px] font-bold text-[var(--text-tertiary)] ms-1 font-display-ar">دقيقة</span>
           </div>
        </div>
      )}
    </div>
  );
}
