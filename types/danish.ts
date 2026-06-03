import type { LucideIcon } from "lucide-react";

export type SystemMetric = {
  label: string;
  value: number;
  tone: "cyan" | "mint" | "amber" | "danger";
};

export type Device = {
  id: string;
  name: string;
  type: "laptop" | "phone" | "desktop" | "tv";
  status: "online" | "idle" | "offline";
  battery?: number;
  cpu?: number;
  ram?: number;
};

export type Automation = {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  trigger: string;
};

export type ModuleCard = {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: LucideIcon;
  status: string;
};

export type TimelineItem = {
  title: string;
  detail: string;
  time: string;
  tone: "cyan" | "mint" | "amber" | "danger";
};
