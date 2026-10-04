<!-- docs/PRODUCT_REQUIREMENTS.md -->
# KD SOLUTION IT — Canonical Product Requirements Catalogue

**Status:** Approved product scope baseline  
**Market:** Asia-first service; platform billing currency defaults to USD  
**Language rule:** Product UI, database seed data, emails, error messages, code comments, and operational documentation are English-only.  
**Purpose:** This catalogue consolidates the supplied requirements into one implementation source of truth. A requirement is not dropped simply because it belongs to a future delivery phase.

## Catalogue governance

- Requirements are grouped by stable section and source identifier so delivery tickets, tests, architecture decisions, and release notes can trace back to this document.
- The source reused `164–172` after its original Deploy & Operations section. This catalogue resolves that collision by placing Deploy & Operations after the extended feature catalogue, while preserving the stated feature names.
- The source has one intentional unnumbered gap at `557` between tenant isolation and payment-evidence controls. No product requirement was supplied for that identifier.
- The source specifies four final account roles but later proposes reseller and accountant roles. Both requirements are retained in **Role model and reconciliation**; the authorization model must be explicitly approved before schema implementation.
- The source calls the EE module collection “102” requirements in the `1235–1336` range, while its ten stated group totals add to 112. All stated EE capabilities are retained; its canonical numeric allocation must be resolved in a planning ADR rather than silently omitting capabilities.

## Product-wide constraints and approved architecture

1. Operate as a multi-tenant platform with strict company isolation and USD as the platform default currency for Asian markets.
2. Generate invoices and dispute evidence PDFs server-side with React-PDF.
3. Use a Supabase table as the initial rate-limit store behind an adapter that can later use Upstash Redis.
4. Use Cloudflare Turnstile for privacy-friendly CAPTCHA protection.
5. Use Supabase `pg_cron` plus a database-backed queue for background work that exceeds serverless limits.
6. Upload files directly from browser to Supabase Storage through signed uploads, avoiding serverless upload payload limits.
7. Deliver time tracking, projects, and service-business billing in the current scope.
8. Use a platform-account MoR model with a first-class wallet and payout system; retain hooks for Stripe Connect.
9. Deliver QuickBooks, Zoho, and Wave import workflows in the current scope.
10. Optimise ordinary images in-browser to AVIF/WebP, strip EXIF/GPS data, produce thumbnail/medium/full variants, and deliver responsive `srcset` variants.
11. Compress PDFs with font subsetting, image downsampling at 150–200 DPI, and object-stream compression while preserving print quality.
12. Preserve OCR-readable KYC and scan quality with a quality-preserving, near-lossless mode.
13. Compress CSV/JSON exports with gzip or Brotli and package bulk exports as ZIP archives.
14. Reject video and audio uploads because they are outside this product scope.

---

# A. Brand and design system (1–14)

1. Apply KD SOLUTION IT platform branding.
2. Build a custom design system.
3. Provide a branded sidebar and top bar.
4. Provide a reusable logo component and favicon.
5. Use instant CSS-variable branding.
6. Define and enforce a z-index scale.
7. Support responsive layouts from 320px through 1920px.
8. Make every touch target at least 44px.
9. Provide hover and transition micro-interactions.
10. Provide a toast-notification system.
11. Provide SVG empty-state illustrations.
12. Provide branded loading skeletons.
13. Provide print stylesheets for invoices and reports.
14. Provide a dark/light theme toggle.

# B. Public site, fully CMS-editable (15–31)

15. Publish a homepage hero with calls to action.
16. Show product screenshot previews.
17. Publish a feature-grid section.
18. Publish a pricing-preview section.
19. Publish a testimonials section.
20. Publish a FAQ teaser and dedicated FAQ page.
21. Provide company links in the footer.
22. Publish an About page.
23. Publish a Contact page with ticket fallback.
24. Publish Terms page content.
25. Publish Privacy page content.
26. Publish Refund page content.
27. Publish a problem-solving guide page.
28. Display `support@kdsolutionit.com`.
29. Provide SEO metadata and OpenGraph metadata.
30. Generate `sitemap.xml` and `robots.txt`.
31. Provide branded 404 and application error pages.

# C. Authentication (32–40)

32. Use Supabase email/password authentication.
33. Provide branded authentication screen panels.
34. Support the email-verification flow.
35. Support forgotten-password and password-reset flows.
36. Provide a password-strength indicator.
37. Send authentication mail through custom SMTP.
38. Redirect users by approved account role.
39. Protect routes with middleware.
40. Refresh sessions securely.

# D. Onboarding and company profile (41–48)

41. Allow plan selection at sign-up.
42. Preselect the Free plan.
43. Provide a company-onboarding wizard.
44. Automatically populate a CompanyProvider context.
45. Freeze a historical company-profile snapshot for each document.
46. Configure invoice prefixes.
47. Support multiple currencies.
48. Apply a changed company logo only to newly created invoices.

# E. Dashboard (49–54)

49. Show revenue-overview cards.
50. Show due and outstanding summaries.
51. Show a recent-invoices list.
52. Show revenue charts with Recharts.
53. Provide quick-action shortcuts.
54. Provide global search.

# F. Clients / CRM (55–60)

55. Provide client CRUD operations.
56. Provide an inline new-client dialog.
57. Provide client search and filtering.
58. Provide a client-activity timeline.
59. Provide client statements.
60. Import and export clients as CSV.

# G. Products and services (61–64)

61. Provide product/service CRUD operations.
62. Provide a product search dropdown.
63. Add new items inline.
64. Configure prices and tax settings.

# H. Core invoicing (65–81)

65. Create, edit, and delete invoices.
66. Duplicate invoices.
67. Support dynamic line items.
68. Calculate discounts and taxes.
69. Use decimal-safe monetary calculations.
70. Number invoices automatically.
71. Support draft, sent, viewed, paid, and overdue statuses.
72. Provide a public invoice tracker at `/i/[token]`.
73. Generate invoice QR codes.
74. Download PDFs using the frozen logo and company snapshot.
75. Send invoices to clients by email.
76. Show an invoice timeline feed.
77. Support external notes and internal notes.
78. Support payment terms and due dates.
79. Support partial payments.
80. Support bulk actions.
81. Support invoice attachments.

# I. Estimates and other documents (82–86)

82. Provide estimate CRUD operations.
83. Convert an estimate to an invoice.
84. Provide public estimate approval.
85. Provide credit notes.
86. Generate recurring invoices through scheduled work.

# J. Payments (87–96)

87. Integrate Stripe.
88. Integrate PayPal.
89. Integrate Paddle.
90. Support manual and bank payments.
91. Support tenant-owned gateway keys.
92. Require terms opt-in for the platform gateway.
93. Verify webhooks against raw request bodies.
94. Make webhook handling idempotent and rate-limited.
95. Generate payment receipts.
96. Handle refunds.

# K. Reports (97–105)

97. Provide sales reports.
98. Provide expense reports.
99. Provide client reports.
100. Provide tax-summary reports.
101. Report VAT input/output and net payable.
102. Show a TOTAL row in every report.
103. Filter reports by period and date.
104. Export every report as CSV.
105. Export every report as PDF.

# L. Team and KYC (106–113)

106. Invite team members through pending-to-active lifecycle states.
107. Provide roles and permissions.
108. Remove members.
109. Upload KYC ID-front documents.
110. Upload KYC ID-back documents.
111. Validate files at 5MB maximum and accept images/PDFs only.
112. Preview uploaded documents.
113. Provide manual administrator KYC review.

# M. Tenant settings (114–122)

114. Edit company-profile settings.
115. Upload a logo.
116. Edit branding settings.
117. Store gateway keys with AES-256 encryption.
118. Add a custom domain.
119. Verify domains.
120. Upgrade billing/subscriptions.
121. Create a one-click JSON backup.
122. Manage notification preferences.

# N. Super administration (123–145)

123. Provide an admin overview.
124. Manage users with search and filters.
125. Manually verify users.
126. Suspend and activate users.
127. Soft-delete users.
128. Prevent self-change escalation.
129. Provide plan CRUD with reserved `free` slug handling.
130. Correct plan-edit type coercion.
131. Edit and synchronise subscriptions.
132. Manage coupons.
133. Configure platform fees.
134. Process payouts.
135. Approve or reject KYC review.
136. Configure payment gateways.
137. Provide revenue analytics.
138. Provide an audit-log viewer.
139. Provide CMS editing for all public pages.
140. Manage email templates.
141. Provide a support-ticket inbox.
142. Control platform branding.
143. Provide system settings and SMTP configuration.
144. Save SMTP configurations with blank passwords without destroying stored credentials.
145. Provide maintenance mode.

# O. Email engine (146–153)

146. Centralise delivery in a `sendPlatformMail` function.
147. Support Resend SMTP over TLS port 587.
148. Send welcome mail.
149. Send invoice and estimate mail.
150. Send status and reminder mail.
151. Send subscription mail.
152. Log email failures without failing the originating business action.
153. Use branded email headers.

# P. Security and data foundations (154–163)

154. Scope all tenant data by `company_id`.
155. Enforce Supabase RLS policies.
156. Soft-delete with `deleted_at`.
157. Record audit logs throughout the platform.
158. Encrypt secrets with AES-256.
159. Sanitize rich text.
160. Validate on client and server with Zod.
161. Use database transactions and rollback behavior.
162. Rate-limit sensitive operations.
163. Keep server-only environment variables out of client bundles.

---

# P2. WhatsApp automation (164–170)

164. Provide a Meta Cloud API client.
165. Manage WhatsApp templates.
166. Send invoices through WhatsApp.
167. Support event-driven automation rules.
168. Run bulk campaigns.
169. Track delivery and read status.
170. Receive WhatsApp inbound webhooks.

# P3. QR business cards (171–177)

171. Provide a QR-card builder.
172. Generate vCard QR codes.
173. Customize card designs.
174. Provide public share URLs.
175. Verify cards online.
176. Display verified badges.
177. Report QR scan analytics.

# P4. Ecommerce integration (178–185)

178. Connect Shopify stores.
179. Connect WooCommerce stores.
180. Encrypt store API keys.
181. Synchronize order webhooks.
182. Convert orders to invoices automatically.
183. Email automatically generated invoices.
184. Keep sync logs and retry failed synchronizations.
185. Map store products to platform products.

# P5. Inventory and warehouse (186–192)

186. Track stock levels.
187. Support multiple warehouses.
188. Maintain a stock-movement ledger.
189. Reduce stock automatically when invoices are issued.
190. Alert on low stock.
191. Adjust stock levels.
192. Support product bundles.

# P6. Suppliers and purchasing (193–197)

193. Provide supplier CRUD operations.
194. Create purchase orders.
195. Receive purchase orders into stock.
196. Record supplier bills.
197. Track payables.

# P7. Expenses and accounting (198–207)

198. Provide expense CRUD operations.
199. Manage expense categories.
200. Support recurring expenses.
201. Upload expense receipts.
202. Provide a chart of accounts.
203. Post double-entry journals.
204. Produce profit and loss statements.
205. Produce balance sheets.
206. Produce cash-flow statements.
207. Import bank CSV files.

# P8. Virtual wallet and Merchant of Record (208–219)

208. Provide Merchant of Record mode.
209. Gate MoR access on verified KYC.
210. Require an own gateway when KYC is not verified.
211. Show virtual-wallet balances.
212. Maintain a wallet-transaction ledger.
213. Deduct platform fees.
214. Hold funds for 7–14 days.
215. Release holds with a scheduled job.
216. Request payouts.
217. Support bank, bKash, and Nagad payouts.
218. Handle chargebacks.
219. Process 3DS OTP flows.

# P9. Affiliate programme (220–225)

220. Register affiliates.
221. Provide referral tracking links.
222. Calculate commissions.
223. Provide an affiliate dashboard.
224. Request commission payouts.
225. Approve affiliates in administration.

# P10. Public API and webhooks (226–235)

226. Provide a RESTful v1 API.
227. Generate and revoke API keys.
228. Scope API permissions.
229. Rate-limit API requests.
230. Log API use.
231. Register outgoing webhook endpoints.
232. Subscribe endpoints to events.
233. Use HMAC signing secrets.
234. Retry and log deliveries.
235. Publish API documentation.

# P11. Client Access — tokenized, no account (236–242)

236. Do not create a separate client-login account type.
237. Replace magic-link account access with signed token links that require no account.
238. Show a client’s document list on token-authorized public pages.
239. Complete online payment through token links without a client account.
240. Download receipts through token links without a client account.
241. Show payment history through token links without a client account.
242. Approve estimates through token links without a client account.

# P12. Blog and status (243–249)

243. Publish blog lists and details.
244. Provide a super-admin blog editor.
245. Support draft, publish, and scheduled publishing.
246. Manage cover images and SEO.
247. Manage categories and tags.
248. Publish an uptime status page.
249. Manage incidents.

# P13. Per-tenant branding (250–256)

250. Support a tenant-owned logo.
251. Support tenant-owned colors and fonts.
252. Autofill tenant branding on invoices.
253. Brand PDF headers and footers.
254. Brand client-facing emails.
255. Brand portals and public pages.
256. Provide live branding previews.

# P14. American-style professional invoices (257–271)

257. Provide a US invoice layout.
258. Meet Amazon-acceptable invoice formatting expectations.
259. Show Bill To and Ship To blocks.
260. Show invoice number, date, and terms.
261. Show quantity × unit price × amount.
262. Preserve sharp decimal unit prices.
263. Configure decimal precision.
264. Show subtotal, tax, shipping, and total.
265. Render amount in words.
266. Show Remit To and bank information.
267. Support Tax ID and EIN fields.
268. Support purchase-order number references.
269. Show terms and conditions blocks.
270. Support multiple layout templates.
271. Produce print-perfect A4 and Letter output.

# P15. Account security (272–277)

272. Require TOTP two-factor authentication for account holders.
273. Provide QR setup and backup codes.
274. Provide two-factor recovery.
275. Support Google OAuth login.
276. Support GitHub OAuth login.
277. Manage active sessions.

# P16. GDPR and compliance (278–282)

278. Receive and process data-export requests.
279. Receive and process account-deletion requests.
280. Manage consent.
281. Provide a cookie banner.
282. Apply a data-retention policy.

# P17. Monitoring and testing (283–289)

283. Integrate Sentry error monitoring.
284. Trace performance.
285. Provide Vitest unit tests.
286. Provide integration tests.
287. Provide Playwright end-to-end tests.
288. Run GitHub Actions CI.
289. Provide a health-check endpoint.

# P18. Hosting flexibility (290–295)

290. Support Docker self-hosting.
291. Provide development and production docker-compose configurations.
292. Provide Nginx reverse proxy and SSL configuration.
293. Provide a VPS deployment guide.
294. Produce Vercel-compatible builds.
295. Support DNS pointing from any domain.

---

# R1. Trials, plan limits, and monetisation (296–306)

296. Offer a 14-day free trial.
297. Automatically downgrade trials to Free.
298. Never lock a tenant out after downgrade.
299. Enforce plan limits.
300. Show usage meters and quota bars.
301. Show an upgrade prompt when a limit is reached.
302. Redeem coupons during checkout.
303. Prorate upgrades and downgrades.
304. Run failed-payment dunning.
305. Send renewal reminder email.
306. Offer a no-login free invoice generator.

# R2. Notifications and realtime (307–313)

307. Provide an in-app notification center.
308. Show a notification bell and unread count.
309. Use Supabase Realtime updates.
310. Process email through a queue.
311. Handle bounces and complaints.
312. Manage unsubscribe preferences.
313. Record email and WhatsApp opt-in consent.

# R3. Billing lifecycle (314–324)

314. Schedule payment reminders.
315. Calculate late fees automatically.
316. Support instalments and payment plans.
317. Provide debit notes.
318. Provide pro forma invoices.
319. Provide advance/deposit invoices.
320. Maintain client credit balances.
321. Write off bad debt.
322. Use separate number series for estimates, credit notes, and purchase orders.
323. Automatically update exchange rates.
324. Display multi-currency conversions.

# R4. Tax and compliance (325–331)

325. Manage tax rates.
326. Support compound and multiple taxes.
327. Support US state sales tax.
328. Store VAT/GST numbers.
329. Mark tax-exempt clients.
330. Configure fiscal years.
331. Configure rounding rules.

# R5. Expanded reports (332–338)

332. Provide accounts-receivable aging reports.
333. Provide accounts-payable aging reports.
334. Report sales by product.
335. Report profit by client.
336. Report inventory valuation and COGS.
337. Schedule emailed reports.
338. Save filter presets.

# R6. Expanded inventory (339–343)

339. Transfer stock between warehouses.
340. Support SKUs and barcodes.
341. Process sales returns/RMAs.
342. Process purchase returns.
343. Produce packing slips and delivery notes.

# R7. Team, permissions, and multi-company (344–349)

344. Provide a granular permission matrix.
345. Maintain company activity logs.
346. Provide a multi-company switcher.
347. Tag and group clients.
348. Configure timezone and date formats.
349. Run expense-approval flows.

# R8. Super-admin expansion (350–357)

350. Support user impersonation.
351. Publish announcements.
352. Export audit logs.
353. Monitor storage quotas.
354. Send broadcast emails.
355. Publish a changelog page.
356. Provide a platform-health dashboard.
357. Accept tenant support-ticket submissions.

# R9. Navigation and UX integrity (358–369)

358. Maintain a central navigation map.
359. Show breadcrumbs everywhere.
360. Highlight active navigation states.
361. Provide a mobile drawer and bottom navigation.
362. Provide a command palette using Command/Control-K.
363. Support keyboard shortcuts.
364. Audit for zero dead links.
365. Keep back/cancel behavior consistent.
366. Provide an onboarding checklist and tour.
367. Meet WCAG accessibility requirements and show focus rings.
368. Use error boundaries with retry actions.
369. Standardise confirmation-dialog patterns.

# R10. Security hardening (370–375)

370. Protect against CSRF.
371. Use security headers and a Content Security Policy.
372. Lock out brute-force attempts.
373. Alert on suspicious logins.
374. Validate upload magic bytes.
375. Provide suspended and rate-limit pages.

# R11. Performance and SEO (376–381)

376. Use ISR/revalidation caching.
377. Code-split and lazy-load where appropriate.
378. Optimise images.
379. Publish JSON-LD structured data.
380. Provide a PWA manifest.
381. Gate analytics by consent.

# R12. Developer experience (382–385)

382. Provide an API playground.
383. Provide webhook test/ping tools.
384. Provide sandbox/test mode.
385. Provide demo seed data.

# R13. Additional scheduled work (386–389)

386. Schedule session cleanup.
387. Schedule database backups.
388. Schedule data deletion.
389. Schedule estimate expiration processing.

# S1. Pluggable payment-gateway framework (390–401)

390. Integrate NMI.
391. Support NMI Three-Step Redirect.
392. Support NMI Direct Post.
393. Support NMI tokenization.
394. Support NMI recurring billing.
395. Build a pluggable gateway-adapter interface.
396. Allow administrators to add custom gateways.
397. Use JSON-driven gateway configuration schemas.
398. Enable/disable gateways.
399. Support gateway sandbox/test mode.
400. Report gateway health and error logs.
401. Define default gateway priority.

# S2. Local payments: bKash and Nagad (402–408)

402. Accept bKash payments.
403. Accept Nagad payments.
404. Support bKash and Nagad payouts.
405. Provide a super-admin global toggle.
406. Provide tenant-level toggles.
407. Verify transactions manually.
408. Show gateways according to country.

# S3. English-only interface (409–411)

409. Enforce an English-only UI policy.
410. Add a Bengali-detection lint guard.
411. Use a central strings file.

# S4. Tenant-to-client subscription billing (412–419)

412. Create client subscription plans.
413. Charge recurring billing automatically.
414. Store saved-card tokens on client records and obtain consent through mandate links.
415. Capture autopay authorization.
416. Pause, resume, and cancel subscriptions.
417. Calculate proration.
418. Retry failed charges.
419. Report subscription MRR.

# S5. Payment experience (420–426)

420. Provide standalone payment links.
421. Provide a hosted checkout page.
422. Support partial refunds.
423. Allocate payments across multiple invoices.
424. Apply surcharges or convenience fees.
425. Email receipts automatically.
426. Support Apple Pay and Google Pay.

# S6. MoR risk and settlement (427–440)

427. Provide a merchant-onboarding flow.
428. Capture versioned MoR agreement acceptance.
429. Score risk.
430. Enforce velocity and limit rules.
431. Raise fraud alerts.
432. Screen AML and sanctions.
433. Monitor transactions.
434. Produce settlement reports.
435. Show payout schedules and fees.
436. Upload chargeback evidence.
437. Maintain dispute timelines.
438. Recover negative balances.
439. Remain PCI-safe by never storing card data.
440. Provide a reconciliation dashboard.

# S7. Document integrity and workflow (441–450)

441. Lock sent invoices as immutable.
442. Keep revision history.
443. Run invoice approval workflows.
444. Autosave drafts.
445. Detect duplicates.
446. Provide trash and restore UI.
447. Reset document numbers annually when configured.
448. Support electronic signatures for estimate approval.
449. Send bulk email.
450. Track email opens.

# S8. Support and help (451–456)

451. Publish a help center with search.
452. Provide an in-app help widget.
453. Support ticket priorities and SLAs.
454. Provide canned responses.
455. Convert email to tickets.
456. Collect NPS and feedback.

# S9. Marketing and growth (457–464)

457. Run a customer referral programme.
458. Collect newsletter signups.
459. Provide lead-capture forms.
460. Offer demo/contact-sales flows.
461. Track UTM campaigns.
462. Publish an integration-directory page.
463. Publish a partners page.
464. Publish press and brand-kit resources.

# S10. Legal and trust (465–474)

465. Display company legal information in the footer.
466. Publish a security page.
467. Publish a DPA page.
468. Publish a subprocessor list.
469. Publish a cookie policy.
470. Publish an accessibility statement.
471. Publish `security.txt`.
472. Version terms and log acceptance.
473. Generate platform-subscription invoices and receipts.
474. Generate SaaS VAT/tax invoices.

# S11. Platform engineering (475–482)

475. Provide a background-job queue.
476. Provide an asynchronous export center.
477. Monitor scheduled work and alert on failure.
478. Provide feature flags.
479. Manage configuration and secrets.
480. Retain and archive data.
481. Version database migrations.
482. Provide uptime-monitoring hooks.

---

# Role model and access-model reconciliation

The supplied final account model defines these four operational account roles:

| Role | Intended holder | Access boundary |
| --- | --- | --- |
| `super_admin` | KD SOLUTION IT platform operator | Entire platform, every tenant, MoR, KYC, and CMS |
| `owner` | A customer company owner | All resources for their own company: billing, gateways, staff, and KYC |
| `staff` | An employee invited by an owner | Only the granular permissions granted by the owner |
| `affiliate` | Referral partner | Referral dashboard only |

Client users never receive an account role. They interact using signed, expiring public links. The supplied future scope also calls for **reseller** and **accountant** access. Preserve those capabilities, but resolve whether they are additional account roles, constrained staff presets, or delegated access types before authorization tables are finalised.

## Confirmed client-access changes

- Separate client login is cancelled.
- Magic-link access is replaced by signed token links without accounts.
- Client invoice lists become token-authorised public pages.
- Client payments, receipts, payment history, and estimate approvals occur through token links without login.
- Two-factor authentication applies only to account holders, not token-link visitors.
- Saved-card tokens live on the client record and consent is taken through a mandate link.
- The former “Client Portal” is renamed **Client Access (tokenized)**.

# T1. Tokenized client access, no login (483–494)

483. Create HMAC-signed access tokens.
484. Give every document a unique link.
485. Configure token expiration.
486. Revoke and reissue tokens.
487. Optionally protect a link with email OTP.
488. Provide a client-hub link for all client invoices.
489. Log link opens and document views.
490. Audit IP address and user agent.
491. Rate-limit token access and guard against brute force.
492. Block search-engine indexing.
493. Provide an expired-link re-request page.
494. Render a branded, client-facing shell.

# T2. Client email journey, the primary channel (495–502)

495. Send invoice mail containing the access link.
496. Send estimate-approval links.
497. Send payment-reminder links.
498. Send receipt and confirmation mail.
499. Send subscription-mandate links.
500. Send statements by email.
501. Record delivery status for every email.
502. Provide resend and copy-link actions.

# T3. Staff and work-based email routing (503–509)

503. Send staff-invitation emails.
504. Provide Sales, Accounts, and Support staff permission presets.
505. Send assignment notifications.
506. Create action-based email rules.
507. Maintain staff-specific activity logs.
508. Enforce plan-based staff-seat limits.
509. Deactivate staff while retaining historical data.

# T4. KYC-conditioned gateway routing (510–516)

510. Require an own gateway by default.
511. Unlock MoR after KYC verification.
512. Configure MoR terms and limits.
513. Override fees per merchant.
514. Use gateway fallback chains.
515. Let the payer choose a method at checkout.
516. Suspend MoR access when risk requires it.

# U1. Blind affiliate role (517–523)

517. Limit affiliates to their own referral account.
518. Hide referred company names from affiliates.
519. Hide referred-company activity from affiliates.
520. Show only click and signup counts.
521. Show only commissions and payout data.
522. Expose no invoice or client data.
523. Enforce dedicated affiliate RLS policies.

# U2. Owner-only email sending (524–527)

524. Allow only owners to send external email.
525. Allow staff to create drafts but not send them.
526. Provide a request-send approval workflow.
527. Hide send controls from unauthorised staff.

# U3. Batch and bulk sending (528–535)

528. Select multiple invoices.
529. Queue batch sends.
530. Show batch progress bars.
531. Show successful and failed results per email.
532. Retry failed emails.
533. Schedule batch sends.
534. Guard against duplicate sends.
535. Keep batch-history logs.

# U4. Sent-versus-paid summary dashboard (536–547)

536. Count total sent invoices.
537. Count paid invoices.
538. Count unpaid invoices.
539. Count overdue invoices.
540. Count viewed invoices.
541. Count failed emails.
542. Compare total billed money to collected money.
543. Calculate collection rate.
544. Show average payment time in days.
545. Show batch-based performance.
546. Filter by date range.
547. Allow drill-down to underlying lists.

# U5. Strict tenant isolation (548–556)

548. Prevent one owner from seeing another owner’s data.
549. Require `company_id` on every tenant query.
550. Use default-deny RLS policies.
551. Return 404 for cross-tenant identifiers.
552. Isolate storage paths by tenant.
553. Apply tenant scope even to shared tables.
554. Run automated isolation tests.
555. Apply tenant guards to search and export.
556. Allow global views only to `super_admin`.

# V1. Pre-payment consent evidence (558–568)

558. Require consent checkboxes.
559. Require confirmation that goods/services were received.
560. Require confirmation that the invoice details were read.
561. Record versioned terms acceptance snapshots.
562. Record refund-policy acceptance.
563. Disable Pay until required checkboxes are checked.
564. Record consent time in UTC.
565. Record IP address and geolocation.
566. Record device and user-agent fingerprints.
567. Store the exact consent text presented.
568. Store immutable consent records.

# V2. Delivery and acceptance evidence (569–576)

569. Capture delivery-confirmation fields.
570. Capture work-completion/acceptance acknowledgement.
571. Offer an optional client electronic signature.
572. Store estimate-approval evidence.
573. Let owners upload delivery evidence.
574. Store tracking numbers.
575. Store service-completion dates.
576. Provide a client acceptance-link confirmation.

# V3. Tamper-evident audit chain (577–585)

577. Record email-send evidence with message IDs.
578. Record email-delivery receipts.
579. Record invoice-open/view timestamps.
580. Log IP address for every view.
581. Log payment-page visits.
582. Maintain a complete event timeline.
583. Use a tamper-proof hash-chained audit trail.
584. Store invoice-PDF hashes.
585. Store a rendered snapshot of the consent screen state.

# V4. One-click dispute evidence pack (586–593)

586. Provide a Generate Evidence Pack action.
587. Build a PDF containing invoice, consent, and timeline.
588. Produce gateway-ready evidence formats for Stripe and PayPal.
589. Render consent as screenshot-like evidence.
590. Include email-thread evidence.
591. Include delivery evidence.
592. Download or send the evidence pack.
593. Maintain a file for every dispute case.

# V5. Dispute prevention (594–603)

594. Show a clear statement descriptor.
595. Send instant receipt emails.
596. Put the owner’s contact information on receipts.
597. Display a “Contact seller first” message.
598. Display refund policy before payment.
599. Provide a direct refund-request link.
600. Provide a rapid owner refund tool.
601. Alert on high-risk transactions.
602. Flag unusual amounts.
603. Run new-client velocity checks.

# V6. Legal and financial protection (604–609)

604. Store payment authorisation records.
605. Calculate chargeback reserves.
606. Monitor dispute rate below 0.65%.
607. Alert on high-rate merchants.
608. Retain evidence for 18 months.
609. Provide a super-admin dispute center.

# W. Design and navigation standards (610–645)

## W1. Layout architecture (610–620)

610. Use a fixed left application sidebar.
611. Use a 264px expanded sidebar and 72px collapsed sidebar.
612. Use a 64px sticky top bar.
613. Center standard content in a 1280px maximum-width container.
614. Center form-led pages in a 768px maximum-width container.
615. Use a centered auth card with a brand panel.
616. Use full-width public sections with centered inner containers.
617. Use a standard page header with title, breadcrumb, and actions.
618. Place the primary action on the right.
619. Use a consistent 4/8/12/16/24/32 spacing scale.
620. Use a 12-column grid with 24px gaps.

## W2. Navigation integrity (621–630)

621. Maintain one central nav-map file.
622. Register every route in the nav map.
623. Generate breadcrumbs from the nav map.
624. Highlight active and parent-active routes.
625. Filter menus by role.
626. Validate every link at build time.
627. Provide a zero-dead-link audit script.
628. Keep back/cancel behavior consistent.
629. Use Sheet-based mobile drawer navigation.
630. Standardise tab navigation for settings and details.

## W3. Complete page states (631–638)

631. Give every page a loading skeleton.
632. Give every page an error state with retry.
633. Give every page an empty state with CTA.
634. Give every page a success state.
635. Prevent blank white screens.
636. Do not ship “Coming soon” pages.
637. Give every table pagination, sorting, and filtering.
638. Give every form inline validation and a disabled submit state when invalid.

## W4. Complete English content (639–645)

639. Use real copy on every page rather than filler text.
640. Write every button, label, and tooltip.
641. Write every error and success message.
642. Write complete content for every email template.
643. Provide real legal content on every CMS legal page.
644. Block Bengali text in code with linting.
645. Keep UI, database seeds, and comments entirely English.

# X. Mobile-first standards (646–670)

646. Use mobile-first CSS.
647. Test breakpoints at 320, 375, 430, 768, 1024, 1280, and 1920px.
648. Provide hamburger navigation with a sliding drawer.
649. Provide a five-item primary bottom navigation.
650. Support iOS safe-area insets.
651. Transform tables into card lists on mobile.
652. Keep the first column sticky during horizontal scrolling.
653. Use full-screen Sheet dialogs on mobile.
654. Provide a sticky bottom action bar in forms.
655. Keep touch targets at least 44×44px.
656. Place actions in thumb-friendly zones.
657. Use appropriate numeric and email input keyboard types.
658. Use at least 16px input text to prevent iOS zoom.
659. Use a stepper for mobile invoice forms.
660. Support list-item swipe actions.
661. Support pull-to-refresh.
662. Optimise charts for mobile.
663. Provide mobile PDF preview.
664. Optimise the mobile payment page for Apple Pay and Google Pay.
665. Show an offline-detection banner.
666. Lazy-load images with responsive `srcset`.
667. Prioritise mobile loading for LCP below 2.5 seconds.
668. Respect reduced-motion settings.
669. Handle landscape mode.
670. Test every page at 320px.

# Y1. Secret and key management (671–680)

671. Create a key-vault abstraction layer.
672. Never rotate `ENCRYPTION_KEY`.
673. Support rotation of other keys.
674. Tag encrypted fields with key versions.
675. Keep Supabase service role server-only.
676. Scan client bundles for secret leaks.
677. Validate environment schema at boot.
678. Fail fast when required environment values are missing.
679. Use distinct keys per environment.
680. Audit secret access.

# Y2. Application security (681–697)

681. Guard against IDOR with ownership checks.
682. Prevent SQL injection with parameterised queries.
683. Guard against SSRF for webhook and ecommerce URLs.
684. Encode output to prevent XSS.
685. Use nonce-based CSP.
686. Prevent clickjacking with `frame-ancestors`.
687. Use strict CORS allowlists.
688. Prevent open redirects.
689. Guard mass assignment with Zod stripping.
690. Guard against prototype pollution.
691. Use ReDoS-safe regular expressions.
692. Match upload magic bytes against extension.
693. Sanitize or re-encode SVG files.
694. Provide a malware-scan hook.
695. Guard against ZIP bombs and oversized files.
696. Limit webhook replay windows to plus/minus five minutes.
697. Support API idempotency keys.

# Y3. Access control and sessions (698–709)

698. Enforce server-side permission checks everywhere.
699. Treat hidden UI as insufficient security.
700. Require step-up two-factor authentication for sensitive actions.
701. Require two-factor authentication for super-admin actions.
702. Offer an optional admin IP allowlist.
703. Show an impersonation banner and expiry.
704. Offer a read-only impersonation mode.
705. Prevent session fixation.
706. Revoke every session after password change.
707. Enforce password policy and breach checking.
708. Detect login velocity and use CAPTCHA when needed.
709. Provide an account-recovery process.

# Y4. Data protection and privacy (710–720)

710. Redact PII from logs.
711. Scrub PII from Sentry reports.
712. Confirm encryption at rest.
713. Encrypt backups.
714. Use short-lived signed storage URLs.
715. Rate-limit downloads.
716. Watermark exports and give them an expiry.
717. Make audit logs append-only and immutable.
718. Schedule data retention.
719. Issue right-to-delete certificates.
720. Run cross-tenant fuzz tests.

# Y5. Supply-chain and CI security (721–729)

721. Gate CI on `npm audit`.
722. Pin dependencies and commit lockfiles.
723. Configure Dependabot or an equivalent update policy.
724. Scan CI for secrets.
725. Run SAST static scanning.
726. Check licence compliance.
727. Generate an SBOM.
728. Make builds reproducible.
729. Apply protected-branch and review policy.

# Y6. Email deliverability (730–738)

730. Publish SPF, DKIM, and DMARC setup guidance.
731. Provide a domain-verification checklist.
732. Maintain a suppression list.
733. Apply hard- and soft-bounce policies.
734. Handle complaints through feedback loops.
735. Include a plain-text alternative part.
736. Send List-Unsubscribe headers.
737. Pre-check spam score.
738. Throttle sending rates.

# Y7. Financial accuracy and compliance (739–752)

739. Use gapless sequential numbering.
740. Lock numbering against race conditions.
741. Guard against double submits and duplicate charges.
742. Offer bankers’ rounding.
743. Configure line-level versus total-level rounding.
744. Record multi-currency FX gains and losses.
745. Freeze historical exchange rates.
746. Lock accounting periods.
747. Provide a financial-close process.
748. Support client credit limits.
749. Run multi-level dunning ladders.
750. Export tax-filing formats.
751. Maintain a seven-year legal archive.
752. Audit payment allocation.

# Y8. Design QA and consistency (753–767)

753. Maintain a single spacing, radius, and shadow scale.
754. Ensure contrast ratio of at least 4.5:1.
755. Provide complete dark-mode parity.
756. Use one icon set: Lucide.
757. Use one illustration style.
758. Define a motion system with durations and easing.
759. Keep toast position consistent.
760. Publish form-pattern guidance.
761. Standardise table density.
762. Centralise date, number, and currency formatting.
763. Define a timezone-display policy.
764. Maintain a single error-message catalogue.
765. Publish microcopy guidance.
766. Provide skip links and focus management.
767. Capture visual-regression snapshots.

# Y9. Performance budgets (768–776)

768. Target Lighthouse scores of at least 90.
769. Target LCP below 2.5s, INP below 200ms, and CLS below 0.1.
770. Enforce bundle-size budgets and analyse bundles.
771. Prevent N+1 queries.
772. Audit index coverage.
773. Use cursor pagination for large lists.
774. Filter and sort on the server.
775. Maintain a cache layer and invalidation map.
776. Dynamically import heavy components.

# Y10. Observability and incidents (777–787)

777. Use structured logs with request IDs.
778. Record operational metrics such as payment success rate.
779. Define alert rules and thresholds.
780. Alert on webhook failures.
781. Alert on scheduled-job failures.
782. Run uptime checks and update status automatically.
783. Provide an error-budget dashboard.
784. Maintain incident runbooks.
785. Define disaster-recovery RTO/RPO.
786. Run backup-restore drills.
787. Provide a postmortem template.

# Y11. Customer lifecycle and offboarding (788–795)

788. Accept account-close requests.
789. Export data during offboarding.
790. Offer a grace period and restoration.
791. Run complete tenant-deletion jobs.
792. Provide a data-migration import tool.
793. Reconcile seats and usage billing.
794. Convert suspended tenants to read-only mode.
795. Define an abuse-handling policy.

# Y12. Delivery quality gates (796–805)

796. Define completion criteria for every delivery phase.
797. Keep `tsc --noEmit` green.
798. Keep the Next.js production build green.
799. Keep ESLint at zero errors.
800. Keep Bengali scanning at zero findings.
801. Keep the unfinished-marker scan at zero findings.
802. Keep the dead-link scan at zero findings.
803. Capture 320px mobile screenshots.
804. Pass automated accessibility audits.
805. Run phase-based smoke tests.

# Z1. Netlify and runtime realities (806–817)

806. Design around Netlify Function 10s/26s timeout strategy.
807. Move long-running work to background functions.
808. Preserve raw webhook bodies in runtime configuration.
809. Use direct-to-storage uploads for payloads above 6MB.
810. Process large exports asynchronously and deliver signed URLs.
811. Choose appropriately between Netlify Scheduled Functions and `pg_cron`.
812. Keep ISR/revalidation compatible with Netlify.
813. Map Edge and Node runtime responsibilities.
814. Reduce cold starts.
815. Use Supabase connection pooling through pgBouncer.
816. Prevent connection leaks in serverless execution.
817. Test parity across Netlify, Vercel, and Docker.

# Z2. Database-engineering rigor (818–832)

818. Store money as `numeric(18,4)`, never floating point.
819. Store every timestamp as UTC `TIMESTAMPTZ`.
820. Use UUID v7 for index locality.
821. Use partial unique indexes for soft deletes.
822. Define an evolution policy for enums versus lookup tables.
823. Follow zero-downtime migration rules.
824. Provide migration rollback scripts.
825. Make seeds idempotent.
826. Apply check constraints for negative values and ranges.
827. Index every foreign key.
828. Use partial indexes where `deleted_at IS NULL`.
829. Use PostgreSQL FTS and `pg_trgm` search.
830. Optimise RLS with wrapped `auth` access.
831. Set database query and statement timeouts.
832. Monitor dead tuples and VACUUM health.

# Z3. Concurrency and race conditions (833–841)

833. Use advisory locks for invoice numbering.
834. Use optimistic locking with version columns.
835. Show conflict messages for simultaneous edits.
836. Use row locks for stock updates.
837. Serialize wallet-balance updates.
838. Guard against double-click payment submission.
839. Use a database-backed queue with `FOR UPDATE SKIP LOCKED`.
840. Prevent overlapping scheduled jobs with a leader lock.
841. Store processed webhook events.

# Z4. Amazon-grade invoice legal accuracy (842–857)

842. Support tax-inclusive and tax-exclusive modes.
843. Configure discounts before or after tax.
844. Toggle whether shipping is taxable.
845. Support withholding tax.
846. Add rounding-adjustment lines.
847. Handle negative lines and credits.
848. Convert overpayments to client credit balance.
849. Support units of measure.
850. Support optional HS/SAC codes.
851. Display item codes/SKUs on invoices.
852. Display seller tax registration.
853. Provide a Remit-To block with bank, SWIFT, and routing information.
854. Clearly display net terms.
855. Distinguish client currency from company currency.
856. Show rate-by-rate tax breakdown tables.
857. Handle month-end and leap-year recurring rules.

# Z5. PDF and print engine (858–867)

858. Render PDFs server-side reliably.
859. Embed fonts and support Unicode.
860. Repeat table headers across multi-page documents.
861. Control page breaks.
862. Show Page X of Y footers.
863. Toggle A4 and Letter paper sizes.
864. Use `@page` margins and print CSS.
865. Store a PDF snapshot when a document is sent.
866. Record PDF checksums/hashes.
867. Define regeneration versus archive policy.

# Z6. Email identity and anti-abuse (868–879)

868. Use a `From` identity in the form “Tenant via KD SOLUTION IT”.
869. Use the tenant’s email as `Reply-To`.
870. Include platform address information for CAN-SPAM.
871. Include unsubscribe links in marketing email.
872. Prohibit sending until email is verified.
873. Rate-limit new tenant sending.
874. Scan content for phishing and spam.
875. Allowlist link domains.
876. Provide an abuse-report endpoint.
877. Prevent brand impersonation.
878. Moderate CMS, blog, and uploaded content.
879. Snapshot every sent email exactly as delivered.

# Z7. Entitlements and monetisation (880–890)

880. Provide a central entitlement engine.
881. Model a plan-by-feature matrix.
882. Show upsell UI for locked features.
883. Enforce entitlements on the server.
884. Support overage and usage-based billing.
885. Provide add-on marketplace structures.
886. Display a “Powered by KD SOLUTION IT” badge.
887. Make badge removal a paid feature.
888. Provide a white-label tier.
889. Gate custom domains by plan.
890. Offer tenant sending domains as an add-on.

# Z8. Tenant lifecycle and growth (891–900)

891. Transfer company ownership.
892. Separate billing contact from owner.
893. Capture cancellation flow and reasons.
894. Offer win-back incentives.
895. Send onboarding drip email on days 1, 3, and 7.
896. Toggle demo data.
897. Provide a first-run product tour.
898. Show an in-app changelog widget.
899. Provide a feature-request board.
900. Maintain a role-by-event notification matrix.

# Z9. Admin intelligence (901–908)

901. Provide cross-tenant global search.
902. Score tenant health.
903. Detect churn-risk signals.
904. Report MRR, ARR, LTV, and cohorts.
905. Report success rate by gateway.
906. Export tenant data for support.
907. Obtain impersonation consent and audit it.
908. Provide an admin-action undo window.

# Z10. Legal and consent evidence (909–917)

909. Record terms acceptance and IP at signup.
910. Require renewed consent after a terms-version change.
911. Record tenant DPA acceptance.
912. Notify tenants about subprocessor changes.
913. Support granular cookie categories.
914. Store evidence of cookie consent.
915. Offer cookie-free analytics alternatives.
916. Publish SLA/uptime-commitment page.
917. Publish MoR responsibility disclosures.

# Z11. Developer interfaces (918–923)

918. Publish an OpenAPI 3.1 specification.
919. Publish a Postman collection.
920. Define API versioning and deprecation policy.
921. Publish Zapier/Make recipe documentation.
922. Provide webhook payload examples.
923. Publish an error-code reference table.

# Z12. Final product polish (924–930)

924. Maintain a client communication log for every mail.
925. Offer alternative payment-method UX after failed payment.
926. Provide remaining-balance links for partial payments.
927. Publish a keyboard-shortcuts reference page.
928. Prompt for PWA installation.
929. Provide an offline page.
930. Announce form errors through `aria-live`.

# AA1. Token leakage and link security (931–939)

931. Apply `Referrer-Policy: no-referrer` on token pages.
932. Use `rel="noopener noreferrer"` for external links.
933. Never include PII in token URLs.
934. Use at least 128-bit tokens to prevent enumeration.
935. Mask tokens in logs and analytics.
936. Do not pass tokens in gateway redirects.
937. Prohibit tracking pixels in PDFs.
938. Define an email-forwarding leak warning policy.
939. Make token expiry plan-based.

# AA2. Payment-engineering depth (940–953)

940. Handle zero-decimal currencies such as JPY and KRW.
941. Use a minor-unit conversion layer.
942. Publish PCI SAQ-A scope declaration.
943. Never send card data to the application server; use hosted fields.
944. Support Stripe Connect and direct-key modes.
945. Route MoR payments through the platform account.
946. Handle refunds after settlement.
947. Define platform-fee policy on refunds.
948. Set a minimum payout threshold.
949. Calculate payout FX and conversion fees.
950. Reverse failed payouts.
951. Reconcile gateway payouts to transactions.
952. Support partial capture and authorisation-only flows.
953. Document sandbox test cards.

# AA3. Tax and international compliance (954–964)

954. Support EU reverse-charge rules.
955. Provide VIES VAT-ID verification hooks.
956. Configure US sales-tax nexus.
957. Disclose marketplace-facilitator responsibilities.
958. Support 1099-K/merchant tax reporting.
959. Provide country-specific chart-of-accounts templates.
960. Upload tax-exemption certificates.
961. Use a separate platform invoice sequence.
962. Export legal archives for auditors.
963. Allow data-residency selection.
964. Enforce country-specific mandatory invoice fields.

# AA4. KYC/AML depth and maker-checker controls (965–976)

965. Collect business-registration documents.
966. Collect beneficial-owner information.
967. Collect proof of address.
968. Track document expiry and re-verification cycles.
969. Detect duplicate documents by hash.
970. Flag one bank account used by multiple tenants.
971. Detect reused device fingerprints.
972. Run periodic sanctions re-screening.
973. Audit KYC document reads.
974. Require four-eyes approval for large payouts.
975. Run maker-checker workflows.
976. Log administrator action undo/reversals.

# AA5. Form and data-safety UX (977–988)

977. Guard navigation with unsaved changes.
978. Warn on `beforeunload`.
979. Recover drafts after crashes.
980. Detect duplicate tabs.
981. Synchronize multi-tab sessions.
982. Handle token-refresh races.
983. Offer five-second undo for destructive actions.
984. Confirm bulk actions with selected counts.
985. Use optimistic UI with rollback.
986. Show autosave indicators.
987. Back off when realtime reconnects.
988. Show co-editing presence indicators.

# AA6. Data migration and opening balances (989–997)

989. Import QuickBooks, Zoho, and Wave CSV data.
990. Provide a column-mapping wizard.
991. Preview imports and report validation results.
992. Roll back imports.
993. Preserve legacy invoice numbers.
994. Import client opening balances.
995. Import account opening balances.
996. Import historical payments.
997. Detect duplicate imports.

# AA7. Service-business billing (998–1008)

998. Track projects and jobs.
999. Track time with timer and manual entry.
1000. Convert billable hours to invoices.
1001. Set staff- and project-specific hourly rates.
1002. Approve timesheets.
1003. Bill milestones.
1004. Manage retainers and prepaid hours.
1005. Rebill reimbursable expenses.
1006. Report project profitability.
1007. Set client-specific price lists.
1008. Support quantity-discount tiers.

# AA8. Client data quality (1009–1016)

1009. Detect duplicate clients.
1010. Merge clients.
1011. Archive clients.
1012. Mark clients as do-not-contact.
1013. Allow per-client reminder opt-out.
1014. Bulk-edit clients.
1015. Save per-user views.
1016. Let users choose export columns.

# AA9. Owner-controlled tenant security policy (1017–1025)

1017. Let owners require staff two-factor authentication.
1018. Let owners reset staff passwords.
1019. Let owners view staff-login activity.
1020. Support tenant IP restrictions.
1021. Configure session timeouts.
1022. Cap staff approval amounts.
1023. Require owner approval for data exports.
1024. Reserve SSO/SAML capability for future enterprise use.
1025. Revoke devices and sessions.

# AA10. API maturity (1026–1035)

1026. Return `X-RateLimit-*` and `Retry-After` headers.
1027. Standardise cursor pagination.
1028. Publish filter and sort syntax.
1029. Support sparse fieldsets.
1030. Rotate webhook signing keys.
1031. Provide a dead-letter queue.
1032. Apply per-event retry policy.
1033. Publish an API changelog.
1034. Keep error-code references stable.
1035. Publish API status and incident feeds.

# AA11. Release, load, and cost operations (1036–1046)

1036. Release behind feature flags.
1037. Use canary deployment and rapid rollback.
1038. Schedule maintenance windows with banners.
1039. Run k6 load tests for critical endpoints.
1040. Publish declared load limits.
1041. Monitor and alert on Supabase usage.
1042. Monitor Resend quotas.
1043. Degrade gracefully at quota exhaustion.
1044. Run tenant-isolation tests in CI.
1045. Maintain visual-regression baselines.
1046. Maintain isolated E2E seed tenants.

# AA12. Final identified gaps (1047–1052)

1047. Display a correlation ID on errors.
1048. Attach correlation IDs to support tickets.
1049. Restore a single tenant independently.
1050. Support multiple branches/locations.
1051. Send estimate-expiry reminders.
1052. Support estimate attachments.

# BB. Storage, media, delivery, and file lifecycle (1053–1110)

## BB1. Storage abstraction — 12 requirements (1053–1064)

- Use a provider-adapter layer for storage.
- Support presigned/direct uploads.
- Provide a storage migration tool.
- Enforce per-tenant storage quotas.
- Support a provider fallback chain.
- Keep provider configuration independent of business features.
- Preserve tenant isolation regardless of provider.
- Record file metadata independently of storage location.
- Permit controlled provider changes without broken links.
- Apply the same signed-access policy across providers.
- Measure tenant storage consumption centrally.
- Keep a recoverable, auditable transfer history.

## BB2. Media optimisation — 14 requirements (1065–1078)

- Convert ordinary image uploads to AVIF and WebP.
- Resize images before storage.
- Strip EXIF and GPS metadata.
- Produce image variants.
- Provide thumbnail, medium, and full-size variants.
- Deliver responsive variants through `srcset`.
- Optimise PDF compression.
- Subset PDF fonts.
- Downsample PDF images at 150–200 DPI.
- Compress PDF object streams.
- Preserve print-quality output.
- Offer quality presets.
- Preserve OCR-readable KYC scans with quality-preserving processing.
- Reject video and audio uploads.

## BB3. File lifecycle — 9 requirements (1079–1087)

- Deduplicate files by hash.
- Version stored files.
- Clean orphaned files.
- Support archive storage tiers.
- Enforce file-retention policies.
- Soft-delete files.
- Restore soft-deleted files.
- Retain lifecycle and restoration audit data.
- Keep deletion and retention behavior tenant-scoped.

## BB4. Delivery and CDN — 7 requirements (1088–1094)

- Set CDN cache headers.
- Expire signed URLs.
- Prevent hotlinking.
- Throttle bandwidth.
- Support range requests.
- Authorise delivery before serving private content.
- Keep delivery policy consistent across storage providers.

## BB5. Storage cost control — 6 requirements (1095–1100)

- Show storage use on a dashboard.
- Alert when storage quota is near its limit.
- Set plan-based storage limits.
- Define overage policy.
- Measure quota by tenant.
- Preserve usage history for billing and support.

## BB6. File UX and access audit — 10 requirements (1101–1110)

- Preview PDFs in-app.
- Preview images in-app.
- Support drag-and-drop multi-upload.
- Support resumable upload.
- Show upload progress.
- Cancel uploads.
- Support mobile-camera capture for KYC.
- Audit file access.
- Show upload validation results.
- Give each file action an authorised, tenant-scoped lifecycle.

# CC. Platform first run, infrastructure, governance, and residual UX (1111–1162)

## CC1. Platform first run — 7 requirements (1111–1117)

- Provide a super-admin setup wizard.
- Configure branding in that wizard.
- Configure SMTP in that wizard.
- Configure gateways in that wizard.
- Configure plans in that wizard.
- Configure the primary domain in that wizard.
- Provide `/api/health` dependency checks, a build/version endpoint, and a footer build hash.

## CC2. Domain and email infrastructure — 8 requirements (1118–1125)

- Separate application and marketing subdomains.
- Provide a short-link domain for invoices.
- Use a `mail.` sending subdomain.
- Use a bounce-handling subdomain.
- Publish a DNS-record checklist.
- Verify DNS records automatically.
- Apply domain configuration to tenant branding safely.
- Keep link, application, and email identities independently configurable.

## CC3. Abuse and fraud prevention — 9 requirements (1126–1134)

- Block disposable-email addresses.
- Detect free-trial abuse.
- Enforce one-time coupon rules.
- Guard against referral fraud.
- Support optional phone verification.
- Count seats accurately.
- Log abuse signals.
- Escalate suspicious accounts for review.
- Apply the controls without leaking tenant data.

## CC4. Collections and dunning depth — 8 requirements (1135–1142)

- Schedule reminders at 9:00 AM in tenant local time.
- Respect quiet hours.
- Support business-day due dates.
- Use dunning-stage templates.
- Capture promise-to-pay dates.
- Record collection notes.
- Flag client risk.
- Generate statement PDFs.

## CC5. Industry presets and template library — 7 requirements (1143–1149)

- Let onboarding select service, retail, or medical industry.
- Preconfigure chart of accounts per industry.
- Preconfigure taxes per industry.
- Preconfigure invoice templates per industry.
- Provide a terms library.
- Provide note templates.
- Provide email signatures.

## CC6. MoR fee transparency — 6 requirements (1150–1155)

- Show a fee breakdown per transaction.
- Invoice merchants monthly for fees.
- Show payout schedules.
- Explain hold reasons.
- Generate wallet-statement PDFs.
- Keep fee and hold calculations auditable.

## CC7. Documentation and governance — 5 requirements (1156–1160)

- Maintain an ERD diagram.
- Maintain a data dictionary.
- Maintain architecture decision records.
- Maintain a runbook for every feature.
- Publish a browser-support matrix.

## CC8. Remaining UX — 2 requirements (1161–1162)

- Provide full keyboard navigation in data tables.
- Persist timers while offline.

# DD. Marketing, SEO, and social (1163–1234)

## DD1. Analytics and pixels — 12 requirements

- Integrate Google Analytics 4.
- Integrate Google Tag Manager.
- Verify Google Search Console.
- Integrate Meta Pixel.
- Support server-side Conversions API.
- Support TikTok Pixel.
- Support LinkedIn Pixel.
- Support X Pixel.
- Integrate Microsoft Clarity and heatmaps.
- Load all tracking only under appropriate cookie consent.
- Configure tracking IDs from the admin panel rather than code.
- Audit analytics configuration and consent state.

## DD2. Deep SEO — 14 requirements

- Publish JSON-LD for Organization.
- Publish JSON-LD for Product and SoftwareApplication.
- Publish JSON-LD for FAQ, Breadcrumb, Article, and Review content.
- Generate canonical URLs.
- Generate dynamic OpenGraph images.
- Generate Twitter Cards.
- Generate dynamic sitemaps for CMS and blog content.
- Control robots rules.
- Provide per-page administrator meta editing.
- Manage slugs and 301 redirects.
- Report broken links.
- Audit heading structure.
- Require image alt text.
- Report Core Web Vitals and link Google Business Profile and Bing Webmaster tools.

## DD3. Social presence and sharing — 11 requirements

- Manage footer and header social links in administration.
- Provide Facebook sharing.
- Provide X sharing.
- Provide LinkedIn sharing.
- Provide WhatsApp sharing.
- Provide Telegram sharing.
- Provide copy-link sharing.
- Preview share cards.
- Provide a Share your QR card flow.
- Share invoices and estimates over WhatsApp.
- Provide referral share kits and social-proof widgets.

## DD4. Social-post automation, future-ready — 15 requirements

- Provide a content calendar.
- Provide a multi-platform post composer.
- Schedule posts.
- Maintain a media library.
- Connect channels with OAuth tokens in the secret vault.
- Use a Facebook Page adapter.
- Use an Instagram adapter.
- Use a LinkedIn adapter.
- Use X, Threads, Telegram, and Pinterest adapters.
- Report per-post analytics.
- Auto-post new blogs to configured channels.
- Maintain a re-post/evergreen queue.
- Provide an approval workflow.
- Build database and UI skeletons now.
- Keep live third-party APIs independently activatable later.

## DD5. Marketing automation — 11 requirements

- Build email campaigns.
- Manage segments and lists.
- Run drip sequences.
- Build landing pages from CMS blocks.
- Support popup and exit-intent experiences.
- Score leads.
- Archive newsletters.
- Build UTM links.
- Report UTM performance.
- Report conversion funnels.
- Respect marketing consent and unsubscribe state.

## DD6. Conversion optimisation — 9 requirements

- Provide A/B test framework for homepage and pricing.
- Support CTA variants.
- Display trust badges.
- Display recently-signed-up social proof.
- Request Google reviews.
- Manage testimonials.
- Provide a pricing calculator.
- Provide chat/bot-widget hooks.
- Measure experiments without bypassing consent.

# Strategic extensibility recommendations

The following requested future-ready opportunities remain part of the product catalogue:

1. Provide AI-assistant hooks for invoice summaries, expense categorisation, and email drafts; activate provider APIs only when keys are configured.
2. Provide reseller/white-label partner capabilities as a major revenue path.
3. Provide limited accountant access for customer accountants.
4. Provide a template marketplace for invoice and email designs.
5. Provide Zapier/Make integrations and a Chrome extension.
6. Add SMS, Telegram, and Viber alongside WhatsApp.
7. Add bank-feed aggregation for automatic reconciliation.
8. Add receipt OCR for automated expense entry.
9. Add contracts and electronic signature.
10. Add BNPL/installment-finance partners.
11. Add loyalty and client-review collection automation.
12. Evolve the PWA into a native mobile wrapper when appropriate.
13. Provide a help academy with video courses and a community forum.
14. Keep the public-site architecture ready for multilingual support.

# EE. New modules (source range 1235–1336; all stated capabilities retained)

## EE1. Reseller and white-label — stated 18 requirements

- Provide a reseller role and dashboard.
- Give resellers their own brand.
- Give resellers their own logo.
- Give resellers their own domain.
- Give resellers their own pricing.
- Support reseller margins.
- Let resellers create sub-tenants.
- Let resellers manage sub-tenants.
- Bill resellers.
- Calculate reseller commissions.
- Provide a reseller support inbox.
- Allow complete platform-brand removal for qualifying tiers.
- Run reseller approval workflow.
- Report revenue sharing.
- Preserve platform-level audit control.
- Apply sub-tenant isolation.
- Make white-label capabilities plan-gated.
- Keep reseller configuration distinct from tenant branding.

## EE2. Accountant access — stated 11 requirements

- Provide an accountant access role/profile with read and journal permissions.
- Allow one accountant login across multiple companies.
- Provide a company switcher.
- Allow owners to invite accountants.
- Allow owners to revoke accountant access.
- Respect accounting-period locks.
- Show only accounting modules to accountants.
- Keep an accountant activity log.
- Export tax-filing data.
- Enforce company scoping across each assignment.
- Preserve owner control over approvals and exports.

## EE3. Template marketplace — stated 12 requirements

- Offer invoice-design templates.
- Offer email templates.
- Offer document templates.
- Support free templates.
- Support paid templates.
- Install templates.
- Preview templates.
- Provide author profiles.
- Collect ratings.
- Share revenue with authors.
- Moderate templates in administration.
- Version templates.

## EE4. Integration ecosystem — stated 10 requirements

- Provide a Zapier app with triggers and actions.
- Provide Make.com modules.
- Provide a Chrome extension for quick invoicing and timers.
- Register OAuth applications.
- Publish an app directory.
- Publish a developer portal.
- Protect integration credentials in the vault.
- Audit connected applications.
- Document integration events.
- Apply scoped API permissions.

## EE5. Multi-channel messaging — stated 11 requirements

- Provide an SMS adapter, including Twilio compatibility.
- Provide a Telegram bot channel.
- Provide a Viber channel.
- Use one channel-routing engine.
- Use WhatsApp-to-SMS-to-email fallback chains.
- Store per-client channel preferences.
- Track channel costs.
- Respect quiet hours.
- Record delivery state across channels.
- Respect messaging consent.
- Retain routing and delivery audit logs.

## EE6. Bank feeds and reconciliation — stated 13 requirements

- Provide bank-aggregator adapters for Plaid, Salt Edge, and CSV.
- Import bank transactions automatically.
- Match invoices to payments intelligently.
- Suggest matches.
- Reconcile in bulk.
- Provide a bank-rules engine.
- Maintain an unmatched queue.
- Reconcile balances.
- Record match decisions.
- Permit manual correction.
- Support tenant-owned bank connections.
- Keep credentials encrypted.
- Audit reconciliation changes.

## EE7. Receipt OCR and smart entry — stated 9 requirements

- Scan receipts to extract fields.
- Support mobile-camera capture.
- Detect vendor names.
- Detect dates.
- Detect VAT.
- Categorise automatically.
- Show confidence score and allow manual correction.
- Detect duplicate receipts.
- Support bulk uploads.

## EE8. Contracts and electronic signatures — stated 12 requirements

- Create contract templates.
- Use merge fields.
- Send and track contracts.
- Produce legally useful electronic signatures with audit trail, IP, and timestamp.
- Support multiple signers.
- Control signing order.
- Seal signed PDFs.
- Send expiry reminders.
- Send renewal reminders.
- Link contracts to invoices.
- Preserve signed-document snapshots.
- Apply tokenised, no-account signing access where applicable.

## EE9. BNPL and installment finance — stated 8 requirements

- Provide partner adapters modeled after Klarna/Afterpay.
- Check eligibility.
- Show BNPL at checkout.
- Show installment schedules.
- Reconcile partner settlements.
- Define risk policy.
- Define fee policy.
- Retain provider-neutral adapter boundaries.

## EE10. Loyalty and review automation — stated 8 requirements

- Ask for reviews after payment.
- Provide a Google Review deep link.
- Collect internal ratings.
- Intercept negative feedback for resolution.
- Publish approved testimonials.
- Award loyalty points or credits.
- Reward repeat clients.
- Keep all review requests consent-aware and auditable.

# Q. Deploy and operations — positioned after product scope

The original requirements explicitly place the extended feature set before this deployment section. The following operational requirements are therefore retained here as a final platform-wide delivery section:

- Provide Netlify deployment configuration.
- Provide a complete `.env.example` template.
- Provide `scripts/backup.sh` using `pg_dump`.
- Provide `scripts/restore.sh` using `pg_restore`.
- Maintain Supabase migrations and idempotent seed data.
- Schedule recurring-invoice processing.
- Schedule overdue-invoice and reminder processing.
- Start every source and configuration file with a full path comment where its format permits comments.
- Make one focused Git commit per completed file change, subject to reviewable delivery grouping and repository policy.

# Requirements coverage index

| Catalogue range | Area |
| --- | --- |
| 1–14 | Brand and design system |
| 15–31 | CMS-editable public site |
| 32–40 | Authentication |
| 41–48 | Onboarding and company profile |
| 49–54 | Dashboard |
| 55–60 | CRM |
| 61–64 | Products and services |
| 65–81 | Core invoicing |
| 82–86 | Estimates and documents |
| 87–96 | Payments |
| 97–105 | Reports |
| 106–113 | Team and KYC |
| 114–122 | Tenant settings |
| 123–145 | Super administration |
| 146–153 | Email engine |
| 154–163 | Security and data foundations |
| 164–295 | WhatsApp, QR cards, ecommerce, inventory, accounting, MoR, API, token client access, content, branding, invoice format, security, GDPR, testing, and hosting |
| 296–389 | Trial, notifications, billing lifecycle, tax, reporting, inventory, permissions, administration, UX, performance, developer experience, and scheduled jobs |
| 390–482 | Gateway framework, local payments, subscriptions, payment UX, MoR, document workflow, support, marketing, legal, and platform engineering |
| 483–556 | Token client access, email journey, staff email routing, gateway routing, blind affiliates, owner-only sending, bulk send, sent-versus-paid dashboard, and strict isolation |
| 558–609 | Payment consent, delivery proof, audit chain, dispute evidence, prevention, and legal protection |
| 610–670 | Design, navigation, English content, and mobile-first standards |
| 671–805 | Secrets, application security, privacy, CI, deliverability, financial accuracy, QA, performance, incidents, lifecycle, and quality gates |
| 806–930 | Runtime, database rigor, concurrency, invoice/PDF/email quality, entitlement, legal, developer interface, and polish |
| 931–1052 | Link security, payments, international tax, KYC/AML, safe UX, imports, service billing, client data, tenant controls, API maturity, release ops, and final gaps |
| 1053–1162 | Storage/media, first-run infrastructure, domains, abuse prevention, collections, industry presets, governance, and keyboard/offline UX |
| 1163–1234 | Marketing, analytics, SEO, social, automation, and conversion optimisation |
| 1235 onward | Reseller, accountant, marketplace, integration, messaging, bank feeds, OCR, e-sign, BNPL, loyalty, and reviews |

## Completion rule

A delivery item is complete only when its feature behavior, authorization, tenant isolation, validation, auditability, mobile state, accessibility, tests, monitoring, documentation, and applicable operational controls satisfy the cross-cutting requirements in this catalogue. The catalogue contains no client-account model: all external clients use secure tokenized access.
