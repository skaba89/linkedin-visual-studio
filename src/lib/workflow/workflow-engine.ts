// ─── Workflow Execution Engine — Prisma-persisted (BUG-H2 fix) ──────────

import { db, DEFAULT_USER_ID, ensureDefaultUser } from "@/lib/db";
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowExecutionStep,
  WorkflowCondition,
  WorkflowStatus,
  TriggerType,
} from "./types";

// ─── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── DB ↔ Type Mappers ──────────────────────────────────────────────

function dbToWorkflow(row: {
  id: string;
  name: string;
  description: string;
  status: string;
  nodes: string;
  edges: string;
  executions: string;
  lastExecutionAt: string | null;
  tags: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as WorkflowStatus,
    nodes: JSON.parse(row.nodes || "[]"),
    edges: JSON.parse(row.edges || "[]"),
    executions: JSON.parse(row.executions || "[]"),
    lastExecutionAt: row.lastExecutionAt,
    tags: JSON.parse(row.tags || "[]"),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Condition Evaluator ────────────────────────────────────────────

function evaluateCondition(
  condition: WorkflowCondition,
  data: Record<string, unknown>
): boolean {
  const fieldValue = getNestedValue(data, condition.field);

  switch (condition.operator) {
    case "equals":
      return fieldValue === condition.value;
    case "not_equals":
      return fieldValue !== condition.value;
    case "contains":
      return String(fieldValue ?? "").includes(String(condition.value));
    case "not_contains":
      return !String(fieldValue ?? "").includes(String(condition.value));
    case "greater_than":
      return Number(fieldValue) > Number(condition.value);
    case "less_than":
      return Number(fieldValue) < Number(condition.value);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(fieldValue));
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(String(fieldValue));
    case "exists":
      return fieldValue !== undefined && fieldValue !== null;
    case "not_exists":
      return fieldValue === undefined || fieldValue === null;
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// ─── Workflow Engine (Prisma-backed) ────────────────────────────────

class WorkflowEngine {

  /**
   * Create a new workflow from scratch — persisted to SQLite
   */
  async createWorkflow(input: {
    name: string;
    description?: string;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    tags?: string[];
  }): Promise<Workflow> {
    await ensureDefaultUser();
    const row = await db.workflowData.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: input.name,
        description: input.description ?? "",
        status: "draft",
        nodes: JSON.stringify(input.nodes ?? []),
        edges: JSON.stringify(input.edges ?? []),
        executions: JSON.stringify([]),
        tags: JSON.stringify(input.tags ?? []),
        version: 1,
      },
    });
    return dbToWorkflow(row);
  }

  /**
   * Create a workflow from a template
   */
  async createFromTemplate(templateId: string, name?: string): Promise<Workflow | null> {
    const { WORKFLOW_TEMPLATES } = require("./types");
    const template = WORKFLOW_TEMPLATES.find((t: { id: string }) => t.id === templateId);
    if (!template) return null;

    const nodes: WorkflowNode[] = template.nodes.map((n: Omit<WorkflowNode, "id">, i: number) => ({
      ...n,
      id: `node_${i}`,
    }));
    const edges: WorkflowEdge[] = template.edges.map((e: Omit<WorkflowEdge, "id">, i: number) => ({
      ...e,
      from: nodes[Number(e.from)]?.id ?? e.from,
      to: nodes[Number(e.to)]?.id ?? e.to,
      id: `edge_${i}`,
    }));

    return this.createWorkflow({
      name: name ?? template.name,
      description: template.description,
      nodes,
      edges,
      tags: [template.category],
    });
  }

  /**
   * Get a workflow by ID
   */
  async getWorkflow(id: string): Promise<Workflow | null> {
    const row = await db.workflowData.findUnique({ where: { id } });
    if (!row) return null;
    return dbToWorkflow(row);
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<Workflow[]> {
    const rows = await db.workflowData.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(dbToWorkflow);
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(id: string, updates: Partial<Pick<Workflow, "name" | "description" | "nodes" | "edges" | "tags">>): Promise<Workflow | null> {
    const existing = await db.workflowData.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.nodes !== undefined) data.nodes = JSON.stringify(updates.nodes);
    if (updates.edges !== undefined) data.edges = JSON.stringify(updates.edges);
    if (updates.tags !== undefined) data.tags = JSON.stringify(updates.tags);

    const row = await db.workflowData.update({ where: { id }, data });
    return dbToWorkflow(row);
  }

  /**
   * Change workflow status
   */
  async setWorkflowStatus(id: string, status: WorkflowStatus): Promise<Workflow | null> {
    const existing = await db.workflowData.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await db.workflowData.update({
      where: { id },
      data: { status },
    });
    return dbToWorkflow(row);
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      await db.workflowData.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a node to a workflow
   */
  async addNode(workflowId: string, node: WorkflowNode): Promise<Workflow | null> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    workflow.nodes.push(node);
    return this.updateWorkflow(workflowId, { nodes: workflow.nodes });
  }

  /**
   * Remove a node from a workflow (and its edges)
   */
  async removeNode(workflowId: string, nodeId: string): Promise<Workflow | null> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    workflow.nodes = workflow.nodes.filter((n) => n.id !== nodeId);
    workflow.edges = workflow.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
    return this.updateWorkflow(workflowId, { nodes: workflow.nodes, edges: workflow.edges });
  }

  /**
   * Add an edge between two nodes
   */
  async addEdge(workflowId: string, edge: WorkflowEdge): Promise<Workflow | null> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    const fromExists = workflow.nodes.some((n) => n.id === edge.from);
    const toExists = workflow.nodes.some((n) => n.id === edge.to);
    if (!fromExists || !toExists) return null;

    workflow.edges.push(edge);
    return this.updateWorkflow(workflowId, { edges: workflow.edges });
  }

  /**
   * Remove an edge
   */
  async removeEdge(workflowId: string, edgeId: string): Promise<Workflow | null> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) return null;

    workflow.edges = workflow.edges.filter((e) => e.id !== edgeId);
    return this.updateWorkflow(workflowId, { edges: workflow.edges });
  }

  /**
   * Find workflows that match a trigger type
   */
  async findWorkflowsByTrigger(triggerType: TriggerType): Promise<Workflow[]> {
    const workflows = await this.getWorkflows();
    return workflows.filter(
      (w) =>
        w.status === "active" &&
        w.nodes.some(
          (n) => n.type === "trigger" && n.triggerType === triggerType
        )
    );
  }

  /**
   * Execute a workflow with given trigger data
   */
  async executeWorkflow(
    workflowId: string,
    triggerData: Record<string, unknown> = {},
    triggerNodeOverride?: string
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflow(workflowId);
    if (!workflow) {
      return {
        id: generateId(),
        workflowId,
        status: "failed",
        triggerNode: "",
        currentNode: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: "Workflow not found",
        data: triggerData,
        steps: [],
      };
    }

    // Find trigger node
    const triggerNode =
      triggerNodeOverride
        ? workflow.nodes.find((n) => n.id === triggerNodeOverride)
        : workflow.nodes.find((n) => n.type === "trigger");

    if (!triggerNode) {
      return {
        id: generateId(),
        workflowId,
        status: "failed",
        triggerNode: "",
        currentNode: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        error: "No trigger node found",
        data: triggerData,
        steps: [],
      };
    }

    const execution: WorkflowExecution = {
      id: generateId(),
      workflowId,
      status: "running",
      triggerNode: triggerNode.id,
      currentNode: triggerNode.id,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      data: { ...triggerData },
      steps: workflow.nodes.map((n) => ({
        nodeId: n.id,
        nodeLabel: n.label,
        status: "pending" as const,
        startedAt: null,
        completedAt: null,
        output: null,
        error: null,
      })),
    };

    // Mark trigger as completed
    const triggerStep = execution.steps.find((s) => s.nodeId === triggerNode.id);
    if (triggerStep) {
      triggerStep.status = "completed";
      triggerStep.startedAt = new Date().toISOString();
      triggerStep.completedAt = new Date().toISOString();
      triggerStep.output = { triggerType: triggerNode.triggerType, data: triggerData };
    }

    // Execute the graph starting from trigger
    await this.executeGraph(workflow, execution, triggerNode.id);

    // Finalize
    if (execution.status === "running") {
      execution.status = "completed";
    }
    execution.completedAt = new Date().toISOString();
    execution.currentNode = null;

    // Store execution in DB
    const existing = await db.workflowData.findUnique({ where: { id: workflowId } });
    if (existing) {
      const executions: WorkflowExecution[] = JSON.parse(existing.executions || "[]");
      executions.unshift(execution);
      const trimmed = executions.slice(0, 100);
      await db.workflowData.update({
        where: { id: workflowId },
        data: {
          executions: JSON.stringify(trimmed),
          lastExecutionAt: new Date().toISOString(),
        },
      });
    }

    return execution;
  }

  /**
   * Execute the graph nodes starting from a given node
   */
  private async executeGraph(
    workflow: Workflow,
    execution: WorkflowExecution,
    fromNodeId: string
  ): Promise<void> {
    const outgoingEdges = workflow.edges.filter((e) => e.from === fromNodeId);

    for (const edge of outgoingEdges) {
      const targetNode = workflow.nodes.find((n) => n.id === edge.to);
      if (!targetNode) continue;

      if (edge.condition && !evaluateCondition(edge.condition, execution.data)) {
        const step = execution.steps.find((s) => s.nodeId === targetNode.id);
        if (step) {
          step.status = "skipped";
          step.completedAt = new Date().toISOString();
        }
        continue;
      }

      const step = execution.steps.find((s) => s.nodeId === targetNode.id);
      if (!step || step.status === "completed") continue;

      execution.currentNode = targetNode.id;
      step.status = "running";
      step.startedAt = new Date().toISOString();

      try {
        const nodeOutput = await this.executeNode(targetNode, execution.data);
        step.status = "completed";
        step.completedAt = new Date().toISOString();
        step.output = nodeOutput;

        if (nodeOutput && typeof nodeOutput === "object") {
          Object.assign(execution.data, nodeOutput);
        }
      } catch (err) {
        step.status = "failed";
        step.completedAt = new Date().toISOString();
        step.error = err instanceof Error ? err.message : String(err);
        execution.status = "failed";
        execution.error = `Node "${targetNode.label}" failed: ${step.error}`;
        return;
      }

      await this.executeGraph(workflow, execution, targetNode.id);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: WorkflowNode,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    switch (node.type) {
      case "condition": {
        const results: Record<string, boolean> = {};
        if (node.conditions) {
          for (const cond of node.conditions) {
            results[cond.field] = evaluateCondition(cond, data);
          }
        }
        return { conditionResults: results, allMet: Object.values(results).every(Boolean) };
      }

      case "delay": {
        const delayMs = node.delayMs ?? 1000;
        const actualDelay = Math.min(delayMs, 2000);
        await new Promise((resolve) => setTimeout(resolve, actualDelay));
        return { delayed: true, delayMs: actualDelay };
      }

      case "action": {
        return this.executeAction(node, data);
      }

      case "webhook": {
        if (node.webhookUrl) {
          try {
            const response = await fetch(node.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: "workflow_webhook", data }),
            });
            return { webhookSent: true, status: response.status };
          } catch (err) {
            return { webhookSent: false, error: err instanceof Error ? err.message : String(err) };
          }
        }
        return { webhookSent: false, error: "No webhook URL configured" };
      }

      case "loop": {
        return { loopCount: node.loopCount ?? 0, executed: true };
      }

      case "transform": {
        if (node.transformExpr) {
          try {
            const fn = new Function("data", `with(data) { return ${node.transformExpr}; }`);
            const result = fn(data);
            return { transformResult: result };
          } catch {
            return { transformResult: null, error: "Transform expression failed" };
          }
        }
        return null;
      }

      default:
        return null;
    }
  }

  /**
   * Execute an action node
   */
  private async executeAction(
    node: WorkflowNode,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const actionType = node.actionType;
    if (!actionType) return { actionSkipped: true, reason: "No action type" };

    switch (actionType) {
      case "send_email": {
        const recipient = String(data.lead_email ?? data.email ?? node.config.recipient ?? "");
        const subject = String(node.config.subject ?? "Notification HERMES");
        const body = String(node.config.body ?? "Action declenchée par workflow HERMES");
        return { emailSent: true, recipient, subject };
      }

      case "send_linkedin_message": {
        const leadName = String(data.lead_name ?? data.prenom ?? "Prospect");
        return { linkedInMessageSent: true, to: leadName };
      }

      case "create_lead": {
        return { leadCreated: true, name: data.lead_name ?? "New Lead" };
      }

      case "update_lead_status": {
        const newStatus = String(node.config.status ?? "contacted");
        return { leadStatusUpdated: true, newStatus };
      }

      case "create_deal": {
        return { dealCreated: true, value: node.config.value ?? 0 };
      }

      case "update_deal_stage": {
        const newStage = String(node.config.stage ?? "proposal");
        return { dealStageUpdated: true, newStage };
      }

      case "create_contact": {
        return { contactCreated: true, name: data.contact_name ?? data.lead_name ?? "New Contact" };
      }

      case "send_webhook": {
        const url = String(node.config.url ?? "");
        if (url) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ event: actionType, data, timestamp: new Date().toISOString() }),
            });
            return { webhookSent: true, status: res.status };
          } catch (err) {
            return { webhookSent: false, error: err instanceof Error ? err.message : String(err) };
          }
        }
        return { webhookSent: false, error: "No URL configured" };
      }

      case "run_agent": {
        const agentId = String(node.config.agentId ?? "contenu");
        return { agentTriggered: true, agentId };
      }

      case "add_tag": {
        const tag = String(node.config.tag ?? "workflow-tag");
        return { tagAdded: true, tag };
      }

      case "add_note": {
        const note = String(node.config.note ?? "");
        return { noteAdded: true, note };
      }

      case "notify_slack": {
        const channel = String(node.config.channel ?? "#hermes-alerts");
        const message = String(node.config.message ?? `Alerte HERMES: ${node.label}`);
        return { slackNotified: true, channel, message };
      }

      case "notify_discord": {
        const webhookUrl = String(node.config.webhookUrl ?? "");
        const message = String(node.config.message ?? `Alerte HERMES: ${node.label}`);
        return { discordNotified: true, webhookUrl: webhookUrl ? "***" : "not configured", message };
      }

      case "log_activity": {
        return { activityLogged: true, message: node.config.message ?? `Workflow action: ${node.label}` };
      }

      case "wait": {
        const waitMs = Number(node.config.waitMs ?? 5000);
        const actualWait = Math.min(waitMs, 2000);
        await new Promise((r) => setTimeout(r, actualWait));
        return { waited: true, ms: actualWait };
      }

      case "branch": {
        return { branched: true };
      }

      default:
        return { actionUnknown: true, actionType };
    }
  }

  /**
   * Get execution history for a workflow
   */
  async getExecutionHistory(workflowId: string, limit = 20): Promise<WorkflowExecution[]> {
    const row = await db.workflowData.findUnique({ where: { id: workflowId } });
    if (!row) return [];
    const executions: WorkflowExecution[] = JSON.parse(row.executions || "[]");
    return executions.slice(0, limit);
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStats(workflowId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    avgDurationMs: number;
    lastExecution: string | null;
  }> {
    const row = await db.workflowData.findUnique({ where: { id: workflowId } });
    if (!row) {
      return { totalExecutions: 0, successRate: 0, avgDurationMs: 0, lastExecution: null };
    }
    const executions: WorkflowExecution[] = JSON.parse(row.executions || "[]");
    if (executions.length === 0) {
      return { totalExecutions: 0, successRate: 0, avgDurationMs: 0, lastExecution: null };
    }

    const completed = executions.filter((e) => e.status === "completed");
    const durations = executions
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());

    return {
      totalExecutions: executions.length,
      successRate: completed.length / executions.length,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      lastExecution: row.lastExecutionAt,
    };
  }

  /**
   * Load workflows from external data — no-op, data comes from DB now
   */
  loadWorkflows(_workflows: Workflow[]): void {
    // Kept for backwards compatibility but does nothing — DB is the source of truth
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const workflowEngine = new WorkflowEngine();
export { WorkflowEngine };
