interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}
export function SectionHeader({ eyebrow, title, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
