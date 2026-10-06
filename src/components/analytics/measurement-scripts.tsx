// src/components/analytics/measurement-scripts.tsx
// Loading the measurement tools, but only once the visitor has agreed.
//
// The identifiers come from the database rather than from the build, so
// marketing can add a property without a deployment. Nothing is injected
// until the consent cookie says the matching category was accepted, and if
// the visitor later withdraws consent the script is not loaded again on the
// next page view.

'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

import { CONSENT_CHANGED_EVENT } from '@/components/consent/cookie-banner';
import type { ActiveDestination } from '@/features/analytics/types';
import {
  CONSENT_COOKIE_NAME,
  decodeConsent,
  isConsentCurrent,
  type ConsentDecision,
} from '@/lib/consent/cookie-consent';

export interface MeasurementScriptsProps {
  /** What this page is allowed to load, with the consent each needs. */
  destinations: readonly ActiveDestination[];
}

/**
 * Reads the consent cookie from the browser.
 *
 * @returns The stored decision, or null when there is none.
 */
function readDecision(): ConsentDecision | null {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${CONSENT_COOKIE_NAME}=`));

  if (match === undefined) {
    return null;
  }

  const stored = decodeConsent(decodeURIComponent(match.slice(CONSENT_COOKIE_NAME.length + 1)));

  return isConsentCurrent(stored) ? stored : null;
}

/**
 * Renders the measurement scripts the visitor has agreed to.
 *
 * @param props The destinations this page may load.
 * @returns The scripts, or nothing when consent has not been given.
 */
export function MeasurementScripts({ destinations }: MeasurementScriptsProps) {
  const [decision, setDecision] = useState<ConsentDecision | null>(null);

  useEffect(() => {
    setDecision(readDecision());

    /**
     * Picks the new decision up when the banner writes one.
     *
     * @returns Nothing.
     */
    function onConsentChange(): void {
      setDecision(readDecision());
    }

    window.addEventListener(CONSENT_CHANGED_EVENT, onConsentChange);

    return () => {
      window.removeEventListener(CONSENT_CHANGED_EVENT, onConsentChange);
    };
  }, []);

  if (decision === null) {
    return null;
  }

  const allowed = destinations.filter((destination) => {
    if (destination.consentCategory === 'necessary') {
      return true;
    }

    if (destination.consentCategory === 'marketing') {
      return decision.marketing;
    }

    return decision.analytics;
  });

  if (allowed.length === 0) {
    return null;
  }

  const measurement = allowed.find((entry) => entry.providerKey === 'ga4');
  const container = allowed.find((entry) => entry.providerKey === 'gtm');
  const pixel = allowed.find((entry) => entry.providerKey === 'meta_pixel');
  const clarity = allowed.find((entry) => entry.providerKey === 'clarity');
  const tiktok = allowed.find((entry) => entry.providerKey === 'tiktok');
  const linkedin = allowed.find((entry) => entry.providerKey === 'linkedin');

  return (
    <>
      {measurement === undefined ? null : (
        <>
          <Script
            id="measurement-ga4-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${measurement.publicIdentifier}`}
          />
          <Script id="measurement-ga4-setup" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('consent','default',{ad_storage:'${
              decision.marketing ? 'granted' : 'denied'
            }',analytics_storage:'${
              decision.analytics ? 'granted' : 'denied'
            }'});gtag('config','${measurement.publicIdentifier}',{anonymize_ip:true});`}
          </Script>
        </>
      )}

      {container === undefined ? null : (
        <Script id="measurement-container" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${container.publicIdentifier}');`}
        </Script>
      )}

      {pixel === undefined ? null : (
        <Script id="measurement-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel.publicIdentifier}');fbq('track','PageView');`}
        </Script>
      )}

      {clarity === undefined ? null : (
        <Script id="measurement-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity.publicIdentifier}");`}
        </Script>
      )}

      {tiktok === undefined ? null : (
        <Script id="measurement-tiktok" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=n;var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok.publicIdentifier}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}

      {linkedin === undefined ? null : (
        <Script id="measurement-linkedin" strategy="afterInteractive">
          {`window._linkedin_partner_id="${linkedin.publicIdentifier}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push("${linkedin.publicIdentifier}");(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s);})(window.lintrk);`}
        </Script>
      )}
    </>
  );
}
