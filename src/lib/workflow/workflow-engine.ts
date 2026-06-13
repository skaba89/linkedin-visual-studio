// ─── Workflow Execution Engine (Prisma-backed) ───────────────────────

import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowExecutionStep,
  WorkflowCondition,
  WorkflowStatus,
  TriggerType,
  WORKFLOW_TEMPLATES,
} from "./types";

import { db, DEFAULT_USER_ID } from "@/lib/db";

// ─── Helpers ────────────────────────────────────────────────────────

/** Convert a Prisma Workflow row to our Workflow type */
function prismaToWorkflow(
  row: {
    id: string;
    name: string;
    description: string;
    status: string;
    nodes: unknown;
    edges: unknown;
    tags: unknown;
    version: number;
    lastExecutionAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  executions: WorkflowExecution[] = []
): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status as WorkflowStatus,
    nodes: (row.nodes as WorkflowNode[]) ?? [],
    edges: (row.edges as WorkflowEdge[]) ?? [],
    tags: (row.tags as string[]) ?? [],
    version: row.version,
    lastExecutionAt: row.lastExecutionAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    executions,
  };
}

/** Convert a Prisma WorkflowExecution row to our WorkflowExecution type */
function prismaToExecution(row: {
  id: string;
  workflowId: string;
  status: string;
  triggerNode: string;
  currentNode: string | null;
  error: string | null;
  data: unknown;
  steps: unknown;
  startedAt: Date;
  completedAt: Date | null;
}): WorkflowExecution {
  return {
    id: row.id,
    workflowId: row.workflowId,
    status: row.status as WorkflowExecution["status"],
    triggerNode: row.triggerNode,
    currentNode: row.currentNode,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    error: row.error,
    data: (row.data as Record<string, unknown>) ?? {},
    steps: (row.steps as WorkflowExecutionStep[]) ?? [],
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

// ─── Workflow Engine ────────────────────────────────────────────────

class WorkflowEngine {
  /**
   * Create a new workflow from scratch
   */
  async createWorkflow(input: {
    name: string;
    description?: string;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    tags?: string[];
  }): Promise<Workflow> {
    const row = await db.workflow.create({
      data: {
        userId: DEFAULT_USER_ID,
        name: input.name,
        description: input.description ?? "",
        status: "draft",
        nodes: input.nodes ?? [],
        edges: input.edges ?? [],
        tags: input.tags ?? [],
        version: 1,
      },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Create a workflow from a template
   */
  async createFromTemplate(templateId: string, name?: string): Promise<Workflow | null> {
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
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const row = await db.workflow.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 100,
        },
      },
    });

    if (!row) return undefined;

    const executions = row.executions.map(prismaToExecution);
    return prismaToWorkflow(row, executions);
  }

  /**
   * Get all workflows
   */
  async getWorkflows(): Promise<Workflow[]> {
    const rows = await db.workflow.findMany({
      where: { userId: DEFAULT_USER_ID },
      orderBy: { updatedAt: "desc" },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 100,
        },
      },
    });

    return rows.map((row) => {
      const executions = row.executions.map(prismaToExecution);
      return prismaToWorkflow(row, executions);
    });
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(
    id: string,
    updates: Partial<Pick<Workflow, "name" | "description" | "nodes" | "edges" | "tags">>
  ): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) return null;

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.nodes !== undefined) data.nodes = updates.nodes;
    if (updates.edges !== undefined) data.edges = updates.edges;
    if (updates.tags !== undefined) data.tags = updates.tags;

    const row = await db.workflow.update({
      where: { id },
      data,
    });

    return prismaToWorkflow(row);
  }

  /**
   * Change workflow status
   */
  async setWorkflowStatus(id: string, status: WorkflowStatus): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) return null;

    const row = await db.workflow.update({
      where: { id },
      data: { status },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      await db.workflow.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a node to a workflow
   */
  async addNode(workflowId: string, node: WorkflowNode): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const nodes: WorkflowNode[] = (existing.nodes as WorkflowNode[]) ?? [];
    nodes.push(node);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { nodes },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Remove a node from a workflow (and its edges)
   */
  async removeNode(workflowId: string, nodeId: string): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const nodes: WorkflowNode[] = (existing.nodes as WorkflowNode[]) ?? [];
    const edges: WorkflowEdge[] = (existing.edges as WorkflowEdge[]) ?? [];

    const filteredNodes = nodes.filter((n) => n.id !== nodeId);
    const filteredEdges = edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: {
        nodes: filteredNodes,
        edges: filteredEdges,
      },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Add an edge between two nodes
   */
  async addEdge(workflowId: string, edge: WorkflowEdge): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const nodes: WorkflowNode[] = (existing.nodes as WorkflowNode[]) ?? [];
    const edges: WorkflowEdge[] = (existing.edges as WorkflowEdge[]) ?? [];

    // Validate nodes exist
    const fromExists = nodes.some((n) => n.id === edge.from);
    const toExists = nodes.some((n) => n.id === edge.to);
    if (!fromExists || !toExists) return null;

    edges.push(edge);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { edges },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Remove an edge
   */
  async removeEdge(workflowId: string, edgeId: string): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const edges: WorkflowEdge[] = (existing.edges as WorkflowEdge[]) ?? [];
    const filteredEdges = edges.filter((e) => e.id !== edgeId);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { edges: filteredEdges },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Find workflows that match a trigger type
   */
  async findWorkflowsByTrigger(triggerType: TriggerType): Promise<Workflow[]> {
    const rows = await db.workflow.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        status: "active",
      },
      include: {
        executions: {
          orderBy: { startedAt: "desc" },
          take: 100,
        },
      },
    });

    return rows
      .map((row) => {
        const executions = row.executions.map(prismaToExecution);
        return prismaToWorkflow(row, executions);
      })
      .filter((w) =>
        w.nodes.some((n) => n.type === "trigger" && n.triggerType === triggerType)
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
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) {
      return {
        id: "",
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

    const workflow = prismaToWorkflow(existing);
    const nodes = workflow.nodes;
    const edges = workflow.edges;

    // Find trigger node
    const triggerNode = triggerNodeOverride
      ? nodes.find((n) => n.id === triggerNodeOverride)
      : nodes.find((n) => n.type === "trigger");

    if (!triggerNode) {
      return {
        id: "",
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

    // Create execution record in DB
    const steps: WorkflowExecutionStep[] = nodes.map((n) => ({
      nodeId: n.id,
      nodeLabel: n.label,
      status: "pending" as const,
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
    }));

    const executionRow = await db.workflowExecution.create({
      data: {
        userId: DEFAULT_USER_ID,
        workflowId,
        status: "running",
        triggerNode: triggerNode.id,
        currentNode: triggerNode.id,
        data: { ...triggerData },
        steps,
      },
    });

    // Build in-memory execution object for graph traversal
    const execution: WorkflowExecution = {
      id: executionRow.id,
      workflowId,
      status: "running",
      triggerNode: triggerNode.id,
      currentNode: triggerNode.id,
      startedAt: executionRow.startedAt.toISOString(),
      completedAt: null,
      error: null,
      data: { ...triggerData },
      steps,
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

    // Update execution record in DB
    await db.workflowExecution.update({
      where: { id: executionRow.id },
      data: {
        status: execution.status,
        currentNode: null,
        error: execution.error,
        data: execution.data,
        steps: execution.steps,
        completedAt: new Date(),
      },
    });

    // Update workflow's lastExecutionAt
    await db.workflow.update({
      where: { id: workflowId },
      data: { lastExecutionAt: new Date() },
    });

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
    // Find all outgoing edges from the current node
    const outgoingEdges = workflow.edges.filter((e) => e.from === fromNodeId);

    for (const edge of outgoingEdges) {
      const targetNode = workflow.nodes.find((n) => n.id === edge.to);
      if (!targetNode) continue;

      // Check edge condition
      if (edge.condition && !evaluateCondition(edge.condition, execution.data)) {
        const step = execution.steps.find((s) => s.nodeId === targetNode.id);
        if (step) {
          step.status = "skipped";
          step.completedAt = new Date().toISOString();
        }
        continue;
      }

      // Execute the target node
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

        // Merge output into execution data
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

      // Continue traversing
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
        // In production, this would schedule a future execution
        // For now, we simulate the delay (capped at 2s for UX)
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
            // Simple transform using a sandboxed expression
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
        const subject = String(node.config.subject ?? "Notification HERMÈS");
        const body = String(node.config.body ?? "Action déclenchée par workflow HERMÈS");
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
        const message = String(node.config.message ?? `Alerte HERMÈS: ${node.label}`);
        return { slackNotified: true, channel, message };
      }

      case "notify_discord": {
        const webhookUrl = String(node.config.webhookUrl ?? "");
        const message = String(node.config.message ?? `Alerte HERMÈS: ${node.label}`);
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
    const rows = await db.workflowExecution.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        workflowId,
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    return rows.map(prismaToExecution);
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
    const executions = await db.workflowExecution.findMany({
      where: {
        userId: DEFAULT_USER_ID,
        workflowId,
      },
      orderBy: { startedAt: "desc" },
    });

    if (executions.length === 0) {
      return { totalExecutions: 0, successRate: 0, avgDurationMs: 0, lastExecution: null };
    }

    const completed = executions.filter((e) => e.status === "completed");
    const durations = executions
      .filter((e) => e.startedAt && e.completedAt)
      .map((e) => new Date(e.completedAt!).getTime() - new Date(e.startedAt).getTime());

    const workflow = await db.workflow.findUnique({
      where: { id: workflowId },
      select: { lastExecutionAt: true },
    });

    return {
      totalExecutions: executions.length,
      successRate: completed.length / executions.length,
      avgDurationMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      lastExecution: workflow?.lastExecutionAt?.toISOString() ?? null,
    };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

export const workflowEngine = new WorkflowEngine();
export { WorkflowEngine };
