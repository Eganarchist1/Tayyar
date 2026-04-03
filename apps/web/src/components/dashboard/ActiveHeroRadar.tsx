"use client";

import React from "react";
import { Radar, MapPin } from "lucide-react";
import { Card, CardContent } from "@tayyar/ui";
import { useSocket } from "@/hooks/useSocket";

interface HeroLocation {
  heroId: string;
  lat: number;
  lng: number;
  status?: string;
}

export function ActiveHeroRadar() {
  const [heroes, setHeroes] = React.useState<HeroLocation[]>([]);
  const { lastMessage } = useSocket();

  React.useEffect(() => {
    if (lastMessage && lastMessage.type === "LOCATION_UPDATE") {
      const data = lastMessage.payload as HeroLocation;
      setHeroes((prev) => {
        const index = prev.findIndex((h) => h.heroId === data.heroId);
        if (index > -1) {
          const newHeroes = [...prev];
          newHeroes[index] = data;
          return newHeroes;
        }
        return [...prev, data];
      });
    }
  }, [lastMessage]);

  return (
    <Card className="bg-[var(--bg-surface-2)] bg-opacity-40 backdrop-blur-2xl border-[var(--border-default)] rounded-[2rem] overflow-hidden relative">
      <div className="absolute top-4 start-4 z-10 flex items-center gap-2">
         <div className="w-2 h-2 rounded-full bg-[var(--success-500)] animate-pulse" />
         <p className="text-[10px] text-[var(--text-tertiary)] uppercase font-black tracking-widest italic font-display-ar">Live Hero Radar</p>
      </div>
      
      <CardContent className="h-64 relative flex items-center justify-center overflow-hidden">
        {/* Radar concentric circles */}
        <div className="absolute w-[300px] h-[300px] border border-[var(--border-default)] rounded-full" />
        <div className="absolute w-[200px] h-[200px] border border-[var(--border-default)] rounded-full" />
        <div className="absolute w-[100px] h-[100px] border border-[var(--border-strong)] rounded-full" />
        
        {/* Radar scanner sweep effect */}
        <div className="absolute w-full h-full animate-[spin_4s_linear_infinite] opacity-20 pointer-events-none">
          <div className="absolute top-1/2 start-1/2 w-1/2 h-[2px] bg-gradient-to-r from-[var(--primary-500)] to-transparent origin-left" />
        </div>

        {/* Merchant Center Point */}
        <div className="z-10 w-4 h-4 rounded-full bg-[var(--primary-500)] flex items-center justify-center">
           <MapPin className="w-2 h-2 text-white" />
        </div>

        {/* Hero Markers */}
        {heroes.map((hero) => (
          <div 
            key={hero.heroId}
            className="absolute transition-all duration-1000"
            style={{
              left: hero.lat ? `${((hero.lng + 180) / 360) * 100}%` : `${50 + (Math.random() * 40 - 20)}%`,
              top: hero.lng ? `${((90 - hero.lat) / 180) * 100}%` : `${50 + (Math.random() * 40 - 20)}%`,
            }}
          >
            <div className="relative group">
              <div className="w-2 h-2 rounded-full bg-[var(--success-500)] animate-ping absolute inset-0" />
              <div className="w-2 h-2 rounded-full bg-[var(--success-500)] relative" />
              <div className="absolute -top-6 start-1/2 rtl:translate-x-1/2 ltr:-translate-x-1/2 hidden group-hover:block bg-[var(--bg-surface-2)] border border-[var(--border-default)] px-2 py-1 rounded text-[8px] text-[var(--text-primary)] whitespace-nowrap font-mono z-20">
                 Hero #{hero.heroId.slice(0, 4)}
              </div>
            </div>
          </div>
        ))}
        
        {heroes.length === 0 && (
           <p className="text-[10px] text-[var(--text-tertiary)] opacity-60 uppercase font-black tracking-widest mt-24 font-display-ar">Scanning for nearby heroes...</p>
        )}
      </CardContent>
      
      <div className="p-4 bg-[var(--bg-surface-2)] bg-opacity-40 border-t border-[var(--border-default)] flex justify-between items-center">
         <div className="flex items-center gap-2">
            <span className="text-xl font-black text-[var(--text-primary)] italic tracking-tighter tabular-nums">{heroes.length}</span>
            <span className="text-[8px] text-[var(--text-tertiary)] uppercase font-black">Active Pilots Nearby</span>
         </div>
         <Radar className="w-4 h-4 text-[var(--primary-500)] opacity-40" />
      </div>
    </Card>
  );
}
