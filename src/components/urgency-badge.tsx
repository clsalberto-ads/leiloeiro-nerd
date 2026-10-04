"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export type Urgency = "urgent" | "warn" | null;

function compute(deadline: Date) {
  const diffMs = deadline.getTime() - Date.now();
  if (diffMs <= 0) return null;
  const diffMin = diffMs / 60000;
  if (diffMin <= 5) return "urgent" as const;
  if (diffMin <= 60) return "warn" as const;
  return null;
}

export function UrgencyBadge({ deadline }: { deadline: Date }) {
  const [urgency, setUrgency] = useState<Urgency>(compute(deadline));

  useEffect(() => {
    const id = setInterval(() => setUrgency(compute(deadline)), 30000);
    return () => clearInterval(id);
  }, [deadline]);

  if (urgency === "urgent") return <Badge variant="destructive">Termina em 5 min</Badge>;
  if (urgency === "warn") return <Badge variant="secondary">Termina em 1h</Badge>;
  return null;
}
