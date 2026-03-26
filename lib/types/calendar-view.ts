export type ViewMode = "day" | "week" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface ViewState {
  mode: ViewMode;
  currentDate: Date;
  customRange?: DateRange;
}
