// src/content/legal/terms-of-service.ts
// The agreement between the business running this platform and the customer
// who uses it. Written to be read, not to be skipped.

import { BRAND } from '@/config/brand';
import type { LegalDocument } from '@/content/legal/types';

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of service',
  summary: `The agreement that applies when you use ${BRAND.name}. It explains what we provide, what we charge, what you are responsible for and how either side may end the agreement.`,
  version: '2026-01-01',
  effectiveDate: '2026-01-01',
  sections: [
    {
      id: 'agreement',
      heading: '1. The agreement',
      paragraphs: [
        `These terms form an agreement between ${BRAND.legalName} ("we", "us") and the person or organisation that opens an account ("you"). By creating an account, or by using the service after a change to these terms takes effect, you accept them.`,
        'If you accept these terms for an organisation, you confirm that you are allowed to bind that organisation. In that case "you" means the organisation.',
      ],
    },
    {
      id: 'service',
      heading: '2. What we provide',
      paragraphs: [
        'We provide software for issuing invoices, collecting payments, managing clients and keeping the records that follow from those activities. We provide it as a hosted service, reached through a browser and through our documented interface.',
        'We improve the service continuously. We may add, change or withdraw a feature. If we withdraw a feature you depend on, we will give you reasonable notice and, where we can, a way to export what that feature held.',
      ],
    },
    {
      id: 'accounts',
      heading: '3. Your account',
      paragraphs: [
        'You are responsible for everything done through your account. Keep your password private, switch on two step verification, and remove access for people who leave your organisation.',
        'You must give accurate registration details, including a working email address, and keep them up to date. We may ask you to confirm your identity or your business before enabling payment collection, and we may decline or suspend an account where that confirmation is refused or fails.',
      ],
      bullets: [
        'One person must not share one login with others; invite them instead.',
        'Tell us promptly if you believe an account has been used without permission.',
        'You must be old enough to enter a contract in your country.',
      ],
    },
    {
      id: 'acceptable-use',
      heading: '4. Acceptable use',
      paragraphs: [
        'The service exists so legitimate businesses can be paid for legitimate work. You must not use it for anything unlawful, deceptive or harmful.',
      ],
      bullets: [
        'Do not invoice for goods or services that are illegal where you or your client are.',
        'Do not send unsolicited bulk messages, or messages to people who have asked you to stop.',
        'Do not attempt to reach data belonging to another customer, or to probe, scan or overload the service.',
        'Do not resell or white label the service except under a reseller agreement with us.',
        'Do not upload material that infringes someone else, or that contains malicious code.',
      ],
    },
    {
      id: 'your-data',
      heading: '5. Your data',
      paragraphs: [
        'Everything you put into the service remains yours. You grant us only the permission needed to host it, display it to the people you authorise, back it up and support you.',
        'You decide what personal information about your clients you store, and you are responsible for having a lawful basis to store it. We process that information on your behalf, as described in our privacy policy.',
        'You can export your data at any time while your account is active, and for thirty days after it closes.',
      ],
    },
    {
      id: 'payments-to-you',
      heading: '6. Payments you collect',
      paragraphs: [
        'Where you connect your own payment gateway, your contract for that processing is with the gateway and its terms apply to those funds.',
        'Where we collect on your behalf as merchant of record, we show the fee for each transaction before it is taken, hold the balance in your platform wallet and pay it out on the schedule published in your account. We may hold a payout where a dispute, a refund risk or a legal obligation requires it, and we will tell you why.',
        'You remain responsible for delivering what you invoice for, for the accuracy of the tax you charge and for answering a dispute with the evidence the scheme requires.',
      ],
    },
    {
      id: 'fees',
      heading: '7. Subscription fees',
      paragraphs: [
        'Plan prices are shown on the pricing page. A paid plan renews automatically at the end of each period until it is cancelled. Cancelling stops the next renewal; it does not refund the period already paid for.',
        'A free trial is free until it ends. We tell you before the first charge. If a payment fails we retry it over several days and tell you each time, and we move the account to the free plan if it is not resolved.',
        'We may change prices. An existing subscription keeps its price until the next renewal after we have given at least thirty days notice.',
      ],
    },
    {
      id: 'availability',
      heading: '8. Availability and support',
      paragraphs: [
        'We aim for the service to be available at all times and we publish planned maintenance in advance. We cannot promise it will never be interrupted, and we are not liable for an interruption caused by something outside our reasonable control.',
        `Support is included on every plan, including the free plan. Write to ${BRAND.supportEmail} and a person answers.`,
      ],
    },
    {
      id: 'suspension',
      heading: '9. Suspension and termination',
      paragraphs: [
        'You may close your account at any time from the settings page. We may suspend or close an account that breaks these terms, that is used to defraud someone, or where we are required by law to do so.',
        'Where the cause can be fixed, we will tell you what the problem is and give you a reasonable chance to fix it before we close anything. On closure, we keep your data available for export for thirty days and then delete it, except where a law requires us to keep a record for longer.',
      ],
    },
    {
      id: 'liability',
      heading: '10. Liability',
      paragraphs: [
        'Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence or for fraud.',
        'Subject to that, neither side is liable for indirect or consequential loss, nor for lost profit, lost revenue or lost data arising from the use of the service. Our total liability in any twelve month period is limited to the subscription fees you paid us in that period.',
        'The service is a tool for recording and collecting money; it is not legal, accounting or tax advice. You remain responsible for your own filings.',
      ],
    },
    {
      id: 'changes',
      heading: '11. Changes to these terms',
      paragraphs: [
        'We may update these terms. We will publish the new version here with a new effective date, and for a material change we will tell account owners by email at least thirty days before it applies. Continuing to use the service after that date means you accept the new version.',
      ],
    },
    {
      id: 'contact',
      heading: '12. Contact',
      paragraphs: [
        `Questions about these terms can be sent to ${BRAND.supportEmail}, and we answer every message. Any notice we must give you is sent to the email address on the account.`,
      ],
    },
  ],
};
