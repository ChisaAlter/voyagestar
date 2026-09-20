import { useTranslation } from "react-i18next";
import { VoyagestarEmptyMascot } from "../../../components/EmptyState";
import styles from "./index.module.less";

/** Placeholder marketplace tab — under construction. */
export function PluginMarketPanel() {
  const { t } = useTranslation();
  return (
    <div className={styles.marketEmpty}>
      <VoyagestarEmptyMascot size={180} />
      <div className={styles.emptyTitle}>{t("plugins.marketTitle")}</div>
      <div className={styles.emptyHint}>{t("plugins.marketHint")}</div>
    </div>
  );
}
