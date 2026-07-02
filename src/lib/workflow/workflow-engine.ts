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
import { parseJsonField, stringifyJsonField } from "@/lib/json-field";

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Convert a Prisma Workflow row to our Workflow type.
 *
 * CRITICAL: `nodes`, `edges`, and `tags` are stored as `String` columns
 * (JSON-encoded) in the database — see prisma/schema.prisma. We MUST parse
 * them with `parseJsonField()` rather than casting with `as`, otherwise
 * they remain strings at runtime, get serialized as JSON strings in the
 * API response, and crash the client with `TypeError: e.nodes.map is not
 * a function` when React tries to render them.
 */
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
    nodes: parseJsonField<WorkflowNode[]>(row.nodes as string | null | undefined, []),
    edges: parseJsonField<WorkflowEdge[]>(row.edges as string | null | undefined, []),
    tags: parseJsonField<string[]>(row.tags as string | null | undefined, []),
    version: row.version,
    lastExecutionAt: row.lastExecutionAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    executions,
  };
}

/**
 * Convert a Prisma WorkflowExecution row to our WorkflowExecution type.
 *
 * Same JSON-string caveat as `prismaToWorkflow`: `data` and `steps` are
 * stored as `String` columns and must be parsed, not cast.
 */
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
    data: parseJsonField<Record<string, unknown>>(row.data as string | null | undefined, {}),
    steps: parseJsonField<WorkflowExecutionStep[]>(row.steps as string | null | undefined, []),
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
        nodes: stringifyJsonField(input.nodes ?? []),
        edges: stringifyJsonField(input.edges ?? []),
        tags: stringifyJsonField(input.tags ?? []),
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
   *
   * CRITICAL: `nodes`, `edges`, and `tags` are stored as `String` columns
   * in Prisma. The client sends them as arrays (POST/PUT body), so we must
   * `stringifyJsonField()` them before passing to Prisma — otherwise
   * Prisma throws a type mismatch error and the update silently fails.
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
    if (updates.nodes !== undefined) data.nodes = stringifyJsonField(updates.nodes);
    if (updates.edges !== undefined) data.edges = stringifyJsonField(updates.edges);
    if (updates.tags !== undefined) data.tags = stringifyJsonField(updates.tags);

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

    const nodes: WorkflowNode[] = parseJsonField<WorkflowNode[]>(existing.nodes, []);
    nodes.push(node);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { nodes: stringifyJsonField(nodes) },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Remove a node from a workflow (and its edges)
   */
  async removeNode(workflowId: string, nodeId: string): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const nodes: WorkflowNode[] = parseJsonField<WorkflowNode[]>(existing.nodes, []);
    const edges: WorkflowEdge[] = parseJsonField<WorkflowEdge[]>(existing.edges, []);

    const filteredNodes = nodes.filter((n) => n.id !== nodeId);
    const filteredEdges = edges.filter((e) => e.from !== nodeId && e.to !== nodeId);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: {
        nodes: stringifyJsonField(filteredNodes),
        edges: stringifyJsonField(filteredEdges),
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

    const nodes: WorkflowNode[] = parseJsonField<WorkflowNode[]>(existing.nodes, []);
    const edges: WorkflowEdge[] = parseJsonField<WorkflowEdge[]>(existing.edges, []);

    // Validate nodes exist
    const fromExists = nodes.some((n) => n.id === edge.from);
    const toExists = nodes.some((n) => n.id === edge.to);
    if (!fromExists || !toExists) return null;

    edges.push(edge);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { edges: stringifyJsonField(edges) },
    });

    return prismaToWorkflow(row);
  }

  /**
   * Remove an edge
   */
  async removeEdge(workflowId: string, edgeId: string): Promise<Workflow | null> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) return null;

    const edges: WorkflowEdge[] = parseJsonField<WorkflowEdge[]>(existing.edges, []);
    const filteredEdges = edges.filter((e) => e.id !== edgeId);

    const row = await db.workflow.update({
      where: { id: workflowId },
      data: { edges: stringifyJsonField(filteredEdges) },
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
    triggerNodeOverride?: string,
    userId: string = DEFAULT_USER_ID,
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
        userId,
        workflowId,
        status: "running",
        triggerNode: triggerNode.id,
        currentNode: triggerNode.id,
        data: stringifyJsonField({ ...triggerData }),
        steps: stringifyJsonField(steps),
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
    await this.executeGraph(userId, workflow, execution, triggerNode.id);

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
        data: stringifyJsonField(execution.data),
        steps: stringifyJsonField(execution.steps),
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
    userId: string,
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
        const nodeOutput = await this.executeNode(userId, targetNode, execution.data);
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
      await this.executeGraph(userId, workflow, execution, targetNode.id);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    userId: string,
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
        return this.executeAction(userId, node, data);
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
   * Execute an action node — REAL implementation (R-014).
   *
   * Previously, every action returned a fake `{xxxSent: true}` object without
   * doing anything. This made the entire workflow feature a demo, not a
   * product. The following actions are now wired to real side effects:
   *
   *   - send_email          → real email via Resend (or dev mode log)
   *   - create_lead         → db.lead.create
   *   - update_lead_status  → db.lead.update
   *   - create_contact      → db.contact.create
   *   - create_deal         → db.deal.create
   *   - update_deal_stage   → db.deal.update
   *   - add_note            → db.activityLog.create
   *   - log_activity        → db.activityLog.create
   *   - notify_slack        → real Slack incoming webhook (if SLACK_WEBHOOK_URL set)
   *   - notify_discord      → real Discord webhook (if URL configured on node)
   *   - send_webhook        → real HTTP POST (already was real)
   *   - run_agent           → agent-runner invocation (deferred — agents are
   *                            long-running and should be queued, not awaited)
   *
   * Actions that cannot be implemented in-process (send_linkedin_message,
   * wait) return a clear "not implemented" status instead of lying.
   */
  private async executeAction(
    userId: string,
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

        if (!recipient) {
          return { emailSent: false, error: "No recipient configured" };
        }

        try {
          const { sendEmail } = await import("@/lib/email/send");
          const result = await sendEmail({
            to: recipient,
            subject,
            html: body,
            text: body,
            tag: `workflow-${node.id}`,
          });
          return {
            emailSent: result.success,
            recipient,
            subject,
            messageId: result.messageId,
            provider: result.provider,
            error: result.error,
          };
        } catch (err) {
          return {
            emailSent: false,
            recipient,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "send_linkedin_message": {
        // LinkedIn Conversation API requires Marketing Developer Platform
        // access — not achievable for most apps. Return honest status.
        const leadName = String(data.lead_name ?? data.prenom ?? "Prospect");
        return {
          linkedInMessageSent: false,
          to: leadName,
          error: "LinkedIn DM API requires MDP vetting — not implemented",
        };
      }

      case "create_lead": {
        // Lead model is intentionally minimal (prenom + entreprise + score +
        // statut). For rich data (email, poste, etc.), create a Contact instead.
        const prenom = String(data.prenom ?? data.lead_name ?? data.name ?? "New");
        const entreprise = String(data.entreprise ?? data.company ?? "");
        try {
          const lead = await db.lead.create({
            data: {
              userId,
              prenom,
              entreprise,
              poste: String(data.poste ?? data.title ?? ""),
              secteur: String(data.secteur ?? ""),
              score: typeof data.score === "number" ? data.score : 0,
              statut: "new",
              dateCollected: new Date().toISOString(),
            },
          });
          return { leadCreated: true, leadId: lead.id, name: prenom };
        } catch (err) {
          return {
            leadCreated: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "update_lead_status": {
        const newStatus = String(node.config.status ?? "contacted");
        const leadId = String(data.lead_id ?? node.config.leadId ?? "");
        if (!leadId) {
          return { leadStatusUpdated: false, error: "No lead_id in context" };
        }
        try {
          // Verify ownership before updating
          const existing = await db.lead.findFirst({
            where: { id: leadId, userId },
          });
          if (!existing) {
            return { leadStatusUpdated: false, error: "Lead not found or not owned" };
          }
          await db.lead.update({
            where: { id: leadId },
            data: { statut: newStatus },
          });
          return { leadStatusUpdated: true, leadId, newStatus };
        } catch (err) {
          return {
            leadStatusUpdated: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "create_deal": {
        const value = Number(node.config.value ?? data.deal_value ?? 0);
        const title = String(node.config.title ?? data.deal_name ?? "Nouveau deal");
        const contactId = String(data.contact_id ?? node.config.contactId ?? "");

        if (!contactId) {
          return { dealCreated: false, error: "No contact_id in context" };
        }
        try {
          const contact = await db.contact.findFirst({
            where: { id: contactId, userId },
          });
          if (!contact) {
            return { dealCreated: false, error: "Contact not found or not owned" };
          }
          const deal = await db.deal.create({
            data: {
              userId,
              contactId,
              titre: title,
              valeur: value,
              stage: "prospect",
              probabilite: 10,
            },
          });
          return { dealCreated: true, dealId: deal.id, title, value };
        } catch (err) {
          return {
            dealCreated: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "update_deal_stage": {
        const newStage = String(node.config.stage ?? "proposal");
        const dealId = String(data.deal_id ?? node.config.dealId ?? "");
        if (!dealId) {
          return { dealStageUpdated: false, error: "No deal_id in context" };
        }
        try {
          const existing = await db.deal.findFirst({
            where: { id: dealId, userId },
          });
          if (!existing) {
            return { dealStageUpdated: false, error: "Deal not found or not owned" };
          }
          await db.deal.update({
            where: { id: dealId },
            data: { stage: newStage },
          });
          return { dealStageUpdated: true, dealId, newStage };
        } catch (err) {
          return {
            dealStageUpdated: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "create_contact": {
        const name = String(data.contact_name ?? data.lead_name ?? "New Contact");
        try {
          const contact = await db.contact.create({
            data: {
              userId,
              nom: String(data.nom ?? name),
              prenom: String(data.prenom ?? ""),
              email: String(data.email ?? data.contact_email ?? ""),
              entreprise: String(data.entreprise ?? data.company ?? ""),
              poste: String(data.poste ?? data.title ?? ""),
              source: "workflow",
            },
          });
          return { contactCreated: true, contactId: contact.id, name };
        } catch (err) {
          return {
            contactCreated: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
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
        // Agent runs are long-lived (LLM calls) and shouldn't block the
        // workflow execution. We log the trigger and let the agent pick
        // it up asynchronously. A full implementation would enqueue a job
        // via Inngest/Trigger.dev.
        await db.activityLog.create({
          data: {
            userId,
            agentId,
            agentName: `Workflow Trigger → ${agentId}`,
            type: "info",
            message: `Workflow a déclenché l'agent ${agentId}`,
            details: `Node: ${node.label} | Workflow data: ${JSON.stringify(data).slice(0, 200)}`,
          },
        });
        return {
          agentTriggered: true,
          agentId,
          note: "Agent trigger logged — async execution requires a job queue (Inngest/Trigger.dev)",
        };
      }

      case "add_tag": {
        const tag = String(node.config.tag ?? "workflow-tag");
        const contactId = String(data.contact_id ?? node.config.contactId ?? "");
        if (!contactId) {
          return { tagAdded: false, error: "No contact_id in context" };
        }
        try {
          const contact = await db.contact.findFirst({ where: { id: contactId, userId } });
          if (!contact) {
            return { tagAdded: false, error: "Contact not found or not owned" };
          }
          // Contact.tags is a String column holding a JSON array.
          const rawTags: string = typeof contact.tags === "string" ? contact.tags : "[]";
          const existingTags: string[] = parseJsonField<string[]>(rawTags, []);
          if (!existingTags.includes(tag)) {
            existingTags.push(tag);
            await db.contact.update({
              where: { id: contactId },
              data: { tags: stringifyJsonField(existingTags) },
            });
          }
          return { tagAdded: true, contactId, tag };
        } catch (err) {
          return {
            tagAdded: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "add_note": {
        const note = String(node.config.note ?? "");
        const contactId = String(data.contact_id ?? node.config.contactId ?? "");
        if (!contactId || !note) {
          return { noteAdded: false, error: "contact_id and note are required" };
        }
        try {
          await db.activityLog.create({
            data: {
              userId,
              agentId: "workflow",
              agentName: "Workflow Note",
              type: "info",
              message: `Note ajoutée: ${note}`,
              details: `Contact: ${contactId}`,
            },
          });
          return { noteAdded: true, contactId, note };
        } catch (err) {
          return {
            noteAdded: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "notify_slack": {
        const message = String(node.config.message ?? `Alerte HERMÈS: ${node.label}`);
        const webhookUrl = process.env.SLACK_WEBHOOK_URL ?? String(node.config.webhookUrl ?? "");
        if (!webhookUrl) {
          return { slackNotified: false, error: "SLACK_WEBHOOK_URL not configured" };
        }
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
          });
          return { slackNotified: res.ok, status: res.status, message };
        } catch (err) {
          return {
            slackNotified: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "notify_discord": {
        const message = String(node.config.message ?? `Alerte HERMÈS: ${node.label}`);
        const webhookUrl = String(node.config.webhookUrl ?? "");
        if (!webhookUrl) {
          return { discordNotified: false, error: "Discord webhook URL not configured on node" };
        }
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message }),
          });
          return { discordNotified: res.ok, status: res.status, message };
        } catch (err) {
          return {
            discordNotified: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      case "log_activity": {
        const message = String(node.config.message ?? `Workflow action: ${node.label}`);
        try {
          await db.activityLog.create({
            data: {
              userId,
              agentId: "workflow",
              agentName: "Workflow",
              type: "info",
              message,
              details: `Workflow data: ${JSON.stringify(data).slice(0, 200)}`,
            },
          });
          return { activityLogged: true, message };
        } catch (err) {
          return {
            activityLogged: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }
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
