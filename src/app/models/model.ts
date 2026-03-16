export interface TabItem {
  item: string;
  label: string;
  title?: string;
  description?: string;
  badge?: string;
  displayLabel?: string;
  badgeLabel?: string;
}

export type Tab = TabItem[];
