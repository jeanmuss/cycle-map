import { useEffect, useState } from "react";

import { getInitialLanguage, TRANSLATIONS } from "./AppShared.jsx";

export function RouteRuntime({ PageComponent, metadata }) {
  const [language, setLanguage] = useState(getInitialLanguage);
  const t = TRANSLATIONS[language];

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    const pageMetadata = metadata(t);
    document.title = pageMetadata.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", pageMetadata.description);
    try {
      window.localStorage.setItem("cycle-map-language", language);
    } catch {
      // Language persistence is optional.
    }
  }, [language, metadata, t]);

  return <PageComponent language={language} setLanguage={setLanguage} t={t} />;
}
