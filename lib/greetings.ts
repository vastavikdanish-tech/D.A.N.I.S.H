const morningGreetings = [
  "Good morning. The day is yours to shape.",
  "Rise and shine. Ready to make progress.",
  "Morning. I've been monitoring the network.",
];

const afternoonGreetings = [
  "Good afternoon. How can I assist?",
  "Afternoon. What's next on the agenda?",
  "You have my full attention.",
];

const eveningGreetings = [
  "Good evening. Wrapping up the day?",
  "Evening. Ready when you are.",
  "The system is standing by.",
];

const nightGreetings = [
  "Late hours. What do you need?",
  "Still here. What's on your mind?",
  "The network never sleeps.",
];

const taskQuips = [
  "On it.",
  "Consider it done.",
  "Processing that now.",
  "Handling it.",
  "Task accepted.",
  "Working.",
];

const errorQuips = [
  "Didn't catch that. Try again.",
  "Could not execute. Check the parameters.",
  "Command not recognized.",
  "I'm having trouble with that request.",
];

export function getTimeGreeting(): string {
  const hour = new Date().getHours();
  const pool =
    hour < 6 ? nightGreetings :
    hour < 12 ? morningGreetings :
    hour < 17 ? afternoonGreetings :
    hour < 21 ? eveningGreetings :
    nightGreetings;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getTaskQuip(): string {
  return taskQuips[Math.floor(Math.random() * taskQuips.length)];
}

export function getErrorQuip(): string {
  return errorQuips[Math.floor(Math.random() * errorQuips.length)];
}

export function getFullBriefing(greeting: string, reminders: number, goals: number, devicesOnline: number, devicesTotal: number): string {
  const parts: string[] = [greeting];
  if (reminders > 0) parts.push(`You have ${reminders} reminder${reminders > 1 ? "s" : ""} today.`);
  if (goals > 0) parts.push(`${goals} goal${goals > 1 ? "s" : ""} in progress.`);
  if (devicesTotal > 0) parts.push(`${devicesOnline} of ${devicesTotal} device${devicesTotal > 1 ? "s" : ""} online.`);
  return parts.join(" ");
}
