"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadLanguage, saveLanguage, translateText, type Language } from "../lib/i18n";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const translatableAttributes = ["placeholder", "title", "aria-label"] as const;
const ignoredTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");
  const languageRef = useRef<Language>("zh");
  const originalText = useRef(new WeakMap<Text, string>());
  const lastRenderedText = useRef(new WeakMap<Text, string>());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedLanguage = loadLanguage();
      setLanguageState(storedLanguage);
      languageRef.current = storedLanguage;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const setLanguage = useCallback((nextLanguage: Language) => {
    languageRef.current = nextLanguage;
    setLanguageState(nextLanguage);
    saveLanguage(nextLanguage);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(languageRef.current === "zh" ? "en" : "zh");
  }, [setLanguage]);

  const t = useCallback((text: string) => translateText(text, language), [language]);

  useEffect(() => {
    languageRef.current = language;
    document.documentElement.lang = language === "en" ? "en" : "zh-Hant";
    document.documentElement.dataset.language = language;
  }, [language]);

  useEffect(() => {
    const translateTextNode = (node: Text) => {
      const parent = node.parentElement;
      if (!parent || ignoredTags.has(parent.tagName) || parent.closest("[data-zg-no-translate]")) return;

      const current = node.nodeValue || "";
      const last = lastRenderedText.current.get(node);
      if (!originalText.current.has(node) || (last !== undefined && current !== last)) {
        originalText.current.set(node, current);
      }

      const original = originalText.current.get(node) || current;
      const translated = translateText(original, language);
      lastRenderedText.current.set(node, translated);
      if (current !== translated) node.nodeValue = translated;
    };

    const translateElementAttributes = (element: Element) => {
      if (ignoredTags.has(element.tagName) || element.closest("[data-zg-no-translate]")) return;

      translatableAttributes.forEach((attribute) => {
        const current = element.getAttribute(attribute);
        if (!current) return;

        const originalKey = `data-zg-original-${attribute}`;
        const lastKey = `data-zg-last-${attribute}`;
        const original = element.getAttribute(originalKey);
        const last = element.getAttribute(lastKey);
        const nextOriginal = !original || (last !== null && current !== last) ? current : original;
        element.setAttribute(originalKey, nextOriginal);

        const translated = translateText(nextOriginal, language);
        element.setAttribute(attribute, translated);
        element.setAttribute(lastKey, translated);
      });
    };

    const applyTranslations = () => {
      if (!document.body) return;

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        translateTextNode(node as Text);
        node = walker.nextNode();
      }

      document.body.querySelectorAll("[placeholder], [title], [aria-label]").forEach(translateElementAttributes);
    };

    let frame = 0;
    const scheduleTranslations = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyTranslations);
    };

    applyTranslations();

    const observer = new MutationObserver(scheduleTranslations);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [...translatableAttributes],
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [language]);

  useEffect(() => {
    const clipboard = navigator.clipboard as (Clipboard & { __zgOriginalWriteText?: Clipboard["writeText"] }) | undefined;
    if (!clipboard?.writeText || clipboard.__zgOriginalWriteText) return;

    clipboard.__zgOriginalWriteText = clipboard.writeText.bind(clipboard);
    clipboard.writeText = async (text: string) => clipboard.__zgOriginalWriteText?.(translateText(text, languageRef.current));
  }, []);

  const value = useMemo<LanguageContextValue>(() => ({ language, setLanguage, toggleLanguage, t }), [language, setLanguage, t, toggleLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
