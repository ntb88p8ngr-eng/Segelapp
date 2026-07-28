"use client";

import dynamic from "next/dynamic";

const SailingMap = dynamic(() => import("./SailingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
      Karte wird geladen…
    </div>
  ),
});

export default SailingMap;
