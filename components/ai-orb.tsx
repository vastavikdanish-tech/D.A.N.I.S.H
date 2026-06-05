"use client";

import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";

type OrbState = "off" | "listening" | "thinking" | "speaking";

export function AiOrb({ state = "off", size = "lg" }: { state?: OrbState; size?: "sm" | "lg" }) {
  const isCompact = size === "sm";
  const outer = isCompact ? "size-32" : "size-56";
  const inner = isCompact ? "size-14" : "size-24";
  const iconSize = isCompact ? "size-6" : "size-10";
  const ringWidth = isCompact ? 16 : 28;

  return (
    <div className={cn("relative grid place-items-center", outer)}>
      {/* Pulsing background glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: state === "listening"
            ? ["0 0 30px rgba(53,217,255,0.3)", "0 0 60px rgba(53,217,255,0.6)", "0 0 30px rgba(53,217,255,0.3)"]
            : state === "speaking"
            ? ["0 0 40px rgba(0,255,136,0.4)", "0 0 80px rgba(0,255,136,0.7)", "0 0 40px rgba(0,255,136,0.4)"]
            : state === "thinking"
            ? ["0 0 20px rgba(255,183,77,0.2)", "0 0 50px rgba(255,183,77,0.5)", "0 0 20px rgba(255,183,77,0.2)"]
            : "0 0 15px rgba(53,217,255,0.15)",
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Outer rings */}
      {state === "listening" && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-cyan-electric/40"
              initial={{ inset: ringWidth * i, opacity: 0.6 }}
              animate={{
                inset: [ringWidth * i, ringWidth * i + 8, ringWidth * i],
                opacity: [0.6, 0.2, 0.6],
              }}
              transition={{ duration: 1.5 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ inset: `${ringWidth * i}px` }}
            />
          ))}
        </>
      )}

      {state === "thinking" && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border border-amber/30"
              initial={{ inset: 10 + i * 20, rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4 + i * 2, repeat: Infinity, ease: "linear" }}
              style={{
                inset: `${10 + i * 20}px`,
                borderTopColor: "rgba(255,183,77,0.6)",
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: "transparent",
              }}
            />
          ))}
        </>
      )}

      {state === "speaking" && (
        <motion.div
          className="absolute inset-4 rounded-full border border-mint/30"
          animate={{
            scale: [1, 1.05, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {state === "off" && (
        <div className="absolute inset-4 rounded-full border border-white/5" />
      )}

      {/* Rotating ring (always visible) */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
        className={cn(
          "absolute rounded-full",
          state === "speaking" ? "border-t-mint" : "border-t-cyan-electric",
          isCompact ? "border-t-2 inset-1" : "border-t inset-2"
        )}
        style={{ borderTopWidth: isCompact ? 2 : 1, opacity: 0.7 }}
      />

      {/* Center icon */}
      <motion.div
        className={cn(
          "grid place-items-center rounded-full border shadow-glow",
          inner,
          state === "listening" ? "border-cyan-electric/40 bg-cyan-electric/12" :
          state === "speaking" ? "border-mint/40 bg-mint/12" :
          state === "thinking" ? "border-amber/30 bg-amber/10" :
          "border-cyan-electric/20 bg-cyan-electric/8"
        )}
        animate={state === "listening" ? { scale: [1, 1.04, 1] } :
                state === "speaking" ? { scale: [1, 1.06, 1] } :
                state === "thinking" ? { scale: [1, 1.02, 1] } :
                {}}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Mic className={cn(iconSize, "text-cyan-soft")} />
      </motion.div>
    </div>
  );
}
