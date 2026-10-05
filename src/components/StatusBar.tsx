import { useEffect, useMemo, useState } from "react";
import { APHORISMS } from "../data/observances";
import type { AppEvent } from "../types";
import { formatDateRu, formatTime, formatWeekdayShort } from "../lib/dates";

interface Props {
  showTicker: boolean;
  todayEvents?: AppEvent[];
}

export function StatusBar({ showTicker, todayEvents = [] }: Props) {
  const [now, setNow] = useState(() => new Date());
  const tickerText = useMemo(() => {
    const obs = todayEvents.find(
      (e) =>
        !e.hidden &&
        (e.external_id?.startsWith("obs-") || e.source === "user") &&
        (e.notes || e.title),
    );
    if (obs) return obs.notes?.trim() || obs.title;
    return APHORISMS[Math.floor(Math.random() * APHORISMS.length)];
  }, [todayEvents]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <footer
      className="status"
      style={{ gridTemplateColumns: showTicker ? "1fr auto auto auto" : "1fr auto auto" }}
    >
      {showTicker ? (
        <div className="ticker" title={tickerText}>
          <span>{tickerText}</span>
        </div>
      ) : (
        <div />
      )}
      <div>{formatDateRu(now)}</div>
      <div>{formatWeekdayShort(now)}</div>
      <div>{formatTime(now)}</div>
    </footer>
  );
}
