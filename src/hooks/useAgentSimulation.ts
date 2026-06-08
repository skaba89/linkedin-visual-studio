"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";

export function useAgentSimulation() {
  const agents = useAppStore((s) => s.agents);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const simulationSpeed = useAppStore((s) => s.simulationSpeed);
  const runAgentNow = useAppStore((s) => s.runAgentNow);
  const addActivityLog = useAppStore((s) => s.addActivityLog);
  const setIsSimulating = useAppStore((s) => s.setIsSimulating);
  const setSimulationSpeed = useAppStore((s) => s.setSimulationSpeed);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef(0);

  const getIntervalMs = useCallback(() => {
    // Base: run a cycle every 15 seconds at speed 1
    return Math.max(3000, 15000 / simulationSpeed);
  }, [simulationSpeed]);

  useEffect(() => {
    if (!isSimulating) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start simulation
    addActivityLog({
      agentId: "system",
      agentName: "HERMÈS",
      type: "info",
      message: "Simulation démarrée",
      details: `Vitesse: x${simulationSpeed}`,
    });

    intervalRef.current = setInterval(() => {
      const currentAgents = useAppStore.getState().agents;
      const activeAgents = currentAgents.filter((a) => a.status === "active");
      if (activeAgents.length === 0) {
        addActivityLog({
          agentId: "system",
          agentName: "HERMÈS",
          type: "warning",
          message: "Aucun agent actif — activez au moins un agent",
        });
        return;
      }

      // Cycle through active agents round-robin
      cycleRef.current = (cycleRef.current + 1) % activeAgents.length;
      const agent = activeAgents[cycleRef.current];
      runAgentNow(agent.id);
    }, getIntervalMs());

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSimulating, simulationSpeed, agents, runAgentNow, addActivityLog, getIntervalMs]);

  return { isSimulating, simulationSpeed, setIsSimulating, setSimulationSpeed };
}
