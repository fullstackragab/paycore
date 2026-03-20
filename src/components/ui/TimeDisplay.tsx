"use client";

import { useState, useEffect } from "react";

export default function TimeDisplay({ date }: { date: Date }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    setTime(date.toLocaleTimeString());
  }, [date]);

  return <span style={{ fontSize: 11, color: "#9ca3af" }}>{time}</span>;
}
