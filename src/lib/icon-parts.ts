import type { ReactElement, ReactNode, SVGProps } from "react";
import type { IconType } from "react-icons";

/**
 * The <svg> attributes (viewBox) and children (paths) of a react-icons icon.
 * Icon components render `IconBase`, which reads React context; this calls the
 * component for its props instead, to rebuild the svg where `IconBase` can't
 * be used (satori) or shouldn't be repeated (a <symbol> for long lists).
 */
export function iconParts(Icon: IconType) {
  return (
    Icon({}) as ReactElement<{
      attr: SVGProps<SVGSVGElement>;
      children: ReactNode;
    }>
  ).props;
}
