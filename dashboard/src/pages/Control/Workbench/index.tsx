import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FolderOpen, Globe, TerminalSquare } from "lucide-react";
import PageShell from "../../../layouts/PageShell";
import { usePathTabs } from "../../../hooks/usePathTabs";
import { useCurrentUser } from "../../../hooks/useCurrentUser";
import { useAgent } from "../../../context/AgentContext";
import { userCan, userCanAny, PERM } from "../../../utils/permissions";
import { useTheme } from "../../../context/ThemeContext";
import TerminalPage from "../Terminal";
import RemoteBrowserPage from "../RemoteBrowser";
import WorkspaceDrawer from "../../Agent/Workspace/components/WorkspaceDrawer";
import styles from "./index.module.less";

export type WorkbenchTab = "terminal" | "browser" | "files";

const WORKBENCH_TABS = [
  "terminal",
  "browser",
  "files",
] as const satisfies readonly WorkbenchTab[];

const TAB_ICONS = {
  browser: Globe,
  terminal: TerminalSquare,
  files: FolderOpen,
} as const;

interface WorkbenchPageProps {
  /** True when the workbench keep-alive surface is currently shown. */
  isVisible?: boolean;
}

export default function WorkbenchPage({
  isVisible = true,
}: WorkbenchPageProps) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const { activeAgentId } = useAgent();
  const { palette } = useTheme();
  const amis = palette === "amis";
  const isAllowed = useCallback(
    (tab: WorkbenchTab) =>
      tab === "files" ? userCanAny(user, PERM.workbench) : userCan(user, tab),
    [user],
  );
  const defaultTab: WorkbenchTab = userCan(user, "terminal")
    ? "terminal"
    : userCan(user, "browser")
    ? "browser"
    : "files";

  const { activeTab, handleTabChange, isMounted } = usePathTabs({
    basePath: "/workbench",
    tabs: WORKBENCH_TABS,
    storageKey: "voyagestar:workbench:tab",
    defaultTab,
    isAllowed,
  });

  const pathTabs = useMemo(
    () => ({
      value: activeTab,
      onChange: handleTabChange,
      options: WORKBENCH_TABS.filter((value) => isAllowed(value)).map(
        (value) => {
          const Icon = TAB_ICONS[value];
          return {
            value,
            label: t(`workbench.tabs.${value}`),
            icon: amis ? null : <Icon size={14} strokeWidth={2} />,
          };
        },
      ),
    }),
    [activeTab, handleTabChange, isAllowed, t, amis],
  );

  const browserVisible = isVisible && activeTab === "browser";
  const terminalVisible = isVisible && activeTab === "terminal";
  const pageTitle = amis
    ? t("workbench.title")
    : `${t("workbench.title")} / ${t(`workbench.tabs.${activeTab}`)}`;

  return (
    <PageShell
      title={pageTitle}
      subtitle={amis ? undefined : t("workbench.description")}
      fill
      pathTabs={pathTabs}
      tabsBelowTitle={amis}
      contentBare={amis}
    >
      <div className={styles.panels}>
        {isMounted("browser") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "browser" ? "flex" : "none" }}
            aria-hidden={activeTab !== "browser"}
          >
            <RemoteBrowserPage embedded isVisible={browserVisible} />
          </div>
        )}
        {isMounted("terminal") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "terminal" ? "flex" : "none" }}
            aria-hidden={activeTab !== "terminal"}
          >
            <TerminalPage embedded isVisible={terminalVisible} />
          </div>
        )}
        {isMounted("files") && (
          <div
            className={styles.panel}
            style={{ display: activeTab === "files" ? "flex" : "none" }}
            aria-hidden={activeTab !== "files"}
          >
            {activeAgentId ? (
              <WorkspaceDrawer embedded agentId={activeAgentId} />
            ) : null}
          </div>
        )}
      </div>
    </PageShell>
  );
}
