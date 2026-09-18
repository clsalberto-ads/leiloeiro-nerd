"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d} d ${h} h ${m} min ${s} s`;
}

export function BidCountdown({ deadline }: { deadline: Date }) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setMs(Math.max(0, deadline.getTime() - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (ms === null) return null;
  if (ms <= 0) return <span className="font-medium text-muted-foreground">Encerrado</span>;
  return <span>{format(ms)}</span>;
}