import type { MonitoringBreadcrumb } from './types.js';

export class BreadcrumbBuffer {
  private readonly items: MonitoringBreadcrumb[] = [];
  private readonly maxItems: number;
  private readonly maxDataChars: number;

  constructor(maxItems: number, maxDataChars: number) {
    this.maxItems = maxItems;
    this.maxDataChars = maxDataChars;
  }

  add(entry: Omit<MonitoringBreadcrumb, 't'> & { t?: string }): void {
    const t = entry.t ?? new Date().toISOString();
    let data = entry.data;
    if (data !== undefined) {
      const s = JSON.stringify(data);
      if (s.length > this.maxDataChars) {
        data = { _truncated: true, preview: s.slice(0, this.maxDataChars) };
      }
    }
    const row: MonitoringBreadcrumb = { t, category: entry.category, message: entry.message };
    if (data !== undefined) row.data = data;
    this.items.push(row);
    while (this.items.length > this.maxItems) {
      this.items.shift();
    }
  }

  snapshot(): MonitoringBreadcrumb[] {
    return [...this.items];
  }

  clear(): void {
    this.items.length = 0;
  }
}
