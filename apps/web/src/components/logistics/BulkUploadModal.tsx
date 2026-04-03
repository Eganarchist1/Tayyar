"use client";

import React from "react";
import { Upload, X, CheckCircle2 } from "lucide-react";
import { Button, Card, CardContent } from "@tayyar/ui";

export function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const [file] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<"idle" | "uploading" | "success" | "error">("idle");

  const handleUpload = () => {
    setStatus("uploading");
    setTimeout(() => setStatus("success"), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-brand-charcoal/80 backdrop-blur-xl">
      <Card className="w-full max-w-xl bg-brand-charcoal border-white/10 shadow-2xl rounded-[3rem]">
        <CardContent className="p-10 text-center">
          <div className="flex justify-between items-start mb-8">
             <div className="text-left">
                <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">Fleet Dispatch</h2>
                <p className="text-white/40 text-[10px] uppercase font-bold tracking-widest mt-1">Bulk Order CSV/Excel Upload</p>
             </div>
             <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
                title="Close Dispatch Window"
             >
                <X className="w-6 h-6 text-white/40" />
             </button>
          </div>

          <div 
            className={`border-2 border-dashed rounded-[2rem] p-12 transition-all cursor-pointer bg-white/5 ${file ? 'border-brand-gold' : 'border-white/10'}`}
          >
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-3xl bg-brand-gold/10 flex items-center justify-center mb-6">
                <Upload className="w-10 h-10 text-brand-gold" />
              </div>
              <p className="text-white font-bold text-lg">Drop your Flight Manifest</p>
              <p className="text-white/40 text-xs mt-2 uppercase tracking-widest font-bold">Support for .CSV, .XLSX</p>
              
              <Button 
                variant="outline" 
                className="mt-8 border-white/10 text-white hover:bg-white/10 rounded-2xl h-12 px-8"
              >
                Select Files
              </Button>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
             <Button 
               className="flex-1 h-16 rounded-2xl bg-brand-gold text-brand-charcoal font-black uppercase tracking-widest"
               disabled={status === "uploading"}
               onClick={handleUpload}
             >
                {status === "uploading" ? "Broadcasting..." : "Confirm & Send"}
             </Button>
          </div>

          {status === "success" && (
            <div className="mt-6 flex items-center gap-3 justify-center text-brand-emerald">
               <CheckCircle2 className="w-5 h-5" />
               <span className="font-bold uppercase tracking-widest text-[10px]">Orders Dispatched Successfully</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
