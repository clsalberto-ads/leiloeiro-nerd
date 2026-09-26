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

function formatAbsolute(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return `${date} ${time}`;
}

export function BidCountdown({ deadline }: { deadline: Date }) {
  const [ms, setMs] = useState<number>(() => Math.max(0, deadline.getTime() - Date.now()));

  useEffect(() => {
    const update = () => setMs(Math.max(0, deadline.getTime() - Date.now()));
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (ms <= 0) return <span className="font-medium text-muted-foreground" role="timer" aria-live="polite">Encerrado</span>;

  const formatted = format(ms);
  const formattedDate = formatAbsolute(deadline);

  return (
    <span role="timer" aria-live="polite" className="motion-reduce:animate-none">
      {formatted}
      <span className="sr-only">{`Prazo: ${formattedDate}`}</span>
    </span>
  );
}