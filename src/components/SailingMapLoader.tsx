"use client";

import dynamic from "next/dynamic";

const SailingMap = dynamic(() => import("./SailingMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-2xl border border-line bg-surface text-ink-muted sm:h-[400px] lg:h-[460px]">
      Karte wird geladen…
    </div>
  ),
});

export default SailingMap;
