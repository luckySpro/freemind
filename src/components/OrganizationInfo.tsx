import { version } from "../../package.json";
import { t } from "../i18n";

/** Product ownership is separate from the upstream Apache copyright and attribution. */
export function OrganizationInfo() {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7 }}>
      <div>FreeMind {version}</div>
      <div>
        {t("updates.organization")}: <strong>M&amp;J Group</strong>
      </div>
      <div>
        {t("updates.contact")}: <a href="mailto:473276@qq.com">473276@qq.com</a>
      </div>
    </div>
  );
}
