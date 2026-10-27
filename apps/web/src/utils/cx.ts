// Une clases de Tailwind ignorando las vacias: cx("a", condicion && "b").
export const cx = (...clases: (string | false | null | undefined)[]) => clases.filter(Boolean).join(" ");
