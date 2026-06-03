import {
  AppWindow,
  Bell,
  BookOpenCheck,
  Bot,
  BriefcaseBusiness,
  CalendarClock,
  Cpu,
  DatabaseZap,
  FileText,
  GraduationCap,
  Mic2,
  MonitorSmartphone,
  Network,
  NotebookTabs,
  PlaySquare,
  RadioTower,
  Sparkles,
  Target,
  Workflow,
  Zap
} from "lucide-react";
import type { Automation, Device, ModuleCard, SystemMetric, TimelineItem } from "@/types/danish";

export const systemMetrics: SystemMetric[] = [
  { label: "AI Core", value: 100, tone: "cyan" },
  { label: "Voice", value: 98, tone: "mint" },
  { label: "Memory", value: 86, tone: "amber" },
  { label: "Security", value: 100, tone: "mint" }
];

export const devices: Device[] = [
  { id: "laptop", name: "Danish's Laptop", type: "laptop", status: "online", battery: 82, cpu: 23, ram: 48 },
  { id: "phone", name: "Danish's Phone", type: "phone", status: "online", battery: 68, cpu: 18, ram: 36 },
  { id: "home-pc", name: "Home PC", type: "desktop", status: "idle", cpu: 11, ram: 31 },
  { id: "studio-tv", name: "Living Room TV", type: "tv", status: "offline" }
];

export const automations: Automation[] = [
  {
    id: "morning",
    title: "Morning Routine",
    description: "Open apps, brief calendar, scan inbox",
    enabled: true,
    trigger: "IF time is 7:00 AM"
  },
  {
    id: "study",
    title: "Study Mode",
    description: "Focus music, block distractions, prepare notes",
    enabled: true,
    trigger: "IF Study OS session starts"
  },
  {
    id: "work",
    title: "Work Mode",
    description: "Launch workspace, summarize priorities",
    enabled: true,
    trigger: "IF laptop connects to charger"
  },
  {
    id: "shutdown",
    title: "Shutdown Routine",
    description: "Save files, cleanup temp data, power down",
    enabled: false,
    trigger: "IF command equals shutdown"
  }
];

export const modules: ModuleCard[] = [
  {
    title: "AI Assistant",
    description: "Chat, voice, planning, code help, research, summaries, and memory.",
    action: "Start",
    href: "#assistant",
    icon: Bot,
    status: "Listening"
  },
  {
    title: "Remote Control",
    description: "Monitor devices, open apps, run scripts, lock, sleep, and shutdown.",
    action: "Connect",
    href: "#remote",
    icon: MonitorSmartphone,
    status: "4 devices"
  },
  {
    title: "Content Factory",
    description: "Generate shorts, scripts, captions, hooks, titles, and thumbnails.",
    action: "Create",
    href: "#content",
    icon: PlaySquare,
    status: "Ready"
  },
  {
    title: "Automation Engine",
    description: "Build IF/THEN/ELSE workflows for routines and productivity.",
    action: "Manage",
    href: "#automation",
    icon: Workflow,
    status: "3 active"
  },
  {
    title: "Study OS",
    description: "PDF notes, AI teacher, exams, flashcards, quizzes, and research.",
    action: "Learn",
    href: "#study",
    icon: GraduationCap,
    status: "Flagship"
  },
  {
    title: "Career OS",
    description: "Internships, jobs, resumes, cover letters, interviews, and roadmaps.",
    action: "Explore",
    href: "#career",
    icon: BriefcaseBusiness,
    status: "Active"
  }
];

export const recentActions: TimelineItem[] = [
  { title: "Open VS Code", detail: "Remote command queued for laptop", time: "09:41 PM", tone: "cyan" },
  { title: "Find Python internships", detail: "5 opportunities saved to Career OS", time: "09:35 PM", tone: "mint" },
  { title: "Backup completed", detail: "Files synced successfully", time: "09:22 PM", tone: "amber" },
  { title: "Study notes generated", detail: "Physics revision sheet ready", time: "08:58 PM", tone: "cyan" }
];

export const commandExamples = [
  "D.A.N.I.S.H, open VS Code",
  "D.A.N.I.S.H, find internships for me",
  "D.A.N.I.S.H, summarize this document",
  "D.A.N.I.S.H, create complete notes for Organic Chemistry",
  "D.A.N.I.S.H, control my laptop",
  "D.A.N.I.S.H, remind me at 10 PM"
];

export const quickActions = [
  { label: "Open VS Code", icon: AppWindow },
  { label: "Search Anything", icon: Sparkles },
  { label: "Take Screenshot", icon: FileText },
  { label: "Write Code", icon: Cpu },
  { label: "Open Terminal", icon: Network }
];

export const knowledgeBlocks = [
  { label: "AI Memory", value: "1,248", icon: DatabaseZap },
  { label: "Today's Tasks", value: "7", icon: CalendarClock },
  { label: "Goals", value: "84%", icon: Target },
  { label: "Notes", value: "312", icon: NotebookTabs },
  { label: "Vault", value: "46 PDFs", icon: BookOpenCheck },
  { label: "Alerts", value: "3", icon: Bell },
  { label: "Voice", value: "Wake-ready", icon: Mic2 },
  { label: "Network", value: "120 Mbps", icon: RadioTower },
  { label: "Energy", value: "Optimized", icon: Zap }
];
