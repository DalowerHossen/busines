// src/features/marketing/actions/save-cookie-consent.ts
// Stores what a visitor agreed to. The cookie is written first, so the answer
// is honoured even if the database cannot be reached, and the decision is then
// recorded so it can be proved later.

'use server';

import { createAction } from '@/lib/actions/create-action';
import { CONSENT_POLICY_VERSION, type ConsentDecision } from '@/lib/consent/cookie-consent';
import {
  createVisitorToken,
  readVisitorToken,
  writeConsentCookies,
} from '@/lib/consent/server-consent';
import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { consentDecisionSchema } from '@/features/marketing/validation/contact';

export interface SaveCookieConsentResult {
  /** The decision as it will now be applied. */
  decision: ConsentDecision;
}

export const saveCookieConsent = createAction(
  consentDecisionSchema,
  async (input): Promise<SaveCookieConsentResult> => {
    const decision: ConsentDecision = {
      necessary: true,
      analytics: input.analytics,
      marketing: input.marketing,
      preferences: input.preferences,
      version: CONSENT_POLICY_VERSION,
    };

    const visitorToken = readVisitorToken() ?? createVisitorToken();
    writeConsentCookies(decision, visitorToken);

    try {
      const context = getRequestContext();
      const supabase = getServiceSupabaseClient();
      const { error } = await supabase.rpc('record_cookie_consent', {
        p_visitor_token: visitorToken,
        p_analytics: decision.analytics,
        p_marketing: decision.marketing,
        p_preferences: decision.preferences,
        p_policy_version: decision.version,
        p_ip_hash: context.ipHash,
        p_user_agent: context.userAgent,
        p_country_code: null,
      });

      if (error) {
        throw error;
      }
    } catch (caught) {
      logger.error('A cookie consent could not be stored', caught, {
        action: 'saveCookieConsent',
      });
    }

    return { decision };
  },
  { name: 'saveCookieConsent' }
);
