import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Text,
} from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import { useSettings } from "../hooks/useSettings";

const isExternalHttpUrl = (url: URL): boolean => {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  return url.origin !== window.location.origin;
};

const openExternalLink = (url: string, inNewTab: boolean): void => {
  if (inNewTab) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(url);
};

export const ExternalLinkGuard = (): JSX.Element => {
  const { settings, setSetting } = useSettings();
  const { t } = useTranslation();
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [trustPendingDomain, setTrustPendingDomain] = useState(false);
  const pendingDomain = useMemo(() => {
    if (!pendingUrl) return "";
    try {
      return new URL(pendingUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  }, [pendingUrl]);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent): void => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.dataset.skipExternalLinkGuard === "true") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (!isExternalHttpUrl(url)) return;
      const domain = url.hostname.toLowerCase();

      event.preventDefault();
      event.stopPropagation();

      if (
        !settings.warnBeforeOpeningExternalLinks ||
        settings.trustedExternalLinkDomains.includes(domain)
      ) {
        openExternalLink(url.href, settings.openExternalLinksInNewTab);
        return;
      }

      setTrustPendingDomain(false);
      setPendingUrl(url.href);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [
    settings.openExternalLinksInNewTab,
    settings.trustedExternalLinkDomains,
    settings.warnBeforeOpeningExternalLinks,
  ]);

  const close = (): void => {
    setPendingUrl(null);
    setTrustPendingDomain(false);
  };

  const rememberPendingDomain = (): void => {
    if (
      trustPendingDomain &&
      pendingDomain &&
      !settings.trustedExternalLinkDomains.includes(pendingDomain)
    ) {
      setSetting("trustedExternalLinkDomains", [...settings.trustedExternalLinkDomains, pendingDomain]);
    }
  };

  return (
    <Dialog open={!!pendingUrl} onOpenChange={(_, data) => { if (!data.open) close(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t("externalLink.title")}</DialogTitle>
          <DialogContent>
            <Text block>{t("externalLink.description")}</Text>
            {pendingUrl ? (
              <Text block size={200} style={{ wordBreak: "break-all", marginTop: "8px" }}>
                {pendingUrl}
              </Text>
            ) : null}
            {pendingDomain ? (
              <>
                <Text block size={200} style={{ marginTop: "8px" }}>
                  {t("externalLink.domain", { domain: pendingDomain })}
                </Text>
                <Checkbox
                  checked={trustPendingDomain}
                  label={t("externalLink.trustDomain")}
                  onChange={(_, data) => setTrustPendingDomain(data.checked === true)}
                  style={{ marginTop: "8px" }}
                />
              </>
            ) : null}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button
              appearance="primary"
              onClick={() => {
                if (!pendingUrl) return;
                const url = pendingUrl;
                rememberPendingDomain();
                close();
                openExternalLink(url, settings.openExternalLinksInNewTab);
              }}
            >
              {t("externalLink.open")}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
