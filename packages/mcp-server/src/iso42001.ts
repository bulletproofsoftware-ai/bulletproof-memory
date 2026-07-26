/**
 * ISO 42001:2023 Compliance Automation Module (REQ-EVO-014)
 *
 * Provides automated compliance assessment against the ISO/IEC 42001:2023
 * AI Management System standard by mapping audit_log events to 40 controls
 * across 8 domains, generating compliance reports in JSON, CSV, and Markdown.
 */

// ─── Type Definitions ───────────────────────────────────────────────────────

export type ISO42001Domain =
  | "ai_policy"
  | "risk_assessment"
  | "objectives"
  | "data_management"
  | "impact_assessment"
  | "system_lifecycle"
  | "monitoring"
  | "improvement";

export interface ISO42001Control {
  id: string;
  domain: ISO42001Domain;
  title: string;
  description: string;
  satisfying_actions: string[];
  required_payload_fields?: string[];
  min_evidence_count: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  timestamp: string;
  session_id: string;
  project: string;
  sensitivity: string;
  details: Record<string, unknown>;
}

export interface ControlEvidence {
  control: ISO42001Control;
  period_start: string;
  period_end: string;
  event_count: number;
  sample_events: AuditEvent[];
  compliance_status: "satisfied" | "partial" | "gap";
  gap_recommendation?: string;
}

export interface ComplianceReport {
  generated_at: string;
  period_start: string;
  period_end: string;
  total_controls: number;
  satisfied_controls: number;
  partial_controls: number;
  gap_controls: number;
  compliance_score: number;
  controls: ControlEvidence[];
  gap_analysis: GapRecommendation[];
}

export interface GapRecommendation {
  control_id: string;
  control_title: string;
  domain: ISO42001Domain;
  current_count: number;
  required_count: number;
  recommendation: string;
}

// ─── ISO 42001 Controls (40 controls across 8 domains) ──────────────────────

export const ISO42001_CONTROLS: ISO42001Control[] = [
  // ── Domain 5: AI Policy (5 controls) ──────────────────────────────────────
  {
    id: "5.1",
    domain: "ai_policy",
    title: "AI Policy Establishment",
    description: "The organization shall establish an AI policy that is appropriate to its purpose and provides a framework for setting AI objectives.",
    satisfying_actions: ["store", "policy_update"],
    required_payload_fields: ["type"],
    min_evidence_count: 1,
  },
  {
    id: "5.2",
    domain: "ai_policy",
    title: "AI Policy Communication",
    description: "The AI policy shall be communicated within the organization and available to interested parties.",
    satisfying_actions: ["store", "recall", "policy_update"],
    min_evidence_count: 2,
  },
  {
    id: "5.3",
    domain: "ai_policy",
    title: "Organizational Roles and Responsibilities",
    description: "Top management shall ensure responsibilities and authorities for AI-relevant roles are assigned and communicated.",
    satisfying_actions: ["store", "policy_update", "episode_start"],
    min_evidence_count: 1,
  },
  {
    id: "5.4",
    domain: "ai_policy",
    title: "Leadership Commitment",
    description: "Top management shall demonstrate leadership and commitment to the AI management system.",
    satisfying_actions: ["store", "policy_update", "procedure_capture"],
    min_evidence_count: 1,
  },
  {
    id: "5.5",
    domain: "ai_policy",
    title: "AI Ethics Framework",
    description: "The organization shall define and maintain an AI ethics framework aligned with its values and applicable regulations.",
    satisfying_actions: ["store", "policy_update", "POLICY_DENY"],
    min_evidence_count: 1,
  },

  // ── Domain 6: Planning — Risk Assessment (5 controls) ─────────────────────
  {
    id: "6.1",
    domain: "risk_assessment",
    title: "AI Risk Identification",
    description: "The organization shall identify risks associated with AI systems, including risks to individuals and groups.",
    satisfying_actions: ["classify", "TIER_CLASSIFICATION", "DATA_CLASSIFICATION"],
    required_payload_fields: ["sensitivity"],
    min_evidence_count: 5,
  },
  {
    id: "6.2",
    domain: "risk_assessment",
    title: "AI Risk Analysis",
    description: "The organization shall analyze identified AI risks, considering likelihood and consequences.",
    satisfying_actions: ["classify", "TIER_CLASSIFICATION"],
    min_evidence_count: 3,
  },
  {
    id: "6.3",
    domain: "risk_assessment",
    title: "AI Risk Evaluation",
    description: "The organization shall evaluate AI risks against established criteria to determine risk treatment priorities.",
    satisfying_actions: ["classify", "TIER_CLASSIFICATION", "POLICY_DENY", "TRUST_DENY"],
    min_evidence_count: 3,
  },
  {
    id: "6.4",
    domain: "risk_assessment",
    title: "AI Risk Treatment",
    description: "The organization shall implement risk treatment plans for identified AI risks.",
    satisfying_actions: ["classify", "POLICY_DENY", "TRUST_DENY", "store"],
    min_evidence_count: 2,
  },
  {
    id: "6.5",
    domain: "risk_assessment",
    title: "Risk Assessment Documentation",
    description: "The organization shall retain documented information about the AI risk assessment process and results.",
    satisfying_actions: ["classify", "TIER_CLASSIFICATION", "store"],
    required_payload_fields: ["sensitivity"],
    min_evidence_count: 5,
  },

  // ── Domain 6: Planning — Objectives (5 controls) ─────────────────────────
  {
    id: "6.6",
    domain: "objectives",
    title: "AI Objectives Establishment",
    description: "The organization shall establish AI objectives at relevant functions, levels, and processes.",
    satisfying_actions: ["store", "episode_start", "procedure_capture"],
    min_evidence_count: 2,
  },
  {
    id: "6.7",
    domain: "objectives",
    title: "AI Objectives Measurability",
    description: "AI objectives shall be measurable, monitored, and consistent with the AI policy.",
    satisfying_actions: ["benchmark_record", "episode_complete"],
    min_evidence_count: 3,
  },
  {
    id: "6.8",
    domain: "objectives",
    title: "Planning to Achieve Objectives",
    description: "The organization shall plan actions to achieve its AI objectives, including resources, responsibilities, and timelines.",
    satisfying_actions: ["episode_start", "procedure_capture", "store"],
    min_evidence_count: 2,
  },
  {
    id: "6.9",
    domain: "objectives",
    title: "Change Management Planning",
    description: "The organization shall plan changes to the AI management system in a systematic manner.",
    satisfying_actions: ["store", "learning_store", "procedure_capture"],
    min_evidence_count: 2,
  },
  {
    id: "6.10",
    domain: "objectives",
    title: "Resource Planning",
    description: "The organization shall determine and provide resources needed for the AI management system.",
    satisfying_actions: ["store", "episode_start"],
    min_evidence_count: 1,
  },

  // ── Domain 7: Data Management (5 controls) ───────────────────────────────
  {
    id: "7.1",
    domain: "data_management",
    title: "Data Quality Management",
    description: "The organization shall establish processes to ensure AI training and operational data meets quality requirements.",
    satisfying_actions: ["DATA_CLASSIFICATION", "classify", "store"],
    min_evidence_count: 5,
  },
  {
    id: "7.2",
    domain: "data_management",
    title: "Data Classification and Labeling",
    description: "Data used in AI systems shall be classified according to sensitivity, purpose, and applicable legal requirements.",
    satisfying_actions: ["DATA_CLASSIFICATION", "classify"],
    required_payload_fields: ["sensitivity"],
    min_evidence_count: 10,
  },
  {
    id: "7.3",
    domain: "data_management",
    title: "Data Provenance and Lineage",
    description: "The organization shall maintain records of data provenance and lineage for AI system data.",
    satisfying_actions: ["store", "DATA_CLASSIFICATION", "classify"],
    required_payload_fields: ["project"],
    min_evidence_count: 5,
  },
  {
    id: "7.4",
    domain: "data_management",
    title: "Data Retention and Disposal",
    description: "The organization shall define and implement data retention and secure disposal policies.",
    satisfying_actions: ["expire", "store"],
    min_evidence_count: 3,
  },
  {
    id: "7.5",
    domain: "data_management",
    title: "Data Privacy and Protection",
    description: "The organization shall implement measures to protect personal data processed by AI systems.",
    satisfying_actions: ["DATA_CLASSIFICATION", "classify", "POLICY_DENY", "expire"],
    required_payload_fields: ["sensitivity"],
    min_evidence_count: 5,
  },

  // ── Domain 8: System Lifecycle (5 controls) ──────────────────────────────
  {
    id: "8.1",
    domain: "system_lifecycle",
    title: "AI System Design and Development",
    description: "The organization shall establish processes for the design and development of AI systems.",
    satisfying_actions: ["episode_start", "episode_complete", "procedure_capture"],
    min_evidence_count: 3,
  },
  {
    id: "8.2",
    domain: "system_lifecycle",
    title: "AI System Testing and Validation",
    description: "AI systems shall be tested and validated before deployment and after significant changes.",
    satisfying_actions: ["episode_complete", "benchmark_record"],
    min_evidence_count: 5,
  },
  {
    id: "8.3",
    domain: "system_lifecycle",
    title: "AI System Deployment",
    description: "The organization shall establish controlled processes for deploying AI systems.",
    satisfying_actions: ["episode_start", "episode_complete"],
    min_evidence_count: 2,
  },
  {
    id: "8.4",
    domain: "system_lifecycle",
    title: "AI System Operational Controls",
    description: "The organization shall implement operational controls for AI systems including access control and security measures.",
    satisfying_actions: ["POLICY_DENY", "TRUST_DENY", "classify"],
    min_evidence_count: 5,
  },
  {
    id: "8.5",
    domain: "system_lifecycle",
    title: "AI System Decommissioning",
    description: "The organization shall plan for responsible decommissioning of AI systems including data handling.",
    satisfying_actions: ["expire", "episode_complete"],
    min_evidence_count: 1,
  },

  // ── Domain 8: Impact Assessment (5 controls) ─────────────────────────────
  {
    id: "8.6",
    domain: "impact_assessment",
    title: "AI Impact Assessment Process",
    description: "The organization shall conduct impact assessments for AI systems that may affect individuals or groups.",
    satisfying_actions: ["classify", "TIER_CLASSIFICATION", "DATA_CLASSIFICATION"],
    min_evidence_count: 3,
  },
  {
    id: "8.7",
    domain: "impact_assessment",
    title: "Bias and Fairness Assessment",
    description: "The organization shall assess AI systems for potential biases and implement mitigation measures.",
    satisfying_actions: ["benchmark_record", "classify", "POLICY_DENY"],
    min_evidence_count: 2,
  },
  {
    id: "8.8",
    domain: "impact_assessment",
    title: "Transparency and Explainability",
    description: "The organization shall ensure AI system decisions can be explained and are transparent to affected parties.",
    satisfying_actions: ["recall", "store", "episode_complete"],
    min_evidence_count: 5,
  },
  {
    id: "8.9",
    domain: "impact_assessment",
    title: "Human Oversight Mechanisms",
    description: "The organization shall implement human oversight mechanisms for AI systems, especially high-risk ones.",
    satisfying_actions: ["POLICY_DENY", "TRUST_DENY"],
    min_evidence_count: 3,
  },
  {
    id: "8.10",
    domain: "impact_assessment",
    title: "Stakeholder Impact Communication",
    description: "The organization shall communicate AI impact assessment results to relevant stakeholders.",
    satisfying_actions: ["store", "recall"],
    min_evidence_count: 2,
  },

  // ── Domain 9: Monitoring (5 controls) ────────────────────────────────────
  {
    id: "9.1",
    domain: "monitoring",
    title: "AI System Performance Monitoring",
    description: "The organization shall monitor AI system performance against established metrics and objectives.",
    satisfying_actions: ["benchmark_record", "recall", "episode_complete"],
    min_evidence_count: 10,
  },
  {
    id: "9.2",
    domain: "monitoring",
    title: "Internal Audit",
    description: "The organization shall conduct internal audits at planned intervals to assess AI management system conformity.",
    satisfying_actions: ["recall", "store", "benchmark_record"],
    min_evidence_count: 5,
  },
  {
    id: "9.3",
    domain: "monitoring",
    title: "Management Review",
    description: "Top management shall review the AI management system at planned intervals to ensure its suitability and effectiveness.",
    satisfying_actions: ["recall", "store"],
    min_evidence_count: 3,
  },
  {
    id: "9.4",
    domain: "monitoring",
    title: "Incident Detection and Response",
    description: "The organization shall establish processes to detect, report, and respond to AI system incidents.",
    satisfying_actions: ["POLICY_DENY", "TRUST_DENY", "episode_complete"],
    min_evidence_count: 3,
  },
  {
    id: "9.5",
    domain: "monitoring",
    title: "Compliance Monitoring",
    description: "The organization shall monitor compliance with applicable AI-related legal, regulatory, and contractual requirements.",
    satisfying_actions: ["benchmark_record", "recall", "store", "episode_complete"],
    min_evidence_count: 5,
  },

  // ── Domain 10: Improvement (5 controls) ──────────────────────────────────
  {
    id: "10.1",
    domain: "improvement",
    title: "Nonconformity and Corrective Action",
    description: "The organization shall react to nonconformities, evaluate corrective action needs, and implement changes.",
    satisfying_actions: ["learning_store", "feedback", "procedure_capture"],
    min_evidence_count: 3,
  },
  {
    id: "10.2",
    domain: "improvement",
    title: "Continual Improvement",
    description: "The organization shall continually improve the suitability, adequacy, and effectiveness of the AI management system.",
    satisfying_actions: ["learning_store", "procedure_capture", "trajectory"],
    min_evidence_count: 5,
  },
  {
    id: "10.3",
    domain: "improvement",
    title: "Knowledge Management",
    description: "The organization shall capture, share, and apply knowledge gained from AI system operations.",
    satisfying_actions: ["learning_store", "trajectory", "procedure_capture", "store"],
    min_evidence_count: 5,
  },
  {
    id: "10.4",
    domain: "improvement",
    title: "Feedback Integration",
    description: "The organization shall establish mechanisms to collect and integrate feedback on AI system performance.",
    satisfying_actions: ["feedback", "learning_store"],
    min_evidence_count: 3,
  },
  {
    id: "10.5",
    domain: "improvement",
    title: "Procedural Learning and Optimization",
    description: "The organization shall capture successful procedures and optimize AI system operations based on execution trajectories.",
    satisfying_actions: ["procedure_capture", "trajectory", "learning_store"],
    min_evidence_count: 5,
  },
];

// ─── Gap Recommendation Templates ──────────────────────────────────────────

const GAP_RECOMMENDATIONS: Record<string, string> = {
  // Policy actions
  "store": "Ensure critical decisions and policies are persisted using the memory_store operation with appropriate type and project tags.",
  "policy_update": "Implement and document AI policy updates through the governance framework, ensuring changes trigger policy_update audit events.",
  "recall": "Perform regular knowledge retrieval operations using memory_recall to demonstrate active review of stored policies and information.",

  // Classification actions
  "classify": "Enable the memory governor's classify operation to automatically assess and record sensitivity levels for all stored data.",
  "TIER_CLASSIFICATION": "Configure the tiered memory system to emit TIER_CLASSIFICATION events when memories are promoted or demoted across hot/warm/cold tiers.",
  "DATA_CLASSIFICATION": "Enable DATA_CLASSIFICATION events by configuring the memory governor classify operation to record sensitivity assessments for all incoming data.",

  // Lifecycle actions
  "episode_start": "Use the episode tracking system to record the initiation of AI-related tasks and workflows via episode_start events.",
  "episode_complete": "Ensure all episodes are properly concluded with episode_complete events that include outcome and metrics data.",
  "expire": "Configure TTL-based expiration policies for sensitive data and ensure expire events are generated when data is removed.",

  // Security actions
  "POLICY_DENY": "The governance framework should emit POLICY_DENY events when operations violate configured policies, demonstrating active access control.",
  "TRUST_DENY": "Configure trust boundary enforcement to emit TRUST_DENY events when cross-boundary access is blocked, proving operational security controls.",

  // Performance actions
  "benchmark_record": "Record AI system performance benchmarks regularly using the benchmark tool to generate benchmark_record audit events.",

  // Improvement actions
  "learning_store": "Capture operational learnings and insights using the learning tool to generate learning_store events that demonstrate knowledge retention.",
  "feedback": "Implement feedback collection mechanisms that generate feedback audit events to demonstrate stakeholder input integration.",
  "procedure_capture": "Use the procedure tool to capture successful multi-step workflows, generating procedure_capture events for process documentation.",
  "trajectory": "Record successful execution trajectories using the trajectory tool to demonstrate pattern capture and operational optimization.",
};

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Assess a single control against a set of audit events within a time period.
 */
export function assessControl(
  control: ISO42001Control,
  events: AuditEvent[],
  period_start: string,
  period_end: string,
): ControlEvidence {
  const startMs = new Date(period_start).getTime();
  const endMs = new Date(period_end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new Error(`Invalid date range: period_start=${period_start}, period_end=${period_end}`);
  }

  const matchingEvents = events.filter((event) => {
    // Must match one of the satisfying actions
    if (!control.satisfying_actions.includes(event.action)) {
      return false;
    }

    // Must fall within the period
    const eventMs = new Date(event.timestamp).getTime();
    if (eventMs < startMs || eventMs > endMs) {
      return false;
    }

    // If required payload fields are specified, check them
    if (control.required_payload_fields && control.required_payload_fields.length > 0) {
      const payload = event.details ?? {};
      const hasAllFields = control.required_payload_fields.every(
        (field) => {
          // Check both top-level event properties and details
          if (field === "sensitivity" && event.sensitivity) return true;
          if (field === "project" && event.project) return true;
          return payload[field] !== undefined && payload[field] !== null;
        }
      );
      if (!hasAllFields) {
        return false;
      }
    }

    return true;
  });

  const eventCount = matchingEvents.length;
  const threshold = control.min_evidence_count;
  const halfThreshold = Math.ceil(threshold * 0.5);

  let complianceStatus: "satisfied" | "partial" | "gap";
  if (eventCount >= threshold) {
    complianceStatus = "satisfied";
  } else if (eventCount >= halfThreshold) {
    complianceStatus = "partial";
  } else {
    complianceStatus = "gap";
  }

  // Sample: first 3 matching events
  const sampleEvents = matchingEvents.slice(0, 3);

  const evidence: ControlEvidence = {
    control,
    period_start,
    period_end,
    event_count: eventCount,
    sample_events: sampleEvents,
    compliance_status: complianceStatus,
  };

  if (complianceStatus !== "satisfied") {
    const gapRec = computeGapRecommendation(control, evidence);
    if (gapRec) {
      evidence.gap_recommendation = gapRec.recommendation;
    }
  }

  return evidence;
}

/**
 * Generate a gap recommendation for a control that is not fully satisfied.
 */
export function computeGapRecommendation(
  control: ISO42001Control,
  evidence: ControlEvidence,
): GapRecommendation | null {
  if (evidence.compliance_status === "satisfied") {
    return null;
  }

  // Build a concrete, actionable recommendation based on missing actions
  const actionRecommendations: string[] = [];

  for (const action of control.satisfying_actions) {
    if (GAP_RECOMMENDATIONS[action]) {
      actionRecommendations.push(GAP_RECOMMENDATIONS[action]);
    }
  }

  let recommendation: string;
  if (actionRecommendations.length > 0) {
    // Pick the most relevant recommendation (first satisfying action with a template)
    recommendation = actionRecommendations[0];

    if (evidence.event_count > 0 && evidence.event_count < control.min_evidence_count) {
      recommendation += ` Currently ${evidence.event_count} of ${control.min_evidence_count} required evidence events recorded — increase operational frequency to meet the threshold.`;
    } else if (evidence.event_count === 0) {
      recommendation += ` No evidence events found in the assessment period — immediate action required to establish this control.`;
    }
  } else {
    recommendation = `Implement processes that generate ${control.satisfying_actions.join(", ")} audit events to satisfy control ${control.id} (${control.title}). Target: ${control.min_evidence_count} events per assessment period.`;
  }

  return {
    control_id: control.id,
    control_title: control.title,
    domain: control.domain,
    current_count: evidence.event_count,
    required_count: control.min_evidence_count,
    recommendation,
  };
}

/**
 * Generate a full compliance report for a given time period.
 */
export async function generateComplianceReport(
  opts: { period_start: string; period_end: string; controls?: string[] },
  deps: {
    scrollAuditLog: (
      filter?: Record<string, unknown>,
      limit?: number,
      offset?: string | number,
    ) => Promise<AuditEvent[]>;
  },
): Promise<ComplianceReport> {
  // Build Qdrant filter for the time period so filtering happens server-side.
  // The window is fixed for every page — pagination advances by point id, not by
  // timestamp. A timestamp cursor lost data two ways: `gt: lastTimestamp` dropped
  // every other event sharing that millisecond, and scroll orders by point id
  // rather than timestamp, so the last row of a page is not the page's newest.
  const timeFilter: Record<string, unknown> = {
    must: [
      { key: "timestamp", range: { gte: opts.period_start } },
      { key: "timestamp", range: { lte: opts.period_end } },
    ],
  };

  // Fetch audit events with time filtering and id-cursor pagination
  const PAGE_SIZE = 1000;
  const allEvents: AuditEvent[] = [];
  const seenIds = new Set<string | number>();
  let offset: string | number | undefined;
  for (;;) {
    const batch = await deps.scrollAuditLog(timeFilter, PAGE_SIZE, offset);
    if (batch.length === 0) break;

    let added = 0;
    for (const event of batch) {
      // Qdrant's scroll offset is inclusive, so each page after the first repeats
      // the cursor point.
      if (event.id !== undefined && seenIds.has(event.id)) continue;
      if (event.id !== undefined) seenIds.add(event.id);
      allEvents.push(event);
      added++;
    }

    if (batch.length < PAGE_SIZE) break;

    const nextOffset = batch[batch.length - 1].id;
    // No usable cursor, or the page advanced nothing — stop rather than loop forever.
    if (nextOffset === undefined || nextOffset === offset || added === 0) break;
    offset = nextOffset;
  }

  // Determine which controls to assess
  let controlsToAssess = ISO42001_CONTROLS;
  if (opts.controls && opts.controls.length > 0) {
    const controlIds = new Set(opts.controls);
    controlsToAssess = ISO42001_CONTROLS.filter((c) => controlIds.has(c.id));
  }

  // Assess each control
  const controlResults: ControlEvidence[] = controlsToAssess.map((control) =>
    assessControl(control, allEvents, opts.period_start, opts.period_end)
  );

  // Tally results
  let satisfiedCount = 0;
  let partialCount = 0;
  let gapCount = 0;

  for (const result of controlResults) {
    switch (result.compliance_status) {
      case "satisfied":
        satisfiedCount++;
        break;
      case "partial":
        partialCount++;
        break;
      case "gap":
        gapCount++;
        break;
    }
  }

  // Compliance score: satisfied = 1, partial = 0.5, gap = 0
  const totalControls = controlsToAssess.length;
  const score = totalControls > 0
    ? ((satisfiedCount + partialCount * 0.5) / totalControls) * 100
    : 0;

  // Build gap analysis
  const gapAnalysis: GapRecommendation[] = controlResults
    .filter((r) => r.compliance_status !== "satisfied")
    .map((r) => computeGapRecommendation(r.control, r))
    .filter((g): g is GapRecommendation => g !== null);

  return {
    generated_at: new Date().toISOString(),
    period_start: opts.period_start,
    period_end: opts.period_end,
    total_controls: totalControls,
    satisfied_controls: satisfiedCount,
    partial_controls: partialCount,
    gap_controls: gapCount,
    compliance_score: Math.round(score * 100) / 100,
    controls: controlResults,
    gap_analysis: gapAnalysis,
  };
}

// ─── Output Formatters ──────────────────────────────────────────────────────

/**
 * Escape a field value for RFC 4180 CSV.
 * Fields containing commas, double quotes, or newlines must be enclosed in double quotes.
 * Double quotes within fields are escaped by doubling them.
 */
function csvEscape(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Build an RFC 4180 compliant CSV from a compliance report.
 */
export function buildCSV(report: ComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push([
    "Control ID",
    "Domain",
    "Title",
    "Description",
    "Compliance Status",
    "Event Count",
    "Min Required",
    "Satisfying Actions",
    "Gap Recommendation",
  ].map(csvEscape).join(","));

  // Data rows
  for (const ce of report.controls) {
    lines.push([
      csvEscape(ce.control.id),
      csvEscape(ce.control.domain),
      csvEscape(ce.control.title),
      csvEscape(ce.control.description),
      csvEscape(ce.compliance_status),
      csvEscape(String(ce.event_count)),
      csvEscape(String(ce.control.min_evidence_count)),
      csvEscape(ce.control.satisfying_actions.join("; ")),
      csvEscape(ce.gap_recommendation ?? ""),
    ].join(","));
  }

  return lines.join("\r\n") + "\r\n";
}

/**
 * Build a Markdown report from a compliance report.
 */
export function buildMarkdown(report: ComplianceReport): string {
  const lines: string[] = [];

  // Title
  lines.push("# ISO 42001:2023 Compliance Report");
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| **Report Generated** | ${report.generated_at} |`);
  lines.push(`| **Assessment Period** | ${report.period_start} to ${report.period_end} |`);
  lines.push(`| **Total Controls Assessed** | ${report.total_controls} |`);
  lines.push(`| **Satisfied** | ${report.satisfied_controls} |`);
  lines.push(`| **Partial** | ${report.partial_controls} |`);
  lines.push(`| **Gaps** | ${report.gap_controls} |`);
  lines.push(`| **Compliance Score** | ${report.compliance_score}% |`);
  lines.push("");

  // Score interpretation
  let scoreInterpretation: string;
  if (report.compliance_score >= 80) {
    scoreInterpretation = "The AI management system demonstrates strong alignment with ISO 42001:2023 requirements.";
  } else if (report.compliance_score >= 60) {
    scoreInterpretation = "The AI management system shows moderate compliance. Targeted improvements are needed to address identified gaps.";
  } else if (report.compliance_score >= 40) {
    scoreInterpretation = "Significant compliance gaps exist. A structured remediation plan should be implemented as a priority.";
  } else {
    scoreInterpretation = "Critical compliance deficiencies identified. Immediate action is required to establish foundational AI governance controls.";
  }
  lines.push(`**Assessment:** ${scoreInterpretation}`);
  lines.push("");

  // Summary table
  lines.push("## Controls Summary");
  lines.push("");
  lines.push("| Control | Domain | Title | Status | Evidence |");
  lines.push("|---------|--------|-------|--------|----------|");
  for (const ce of report.controls) {
    const statusIcon =
      ce.compliance_status === "satisfied" ? "Satisfied" :
      ce.compliance_status === "partial" ? "Partial" : "Gap";
    lines.push(
      `| ${ce.control.id} | ${ce.control.domain} | ${ce.control.title} | ${statusIcon} | ${ce.event_count}/${ce.control.min_evidence_count} |`
    );
  }
  lines.push("");

  // Domain-by-domain sections
  const domainOrder: ISO42001Domain[] = [
    "ai_policy", "risk_assessment", "objectives", "data_management",
    "impact_assessment", "system_lifecycle", "monitoring", "improvement",
  ];

  const domainLabels: Record<ISO42001Domain, string> = {
    ai_policy: "Domain 5: AI Policy",
    risk_assessment: "Domain 6: Planning - Risk Assessment",
    objectives: "Domain 6: Planning - Objectives",
    data_management: "Domain 7: Data Management",
    impact_assessment: "Domain 8: Impact Assessment",
    system_lifecycle: "Domain 8: System Lifecycle",
    monitoring: "Domain 9: Performance Evaluation - Monitoring",
    improvement: "Domain 10: Improvement",
  };

  for (const domain of domainOrder) {
    const domainControls = report.controls.filter((ce) => ce.control.domain === domain);
    if (domainControls.length === 0) continue;

    const domainSatisfied = domainControls.filter((c) => c.compliance_status === "satisfied").length;
    const domainTotal = domainControls.length;

    lines.push(`## ${domainLabels[domain]}`);
    lines.push("");
    lines.push(`**Domain Compliance:** ${domainSatisfied}/${domainTotal} controls satisfied`);
    lines.push("");

    for (const ce of domainControls) {
      lines.push(`### ${ce.control.id} - ${ce.control.title}`);
      lines.push("");
      lines.push(`- **Description:** ${ce.control.description}`);
      lines.push(`- **Status:** ${ce.compliance_status.toUpperCase()}`);
      lines.push(`- **Evidence:** ${ce.event_count} events (minimum required: ${ce.control.min_evidence_count})`);
      lines.push(`- **Satisfying Actions:** \`${ce.control.satisfying_actions.join("`, `")}\``);

      if (ce.sample_events.length > 0) {
        lines.push(`- **Sample Events:**`);
        for (const evt of ce.sample_events) {
          lines.push(`  - \`${evt.action}\` at ${evt.timestamp} (session: ${evt.session_id})`);
        }
      }

      if (ce.gap_recommendation) {
        lines.push(`- **Recommendation:** ${ce.gap_recommendation}`);
      }

      lines.push("");
    }
  }

  // Gap Analysis Table
  if (report.gap_analysis.length > 0) {
    lines.push("## Gap Analysis");
    lines.push("");
    lines.push("| Control | Domain | Current | Required | Recommendation |");
    lines.push("|---------|--------|---------|----------|----------------|");

    for (const gap of report.gap_analysis) {
      // Truncate recommendation for table readability
      const truncatedRec = gap.recommendation.length > 120
        ? gap.recommendation.substring(0, 117) + "..."
        : gap.recommendation;
      lines.push(
        `| ${gap.control_id} - ${gap.control_title} | ${gap.domain} | ${gap.current_count} | ${gap.required_count} | ${truncatedRec} |`
      );
    }

    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`*Report generated by ISO 42001 Compliance Automation (REQ-EVO-014)*`);
  lines.push("");

  return lines.join("\n");
}
