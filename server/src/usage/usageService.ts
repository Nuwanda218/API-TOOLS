import type { AppDatabase, AppNamedParams } from "../db/client.js";

export type UsageRange = "today" | "7d" | "30d" | "all";

export interface UsageFilters {
  range: UsageRange;
  providerId?: string;
  modelId?: string;
}

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number | null;
}

export interface UsageGroupRow {
  id: string | null;
  name: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number | null;
}

export interface UsageTrendPoint {
  date: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
  averageLatencyMs: number | null;
}

export interface UsageStepRow {
  id: string;
  runId: string;
  createdAt: string;
  status: "running" | "succeeded" | "failed";
  stepType: string;
  providerName: string | null;
  modelName: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costEstimate: number | null;
  latencyMs: number | null;
  errorCode: string | null;
}

export interface UsageDashboard {
  summary: UsageSummary;
  filters: UsageFilters;
  byProvider: UsageGroupRow[];
  byModel: UsageGroupRow[];
  trend: UsageTrendPoint[];
  recentSteps: UsageStepRow[];
}

interface SummaryRow {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  error_count: number;
  average_latency_ms: number | null;
}

interface GroupRow {
  id: string | null;
  name: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  error_count: number;
  average_latency_ms: number | null;
}

interface TrendRow {
  date: string;
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  error_count: number;
  average_latency_ms: number | null;
}

interface StepRow {
  id: string;
  run_id: string;
  created_at: string;
  status: "running" | "succeeded" | "failed";
  step_type: string;
  provider_name: string | null;
  model_name: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_estimate: number | null;
  latency_ms: number | null;
  error_code: string | null;
}

function rangeToFromDate(range: UsageRange): string | null {
  if (range === "all") return null;

  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }

  const days = range === "7d" ? 7 : 30;
  now.setDate(now.getDate() - days);
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function buildWhereClause(filters: UsageFilters): { where: string; params: AppNamedParams } {
  const conditions: string[] = [];
  const params: AppNamedParams = {};
  const fromDate = rangeToFromDate(filters.range);

  if (fromDate) {
    conditions.push("run_steps.created_at >= @fromDate");
    params.fromDate = fromDate;
  }

  if (filters.providerId) {
    conditions.push("run_steps.provider_id = @providerId");
    params.providerId = filters.providerId;
  }

  if (filters.modelId) {
    conditions.push("run_steps.model_id = @modelId");
    params.modelId = filters.modelId;
  }

  return {
    where: conditions.length > 0 ? `where ${conditions.join(" and ")}` : "",
    params
  };
}

export function createUsageService(db: AppDatabase) {
  return {
    getSummary(filters: UsageFilters = { range: "all" }): UsageSummary {
      const { where, params } = buildWhereClause(filters);
      const row = db.prepare(`
        select
          count(*) as request_count,
          coalesce(sum(input_tokens), 0) as input_tokens,
          coalesce(sum(output_tokens), 0) as output_tokens,
          coalesce(sum(cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when status = 'failed' then 1 else 0 end), 0) as error_count,
          round(avg(case when latency_ms is not null then latency_ms else null end)) as average_latency_ms
        from run_steps
        ${where}
      `).get<SummaryRow>(params) ?? {
        request_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost: 0,
        error_count: 0,
        average_latency_ms: null
      };

      return {
        requestCount: row.request_count,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        estimatedCost: row.estimated_cost,
        errorCount: row.error_count,
        averageLatencyMs: row.average_latency_ms
      };
    },

    getGroupedByProvider(filters: UsageFilters = { range: "all" }): UsageGroupRow[] {
      const { where, params } = buildWhereClause(filters);
      const rows = db.prepare(`
        select
          run_steps.provider_id as id,
          coalesce(providers.name, 'Unknown') as name,
          count(*) as request_count,
          coalesce(sum(run_steps.input_tokens), 0) as input_tokens,
          coalesce(sum(run_steps.output_tokens), 0) as output_tokens,
          coalesce(sum(run_steps.cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when run_steps.status = 'failed' then 1 else 0 end), 0) as error_count,
          round(avg(case when run_steps.latency_ms is not null then run_steps.latency_ms else null end)) as average_latency_ms
        from run_steps
        left join providers on providers.id = run_steps.provider_id
        ${where}
        group by run_steps.provider_id
        order by estimated_cost desc
      `).all<GroupRow>(params);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        requestCount: r.request_count,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        totalTokens: r.input_tokens + r.output_tokens,
        estimatedCost: r.estimated_cost,
        errorCount: r.error_count,
        averageLatencyMs: r.average_latency_ms
      }));
    },

    getGroupedByModel(filters: UsageFilters = { range: "all" }): UsageGroupRow[] {
      const { where, params } = buildWhereClause(filters);
      const rows = db.prepare(`
        select
          run_steps.model_id as id,
          coalesce(models.display_name, 'No model') as name,
          count(*) as request_count,
          coalesce(sum(run_steps.input_tokens), 0) as input_tokens,
          coalesce(sum(run_steps.output_tokens), 0) as output_tokens,
          coalesce(sum(run_steps.cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when run_steps.status = 'failed' then 1 else 0 end), 0) as error_count,
          round(avg(case when run_steps.latency_ms is not null then run_steps.latency_ms else null end)) as average_latency_ms
        from run_steps
        left join models on models.id = run_steps.model_id
        ${where}
        group by run_steps.model_id
        order by estimated_cost desc
      `).all<GroupRow>(params);

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        requestCount: r.request_count,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        totalTokens: r.input_tokens + r.output_tokens,
        estimatedCost: r.estimated_cost,
        errorCount: r.error_count,
        averageLatencyMs: r.average_latency_ms
      }));
    },

    getTrend(filters: UsageFilters = { range: "all" }): UsageTrendPoint[] {
      const { where, params } = buildWhereClause(filters);
      const rows = db.prepare(`
        select
          date(run_steps.created_at) as date,
          count(*) as request_count,
          coalesce(sum(run_steps.input_tokens), 0) as input_tokens,
          coalesce(sum(run_steps.output_tokens), 0) as output_tokens,
          coalesce(sum(run_steps.cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when run_steps.status = 'failed' then 1 else 0 end), 0) as error_count,
          round(avg(case when run_steps.latency_ms is not null then run_steps.latency_ms else null end)) as average_latency_ms
        from run_steps
        ${where}
        group by date(run_steps.created_at)
        order by date asc
      `).all<TrendRow>(params);

      return rows.map((r) => ({
        date: r.date,
        requestCount: r.request_count,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        estimatedCost: r.estimated_cost,
        errorCount: r.error_count,
        averageLatencyMs: r.average_latency_ms
      }));
    },

    getRecentSteps(filters: UsageFilters = { range: "all" }, limit: number = 30): UsageStepRow[] {
      const { where, params } = buildWhereClause(filters);
      const rows = db.prepare(`
        select
          run_steps.id,
          run_steps.run_id,
          run_steps.created_at,
          run_steps.status,
          run_steps.step_type,
          providers.name as provider_name,
          models.display_name as model_name,
          run_steps.input_tokens,
          run_steps.output_tokens,
          run_steps.cost_estimate,
          run_steps.latency_ms,
          run_steps.error_code
        from run_steps
        left join providers on providers.id = run_steps.provider_id
        left join models on models.id = run_steps.model_id
        ${where}
        order by run_steps.created_at desc
        limit @limit
      `).all<StepRow>({ ...params, limit });

      return rows.map((r) => ({
        id: r.id,
        runId: r.run_id,
        createdAt: r.created_at,
        status: r.status,
        stepType: r.step_type,
        providerName: r.provider_name,
        modelName: r.model_name,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        costEstimate: r.cost_estimate,
        latencyMs: r.latency_ms,
        errorCode: r.error_code
      }));
    },

    getDashboard(filters: UsageFilters = { range: "all" }): UsageDashboard {
      return {
        summary: this.getSummary(filters),
        filters,
        byProvider: this.getGroupedByProvider(filters),
        byModel: this.getGroupedByModel(filters),
        trend: this.getTrend(filters),
        recentSteps: this.getRecentSteps(filters)
      };
    }
  };
}
