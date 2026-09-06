import type { BacktestExecutionConfig } from "@/types/backtesting";
export const backtestExecutionConfig:Readonly<BacktestExecutionConfig>={feePercentPerSide:.10,slippagePercent:.05,collisionPolicy:"STOP_FIRST"};
