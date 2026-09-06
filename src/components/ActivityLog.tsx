import { SectionHeader } from "./SectionHeader";
import type { ActivityItem } from "@/types";

interface ActivityLogProps {
  activity: ActivityItem[];
  isLoading: boolean;
}
export function ActivityLog({ activity, isLoading }: ActivityLogProps) {
  return (
    <section className="panel activity-panel">
      <SectionHeader
        eyebrow="Live process"
        title="Agent activity"
        action={
          <span className="live-label">
            <i />
            Live
          </span>
        }
      />
      <div className="activity-list">
        {activity.length > 0 ? (
          activity.map((item) => (
            <article className="activity-item" key={item.id}>
              <span className={`activity-dot ${item.type}`}>•</span>
              <div>
                <div className="activity-title">
                  <strong>{item.title}</strong>
                  <time>{item.time} UTC</time>
                </div>
                <p>{item.description}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="activity-empty">
            {isLoading
              ? "Waiting for the first market scan…"
              : "No strategy activity is available."}
          </p>
        )}
      </div>
    </section>
  );
}
