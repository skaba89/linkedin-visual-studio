"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/appStore";
import {
  runContenuAgent,
  runQualificationAgent,
  runProspectionAgent,
} from "@/lib/agent-runner";

/**
 * Hook that manages agent execution.
 * - When simulation is running, it cycles through agents at the configured speed.
 * - Each agent execution calls the real LLM if an API key is configured,
 *   otherwise falls back to simulation.
 */
export function useAgentSimulation() {
  const agents = useAppStore((s) => s.agents);
  const isSimulating = useAppStore((s) => s.isSimulating);
  const simulationSpeed = useAppStore((s) => s.simulationSpeed);
  const addActivityLog = useAppStore((s) => s.addActivityLog);
  const setIsSimulating = useAppStore((s) => s.setIsSimulating);
  const setSimulationSpeed = useAppStore((s) => s.setSimulationSpeed);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cycleRef = useRef(0);
  const executingRef = useRef(false);

  const getIntervalMs = useCallback(() => {
    // Base: run a cycle every 15 seconds at speed 1
    return Math.max(3000, 15000 / simulationSpeed);
  }, [simulationSpeed]);

  const executeAgentCycle = async () => {
    if (executingRef.current) return; // Prevent overlapping executions
    executingRef.current = true;

    const store = useAppStore.getState();
    const activeAgents = store.agents.filter((a) => a.status === "active");

    if (activeAgents.length === 0) {
      store.addActivityLog({
        agentId: "system",
        agentName: "HERMÈS",
        type: "warning",
        message: "Aucun agent actif — activez au moins un agent",
      });
      executingRef.current = false;
      return;
    }

    // Cycle through active agents round-robin
    cycleRef.current = (cycleRef.current + 1) % activeAgents.length;
    const agent = activeAgents[cycleRef.current];

    // Mark agent as running
    const now = new Date();
    const timeHHMM = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    store.updateAgent(agent.id, {
      lastRun: timeHHMM,
      runsToday: store.agents.find((a) => a.id === agent.id)!.runsToday + 1,
      status: "active" as const,
    });
    store.setExecutingAgent(agent.id);

    try {
      if (agent.id === "contenu") {
        const result = await runContenuAgent();
        // Add logs
        for (const log of result.logs) {
          store.addActivityLog(log);
        }
        // Store generated post
        if (result.post) {
          store.addGeneratedPost(result.post);
          store.updateMetrics({
            postsPublished: store.metrics.postsPublished + 1,
            impressionsMoy: store.metrics.impressionsMoy + Math.floor(Math.random() * 300 + 100),
          });
        }
      } else if (agent.id === "qualif") {
        const result = await runQualificationAgent();
        for (const log of result.logs) {
          store.addActivityLog(log);
        }
        // Add new leads
        for (const lead of result.newLeads) {
          store.addLead(lead);
        }
        const qualifiedCount = result.newLeads.filter((l) => l.score >= 60).length;
        store.updateMetrics({
          profilsCollectes: store.metrics.profilsCollectes + result.newLeads.length,
          leadsQualifies: store.metrics.leadsQualifies + qualifiedCount,
        });
      } else if (agent.id === "prospection") {
        const result = await runProspectionAgent();
        for (const log of result.logs) {
          store.addActivityLog(log);
        }
        // Store generated messages
        store.addGeneratedMessages(result.messages);
        // Transition leads
        for (const leadId of result.transitionedLeadIds) {
          store.updateLead(leadId, { statut: "contacted" });
        }
        store.updateMetrics({
          messagesEnvoyes: store.metrics.messagesEnvoyes + result.messages.length,
          tauxReponse: Math.max(5, Math.min(60, store.metrics.tauxReponse + (Math.random() * 2 - 0.5))),
        });
      }
    } catch (error) {
      store.addActivityLog({
        agentId: agent.id,
        agentName: agent.name,
        type: "error",
        message: `Erreur d'exécution: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      });
    } finally {
      store.setExecutingAgent(null);
      executingRef.current = false;
    }
  };

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
      executeAgentCycle();
    }, getIntervalMs());

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSimulating, simulationSpeed, agents]);

  return { isSimulating, simulationSpeed, setIsSimulating, setSimulationSpeed };
}
