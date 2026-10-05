import { getSkinDef, type ActiveSkin } from "../lib/skins";

interface Props {
  children: React.ReactNode;
  skin?: ActiveSkin;
}

export function GlassFrame({ children, skin = "none" }: Props) {
  const def = getSkinDef(skin);

  return (
    <div className={`frame ${skin !== "none" ? "has-skin" : ""}`} data-skin={skin}>
      {def?.decor && (
        <img className="skin-decor" src={def.decor} alt="" aria-hidden draggable={false} />
      )}
      <div className="glass">
        <div className="glass-grain" aria-hidden />
        <div className="glass-content">{children}</div>
      </div>
    </div>
  );
}
