export function GlassFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="frame">
      <div className="glass">
        <div className="glass-grain" aria-hidden />
        <div className="glass-content">{children}</div>
      </div>
    </div>
  );
}
