import type { AppDatabase } from "../db/client.js";

export interface UsageSummary {
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  errorCount: number;
}

interface UsageSummaryRow {
  request_count: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  error_count: number;
}

export function createUsageService(db: AppDatabase) {
  return {
    getSummary(): UsageSummary {
      const row = db.prepare(`
        select
          count(*) as request_count,
          coalesce(sum(total_input_tokens), 0) as input_tokens,
          coalesce(sum(total_output_tokens), 0) as output_tokens,
          coalesce(sum(total_cost_estimate), 0) as estimated_cost,
          coalesce(sum(case when status = 'failed' then 1 else 0 end), 0) as error_count
        from runs
      `).get<UsageSummaryRow>() ?? {
        request_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost: 0,
        error_count: 0
      };

      return {
        requestCount: row.request_count,
        inputTokens: row.input_tokens,
        outputTokens: row.output_tokens,
        estimatedCost: row.estimated_cost,
        errorCount: row.error_count
      };
    }
  };
}
