// src/content/legal/privacy-policy.ts
// What personal information the platform holds, why it holds it, who it is
// shared with and what a person can ask for.

import { BRAND } from '@/config/brand';
import type { LegalDocument } from '@/content/legal/types';

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy policy',
  summary: `How ${BRAND.name} handles personal information: what we collect, why we collect it, how long we keep it and the choices you have.`,
  version: '2026-01-01',
  effectiveDate: '2026-01-01',
  sections: [
    {
      id: 'roles',
      heading: '1. Two different roles',
      paragraphs: [
        'When you open an account with us, we decide how your account information is used, so for that information we are the controller.',
        'When you store details about your own clients in the service, you decide what is stored and why, so for that information you are the controller and we act on your instructions as processor. This policy explains both roles and tells you which part applies where.',
      ],
    },
    {
      id: 'what-we-collect',
      heading: '2. What we collect',
      paragraphs: ['We collect only what the service needs in order to work and to stay safe.'],
      bullets: [
        'Account details: name, business name, email address, telephone number, country, time zone and the password hash, never the password itself.',
        'Identity documents, when you ask to collect payments and we are required to verify who you are.',
        'Billing details: the plan you are on, invoices we issue to you, and the last four digits and expiry of a card held by our payment provider.',
        'Content you create: invoices, clients, products, expenses, files and messages.',
        'Technical records: address of the device, hashed before storage, browser identification, pages viewed, and the time of each action in the audit trail.',
        'Support messages you send us, and our replies.',
      ],
    },
    {
      id: 'why',
      heading: '3. Why we use it, and on what basis',
      paragraphs: [
        'We use account and content information to provide the service you asked for, which is the performance of our contract with you.',
        'We use technical records, rate limits and audit entries to keep accounts safe and to detect abuse, which is our legitimate interest and, in places, a legal duty.',
        'We use identity and transaction records to meet obligations under financial crime, tax and accounting law.',
        'We send product and marketing messages only where you have agreed, and every one of them carries a one click unsubscribe.',
      ],
    },
    {
      id: 'sharing',
      heading: '4. Who we share it with',
      paragraphs: [
        'We do not sell personal information, and we never share it for someone else to advertise to you.',
        'We share it with the suppliers who make the service work, each bound by a contract that limits them to our instructions.',
      ],
      bullets: [
        'Hosting and database: the infrastructure that runs the application and stores your data.',
        'Global payout partners and the licensed local payment partners you connect, for the transactions you route through them.',
        'Email and messaging providers, so a document or notification can be delivered.',
        'Error monitoring and analytics, where analytics runs only after you have agreed to it.',
        'Professional advisers, and public authorities where the law compels disclosure.',
      ],
    },
    {
      id: 'transfers',
      heading: '5. International transfers',
      paragraphs: [
        'Our suppliers may process information in a country other than yours. Where that country is not recognised as providing equivalent protection, the transfer is covered by standard contractual clauses and by technical measures such as encryption in transit and at rest.',
      ],
    },
    {
      id: 'retention',
      heading: '6. How long we keep it',
      paragraphs: [
        'We keep account and content information for as long as your account is open. After closure it stays available for export for thirty days and is then deleted.',
        'Financial records, invoices and the audit trail are kept for the period accounting and tax law requires, which is commonly seven years, even where other information has been deleted.',
        'Technical records are kept for a shorter period, normally no more than twelve months.',
      ],
    },
    {
      id: 'security',
      heading: '7. How we protect it',
      paragraphs: [
        'Each business is separated at the database level, so one customer cannot reach another customer data. Credentials such as gateway keys and mail passwords are encrypted before they are stored, and addresses are hashed rather than kept in the clear.',
        'Access by our own staff is limited to the few people who need it, is logged, and in sensitive areas requires a second person to approve. Backups run daily and restores are tested.',
        'If a breach affects you, we will tell you and the relevant authority within the time the law allows, and we will tell you what happened and what to do.',
      ],
    },
    {
      id: 'your-rights',
      heading: '8. Your rights',
      paragraphs: [
        'Depending on where you live, you may ask us to give you a copy of your information, correct it, delete it, limit how we use it, or object to a particular use. You may also withdraw consent at any time where we relied on it.',
        `You can export or delete your account data yourself from the privacy page in settings, or write to ${BRAND.supportEmail}. We answer within thirty days and we do not charge for a reasonable request.`,
        'If a request concerns information a business stored about you as its client, we will pass it to that business, because the choice is theirs to make.',
        'You may also complain to the data protection authority in your country.',
      ],
    },
    {
      id: 'cookies',
      heading: '9. Cookies',
      paragraphs: [
        'We set the few cookies the service cannot work without, and nothing else until you agree. Analytics and marketing tags load only after consent, and you can change your answer at any time from the cookie settings link in the footer. The cookie policy lists each cookie and what it does.',
      ],
    },
    {
      id: 'children',
      heading: '10. Children',
      paragraphs: [
        'The service is for business use and is not directed at children. We do not knowingly collect information from anyone under sixteen, and we delete it if we learn that we have.',
      ],
    },
    {
      id: 'changes',
      heading: '11. Changes to this policy',
      paragraphs: [
        'We will publish any new version here with a new effective date, and we will tell account owners by email before a material change takes effect.',
      ],
    },
    {
      id: 'contact',
      heading: '12. Contact',
      paragraphs: [
        `Write to ${BRAND.supportEmail} with any question about this policy or about how your information is handled, and a person will answer.`,
      ],
    },
  ],
};
