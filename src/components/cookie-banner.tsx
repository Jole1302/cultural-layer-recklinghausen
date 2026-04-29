'use client';
import { useEffect } from 'react';
import 'vanilla-cookieconsent/dist/cookieconsent.css';

export function CookieBanner() {
  useEffect(() => {
    let active = true;
    (async () => {
      const mod = await import('vanilla-cookieconsent');
      // vanilla-cookieconsent 3.x is published as CJS; the ESM interop puts
      // the API on `.default`. Bridge through unknown because the TS module
      // types don't expose `.default`, but at runtime that's where `run` lives.
      const CC = (((mod as unknown) as { default: typeof mod }).default ?? mod) as typeof mod;
      if (!active) return;
      await CC.run({
        guiOptions: {
          consentModal: { layout: 'box', position: 'bottom right' },
          preferencesModal: { layout: 'box' },
        },
        categories: {
          necessary: { enabled: true, readOnly: true },
        },
        language: {
          default: 'de',
          translations: {
            de: {
              consentModal: {
                title: 'Wir respektieren deine Privatsphäre',
                description:
                  'Diese Seite verwendet ausschließlich technisch notwendige Cookies (Session-Login). Keine Tracking-Cookies, keine Analytics.',
                acceptAllBtn: 'Verstanden',
                showPreferencesBtn: 'Einstellungen',
              },
              preferencesModal: {
                title: 'Cookie-Einstellungen',
                acceptAllBtn: 'Alle akzeptieren',
                savePreferencesBtn: 'Auswahl speichern',
                closeIconLabel: 'Schließen',
                sections: [
                  {
                    title: 'Technisch notwendig',
                    description: 'Erforderlich für Login und Session-Management.',
                    linkedCategory: 'necessary',
                  },
                ],
              },
            },
          },
        },
      });
    })();
    return () => {
      active = false;
    };
  }, []);
  return null;
}
