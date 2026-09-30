import { createGlobalStyle } from "antd-style";
import { ConfigProvider, theme as antdTheme } from "antd";
import zhCN from "antd/locale/zh_CN";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { useEffect } from "react";
import DesktopWindowControls from "./components/DesktopWindowControls";
import {
  DesktopChromeProvider,
  useDesktopChrome,
} from "./hooks/useDesktopChrome";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import MainLayout from "./layouts/MainLayout";
import LoginPage from "./pages/Login";
import OidcComplete from "./pages/Login/OidcComplete";
import SetupPage from "./pages/Setup";
import InvitePage from "./pages/Invite";
import AuthGuard from "./components/AuthGuard";
import VoyagestarSpinner from "./components/VoyagestarSpinner";
import { AntdAppProvider } from "./components/AntdAppProvider";
import GlobalErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { AgentProvider } from "./context/AgentContext";
import { LayoutModeProvider } from "./context/LayoutModeContext";
import { VoiceOutputProvider } from "./context/VoiceOutputContext";
import { useIsMobile } from "./hooks/useIsMobile";
import { useUnauthorizedRedirect } from "./hooks/useUnauthorizedRedirect";
import { installDesktopExternalLinks } from "./utils/desktopExternalLinks";
import { brandTokensFor } from "./styles/themePalettes";
import "./styles/theme-vars.css";
import "./styles/layout.css";
import "./styles/form-override.css";
import "./styles/spin-override.css";

const GlobalStyle = createGlobalStyle`
* {
  margin: 0;
  box-sizing: border-box;
}
`;

function ThemedApp() {
  const { isDark, palette, customColor } = useTheme();
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const desktopChrome = useDesktopChrome();
  const brandTokens = brandTokensFor(palette, isDark, customColor);
  // Bundled amis themes paint mist/starfield on <body>; antd surfaces go
  // translucent so the gradient shows through as one continuous surface.
  const isAmis = palette === "amis";
  // Make antd built-ins (Popconfirm OK/Cancel, Modal default footer, Empty,
  // Pagination, DatePicker, Table… ) follow the current UI language.
  // DatePicker month/weekday labels come from dayjs — keep it in sync too.
  const isZh = i18n.language?.toLowerCase().startsWith("zh") ?? false;
  const antdLocale = isZh ? zhCN : enUS;
  dayjs.locale(isZh ? "zh-cn" : "en");

  useUnauthorizedRedirect();

  useEffect(() => installDesktopExternalLinks(), []);

  // Set document title based on current language
  useEffect(() => {
    document.title = t("app.pageTitle");
  }, [t]);

  const themeConfig = {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      borderRadius: 10,
      ...(isMobile
        ? {
            fontSize: 15,
            fontSizeSM: 13,
            fontSizeLG: 17,
            fontSizeXL: 22,
            controlHeight: 36,
          }
        : {}),
      ...(isDark
        ? {
            colorBgBase: "#0f1117",
            colorTextBase: "#e7e7ed",
            colorBgContainer: "#0f1117",
            colorBgElevated: "#1a1c28",
            colorBgLayout: "#0b0d14",
            colorBgSpotlight: "rgba(0, 0, 0, 0.85)",
            colorBgMask: "rgba(5, 5, 8, 0.80)",
            colorBorder: "rgba(255,255,255,0.08)",
            colorBorderSecondary: "rgba(255,255,255,0.05)",
            colorText: "rgba(255, 255, 255, 0.92)",
            colorTextSecondary: "rgba(255, 255, 255, 0.64)",
            colorTextTertiary: "rgba(255, 255, 255, 0.38)",
            colorTextQuaternary: "rgba(255, 255, 255, 0.22)",
            colorFill: "rgba(255, 255, 255, 0.06)",
            colorFillSecondary: "rgba(255, 255, 255, 0.04)",
            colorFillTertiary: "rgba(255, 255, 255, 0.03)",
            colorFillQuaternary: "rgba(255, 255, 255, 0.02)",
            colorBgTextHover: "rgba(255, 255, 255, 0.06)",
            ...(isAmis
              ? {
                  colorBgBase: "#13122a",
                  colorBgContainer: "rgba(19, 18, 42, 0.72)",
                  colorBgElevated: "rgba(24, 23, 52, 0.94)",
                  colorBgLayout: "transparent",
                }
              : {}),
            ...brandTokens,
            boxShadow: "0px 4px 6px 0px rgba(0, 0, 0, 0.3)",
            boxShadowSecondary:
              "0px 12px 24px -16px rgba(0, 0, 0, 0.2), 0px 8px 40px 0px rgba(0, 0, 0, 0.3)",
          }
        : {
            ...(isAmis
              ? {
                  colorBgContainer: "rgba(255, 255, 255, 0.72)",
                  colorBgElevated: "rgba(255, 255, 255, 0.94)",
                  colorBgLayout: "transparent",
                }
              : {}),
            ...brandTokens,
          }),
    },
    components: isDark
      ? {
          Modal: {
            headerBg: isAmis ? "rgba(24, 23, 52, 0.94)" : "#1a1c28",
            contentBg: isAmis ? "rgba(24, 23, 52, 0.94)" : "#1a1c28",
          },
          Input: { colorBgBase: isAmis ? "rgba(10, 12, 30, 0.55)" : "#0f1117" },
          InputNumber: {
            colorBgBase: isAmis ? "rgba(10, 12, 30, 0.55)" : "#0f1117",
          },
          Select: {
            colorBgBase: isAmis ? "rgba(10, 12, 30, 0.55)" : "#0f1117",
            selectorBg: isAmis ? "rgba(10, 12, 30, 0.55)" : "#0f1117",
          },
          DatePicker: {
            colorBgBase: isAmis ? "rgba(10, 12, 30, 0.55)" : "#0f1117",
          },
          Segmented: {
            itemSelectedBg: isAmis ? "rgba(238, 159, 184, 0.2)" : "#1a1c28",
          },
          Card: {
            colorBgContainer: isAmis ? "rgba(19, 18, 42, 0.6)" : "#161822",
          },
          Tooltip: { colorBgSpotlight: "#424242" },
        }
      : isAmis
      ? {
          Modal: {
            headerBg: "rgba(255, 255, 255, 0.9)",
            contentBg: "rgba(255, 255, 255, 0.9)",
          },
          Input: { colorBgBase: "rgba(255, 255, 255, 0.6)" },
          InputNumber: { colorBgBase: "rgba(255, 255, 255, 0.6)" },
          Select: {
            colorBgBase: "rgba(255, 255, 255, 0.6)",
            selectorBg: "rgba(255, 255, 255, 0.6)",
          },
          DatePicker: { colorBgBase: "rgba(255, 255, 255, 0.6)" },
          Segmented: { itemSelectedBg: "rgba(223, 126, 153, 0.16)" },
          Card: { colorBgContainer: "rgba(255, 255, 255, 0.6)" },
        }
      : {},
  };

  return (
    <ConfigProvider
      theme={themeConfig}
      prefixCls="voyagestar"
      locale={antdLocale}
      spin={{ indicator: <VoyagestarSpinner /> }}
    >
      <AntdAppProvider>
        <DesktopChromeProvider value={desktopChrome}>
          {desktopChrome ? (
            <DesktopWindowControls chrome={desktopChrome} />
          ) : null}
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/oidc/complete" element={<OidcComplete />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <AgentProvider>
                    <LayoutModeProvider>
                      <VoiceOutputProvider>
                        <MainLayout />
                      </VoiceOutputProvider>
                    </LayoutModeProvider>
                  </AgentProvider>
                </AuthGuard>
              }
            />
          </Routes>
        </DesktopChromeProvider>
      </AntdAppProvider>
    </ConfigProvider>
  );
}

function App() {
  return (
    // `useTransitions` off: with router transitions on, React keeps the old
    // page mounted while a lazy route chunk downloads and never renders the
    // Suspense fallback, so a nav click looks like it did nothing.
    <BrowserRouter useTransitions={false}>
      <GlobalErrorBoundary>
        <GlobalStyle />
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </GlobalErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
