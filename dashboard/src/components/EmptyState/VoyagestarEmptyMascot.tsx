import { VOYAGESTAR_EMPTY_MASCOT_SRC } from "../../assets/mascot";
import styles from "./EmptyState.module.less";

interface VoyagestarEmptyMascotProps {
  className?: string;
  /** Square edge in px; default 160. */
  size?: number;
}

/**
 * Voyagestar empty-state mascot image with shared sizing.
 * Use inside custom empty UIs or pass as ``EmptyState`` icon /
 * antd ``Empty`` ``image``.
 */
export function VoyagestarEmptyMascot({
  className,
  size = 160,
}: VoyagestarEmptyMascotProps) {
  return (
    <img
      src={VOYAGESTAR_EMPTY_MASCOT_SRC}
      alt=""
      draggable={false}
      className={className ? `${styles.mascot} ${className}` : styles.mascot}
      style={size === 160 ? undefined : { width: size, height: size }}
    />
  );
}
