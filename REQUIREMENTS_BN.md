<!-- REQUIREMENTS_BN.md -->

# KD SOLUTION IT — বাংলায় পূর্ণ চাহিদার তালিকা

**বাজার:** এশিয়া-কেন্দ্রিক সেবা। প্ল্যাটফর্মের ডিফল্ট মুদ্রা USD।
**উদ্দেশ্য:** এই ফাইলে প্রদত্ত সব চাহিদা সংরক্ষিত হয়েছে; কোনো ফিচার বাদ দেওয়ার অনুমতি নেই।
**ভাষানীতি:** প্রোডাক্ট UI, কোড, মন্তব্য, seed data, ইমেইল ও error message English-only থাকবে; এই ফাইলটি কেবল আপনার বাংলা requirements reference।

## স্থির আর্কিটেকচার ও সিদ্ধান্ত

- প্ল্যাটফর্মটি কঠোর tenant isolation-সহ multi-tenant হবে।
- Invoice ও dispute-evidence PDF server-side React-PDF দিয়ে হবে।
- শুরুতে rate limit Supabase table-এ থাকবে; পরে adapter দিয়ে Upstash Redis ব্যবহার করা যাবে।
- CAPTCHA হিসেবে Cloudflare Turnstile ব্যবহৃত হবে।
- দীর্ঘ background কাজের জন্য Supabase pg_cron ও database-backed queue ব্যবহৃত হবে।
- Browser থেকে সরাসরি signed upload দিয়ে Supabase Storage-এ ফাইল যাবে।
- Time tracking/project/service-business billing এখনই scope-এ থাকবে।
- MoR হবে platform account + wallet + payout ভিত্তিক; Stripe Connect hook রাখা হবে।
- QuickBooks, Zoho ও Wave import এখনই থাকবে।
- সাধারণ ছবি browser-এ resize করে AVIF/WebP হবে, EXIF/GPS বাদ যাবে এবং thumb/md/full variant ও responsive srcset থাকবে।
- PDF-তে font subsetting, 150–200 DPI image downsampling ও object-stream compression হবে।
- KYC scan OCR-পাঠযোগ্য quality-preserving mode-এ থাকবে।
- CSV/JSON export gzip/Brotli এবং bulk export ZIP হবে। ভিডিও/অডিও upload গ্রহণ করা হবে না।

# A. ব্র্যান্ড ও ডিজাইন সিস্টেম (১–১৪)

1. KD SOLUTION IT ব্র্যান্ডিং।
2. কাস্টম ডিজাইন সিস্টেম।
3. ব্র্যান্ডেড sidebar ও topbar।
4. Logo component ও favicon।
5. Instant CSS-variable branding।
6. z-index scale নিয়ম।
7. 320px থেকে 1920px responsive layout।
8. Touch target ন্যূনতম 44px।
9. Hover ও transition micro-interaction।
10. Toast notification system।
11. Empty-state SVG illustration।
12. ব্র্যান্ডেড loading skeleton।
13. Invoice/report print stylesheet।
14. Dark/light theme toggle।

# B. পাবলিক সাইট, সব CMS-editable (১৫–৩১)

15. Homepage hero ও CTA।
16. Product screenshot preview।
17. Feature-grid section।
18. Pricing-preview section।
19. Testimonial section।
20. FAQ teaser ও পূর্ণ FAQ page।
21. Footer company links।
22. About page।
23. Contact page ও ticket fallback।
24. Terms page।
25. Privacy page।
26. Refund page।
27. Problem-solving guide page।
28. `support@kdsolutionit.com` প্রদর্শন।
29. SEO metadata ও OpenGraph।
30. `sitemap.xml` ও `robots.txt`।
31. ব্র্যান্ডেড 404 ও error page।

# C. অথেনটিকেশন (৩২–৪০)

32. Supabase email/password authentication।
33. ব্র্যান্ডেড auth-screen panel।
34. Email verification flow।
35. Forgot/reset password।
36. Password strength indicator।
37. Custom SMTP auth email।
38. অনুমোদিত account role অনুযায়ী redirect।
39. Middleware route protection।
40. Secure session refresh।

# D. অনবোর্ডিং ও কোম্পানি প্রোফাইল (৪১–৪৮)

41. Sign-up-এ plan selection।
42. Free plan preselected।
43. Company onboarding wizard।
44. CompanyProvider auto-fill।
45. প্রতিটি document-এর frozen company-profile snapshot।
46. Invoice prefix setup।
47. Multi-currency support।
48. পরিবর্তিত logo শুধু নতুন invoice-এ প্রয়োগ।

# E. ড্যাশবোর্ড (৪৯–৫৪)

49. Revenue overview card।
50. Due/outstanding summary।
51. Recent invoice list।
52. Recharts revenue chart।
53. Quick-action shortcut।
54. Global search।

# F. ক্লায়েন্ট / CRM (৫৫–৬০)

55. Client CRUD।
56. Inline new-client dialog।
57. Client search ও filter।
58. Client activity timeline।
59. Client statement।
60. Client CSV import/export।

# G. Product / Service (৬১–৬৪)

61. Product/service CRUD।
62. Product-search dropdown।
63. Inline new-item add।
64. Price ও tax setting।

# H. Core invoicing (৬৫–৮১)

65. Invoice create/edit/delete।
66. Invoice duplicate।
67. Dynamic line item।
68. Discount ও tax calculation।
69. Decimal-safe money calculation।
70. Auto invoice numbering।
71. Draft/sent/viewed/paid/overdue status।
72. Public tracker `/i/[token]`।
73. Invoice QR code।
74. Logo ও frozen snapshot-সহ PDF download।
75. Client-কে invoice email।
76. Invoice timeline feed।
77. External note ও internal note।
78. Payment term ও due date।
79. Partial payment।
80. Bulk action।
81. Invoice attachment।

# I. Estimate ও অন্যান্য document (৮২–৮৬)

82. Estimate CRUD।
83. Estimate থেকে invoice conversion।
84. Public estimate approval।
85. Credit note।
86. Cron-চালিত recurring invoice।

# J. পেমেন্ট (৮৭–৯৬)

87. Stripe integration।
88. PayPal integration।
89. Paddle integration।
90. Manual/bank payment।
91. Tenant-এর নিজস্ব gateway key।
92. Platform gateway-র জন্য terms opt-in।
93. Raw-body webhook verification।
94. Webhook idempotency ও rate limit।
95. Payment receipt।
96. Refund handling।

# K. রিপোর্ট (৯৭–১০৫)

97. Sales report।
98. Expense report।
99. Client report।
100.  Tax summary report।
101.  VAT in/out ও net payable।
102.  সব report-এ TOTAL row।
103.  Period/date filter।
104.  প্রতিটি report CSV export।
105.  প্রতিটি report PDF export।

# L. টিম ও KYC (১০৬–১১৩)

106. Pending থেকে active team invite।
107. Role ও permission।
108. Member remove।
109. KYC ID-front upload।
110. KYC ID-back upload।
111. 5MB limit, শুধু image/PDF file validation।
112. Upload preview।
113. Manual admin KYC review।

# M. সেটিংস (১১৪–১২২)

114. Company profile setting।
115. Logo upload।
116. Branding setting।
117. AES-256 gateway key setting।
118. Custom domain add।
119. Domain verification।
120. Billing/subscription upgrade।
121. One-click JSON backup।
122. Notification preference।

# N. সুপার অ্যাডমিন (১২৩–১৪৫)

123. Admin overview।
124. Search/filter-সহ user management।
125. Manual user verify।
126. Suspend/activate।
127. Soft-delete user।
128. Self-change block guard।
129. `free` slug-সহ plan CRUD।
130. Plan edit coercion fix।
131. Subscription edit ও sync।
132. Coupon management।
133. Platform fee configuration।
134. Payout processing।
135. KYC approve/reject।
136. Gateway configuration।
137. Revenue analytics।
138. Audit log viewer।
139. সব page-এর CMS editor।
140. Email template manager।
141. Support-ticket inbox।
142. Platform branding control।
143. System setting ও SMTP।
144. Stored credential নষ্ট না করে blank-password SMTP save।
145. Maintenance mode।

# O. ইমেইল ইঞ্জিন (১৪৬–১৫৩)

146. কেন্দ্রীয় `sendPlatformMail` function।
147. Resend SMTP, TLS port 587।
148. Welcome mail।
149. Invoice/estimate mail।
150. Status/reminder mail।
151. Subscription mail।
152. Mail fail হলে business action ব্যর্থ নয়, শুধু log হবে।
153. Branded email header।

# P. সিকিউরিটি ও ডেটা (১৫৪–১৬৩)

154. সব tenant data-তে `company_id` scope।
155. Supabase RLS policy।
156. `deleted_at` soft delete।
157. সর্বত্র audit log।
158. AES-256 secret encryption।
159. Rich-text sanitization।
160. Client ও server উভয়ে Zod validation।
161. DB transaction ও rollback।
162. Rate limiting।
163. Server-only environment variable নিয়ম।

# P2. WhatsApp automation (১৬৪–১৭০)

164. Meta Cloud API client।
165. WhatsApp template manager।
166. Invoice WhatsApp send।
167. Event-driven automation rule।
168. Bulk campaign।
169. Delivery/read tracking।
170. WhatsApp inbound webhook।

# P3. QR business card (১৭১–১৭৭) — বর্তমান scope থেকে বাদ

**অবস্থা:** Owner-এর সিদ্ধান্ত অনুযায়ী ২০২৬-১০-০৬ তারিখে এই module বাতিল করা হয়েছে। তালিকাটি কেবল historical reference হিসেবে রাখা হলো; implementation করা হবে না।

171. QR card builder।
172. vCard QR generation।
173. Card design customization।
174. Public share URL।
175. Online card verification।
176. Verified badge।
177. Scan analytics।

# P4. Ecommerce integration (১৭৮–১৮৫)

178. Shopify connection।
179. WooCommerce connection।
180. Encrypted store API key।
181. Order-webhook sync।
182. Order থেকে auto invoice।
183. Auto invoice email।
184. Sync log ও retry।
185. Product mapping।

# P5. Inventory ও warehouse (১৮৬–১৯২)

186. Stock level tracking।
187. Multi-warehouse।
188. Stock-movement ledger।
189. Invoice-এ auto stock reduction।
190. Low-stock alert।
191. Stock adjustment।
192. Product bundle।

# P6. Supplier ও purchase (১৯৩–১৯৭)

193. Supplier CRUD।
194. Purchase order create।
195. PO থেকে stock receive।
196. Supplier bill।
197. Payable tracking।

# P7. Expense ও accounting (১৯৮–২০৭)

198. Expense CRUD।
199. Expense category।
200. Recurring expense।
201. Receipt upload।
202. Chart of accounts।
203. Double-entry journal।
204. Profit & Loss।
205. Balance sheet।
206. Cash-flow statement।
207. Bank CSV import।

# P8. Virtual wallet ও MoR (২০৮–২১৯)

208. Merchant of Record mode।
209. KYC-gated MoR access।
210. KYC ছাড়া own gateway বাধ্যতামূলক।
211. Wallet balance।
212. Wallet transaction ledger।
213. Platform fee deduction।
214. 7–14 দিন hold period।
215. Hold-release cron।
216. Payout request।
217. Bank/bKash/Nagad payout।
218. Chargeback handling।
219. 3DS OTP processing।

# P9. Affiliate programme (২২০–২২৫)

220. Affiliate registration।
221. Referral tracking link।
222. Commission calculation।
223. Affiliate dashboard।
224. Commission payout request।
225. Admin affiliate approval।

# P10. Public API ও webhook (২২৬–২৩৫)

226. RESTful v1 API।
227. API key generate/revoke।
228. API permission scope।
229. API rate limit।
230. API use log।
231. Outgoing webhook endpoint।
232. Event subscription।
233. HMAC signing secret।
234. Delivery retry/log।
235. API documentation page।

# P11. Client Access, tokenized (২৩৬–২৪২)

236. আলাদা client login থাকবে না।
237. Magic link-এর বদলে account-বিহীন signed token link।
238. Token-authorized public page-এ client document list।
239. Login ছাড়া token link-এ online payment।
240. Token link-এ receipt download।
241. Token link-এ payment history।
242. Token link-এ estimate approval।

# P12. Blog ও status (২৪৩–২৪৯)

243. Blog list ও detail।
244. Super-admin blog editor।
245. Draft/publish/schedule।
246. Cover image ও SEO।
247. Category/tag।
248. Uptime status page।
249. Incident management।

# P13. প্রতি-tenant branding (২৫০–২৫৬)

250. Tenant logo।
251. Tenant color/font।
252. Invoice-এ auto-fill branding।
253. Branded PDF header/footer।
254. Branded client email।
255. Branded public/token page।
256. Live branding preview।

# P14. American-style professional invoice (২৫৭–২৭১)

257. US invoice layout।
258. Amazon-acceptable format।
259. Bill To/Ship To।
260. Invoice number/date/terms।
261. Qty × unit price × amount।
262. Sharp decimal unit price।
263. Configurable decimal precision।
264. Subtotal/tax/shipping/total।
265. Amount in words।
266. Remit To/bank information।
267. Tax ID/EIN।
268. PO number reference।
269. Terms & Conditions block।
270. Multi-layout template।
271. Print-perfect A4/Letter।

# P15. Account security (২৭২–২৭৭)

272. Account holder-এর জন্য TOTP 2FA।
273. QR setup/backup code।
274. 2FA recovery।
275. Google OAuth login।
276. GitHub OAuth login।
277. Active-session management।

# P16. GDPR ও compliance (২৭৮–২৮২)

278. Data export request।
279. Account-delete request।
280. Consent management।
281. Cookie banner।
282. Data-retention policy।

# P17. Monitoring ও testing (২৮৩–২৮৯)

283. Sentry error monitoring।
284. Performance tracing।
285. Vitest unit test।
286. Integration test।
287. Playwright E2E test।
288. GitHub Actions CI।
289. Health-check endpoint।

# P18. Hosting flexibility (২৯০–২৯৫)

290. Docker self-hosting।
291. Dev/prod docker-compose।
292. Nginx reverse proxy ও SSL।
293. VPS deployment guide।
294. Vercel-compatible build।
295. যেকোনো domain DNS pointing।

# R1. Trial, plan limit ও monetization (২৯৬–৩০৬)

296. 14 দিনের free trial।
297. Trial থেকে Free auto downgrade।
298. Downgrade-এ কখনো lock নয়।
299. Plan-limit enforcement।
300. Usage meter ও quota bar।
301. Limit-এ upgrade prompt।
302. Checkout coupon redemption।
303. Prorated upgrade/downgrade।
304. Failed-payment dunning।
305. Renewal reminder email।
306. No-login free invoice generator।

# R2. Notification ও realtime (৩০৭–৩১৩)

307. In-app notification center।
308. Bell ও unread count।
309. Supabase Realtime update।
310. Email queue processor।
311. Bounce/complaint handling।
312. Unsubscribe management।
313. Email/WhatsApp opt-in consent।

# R3. Billing lifecycle (৩১৪–৩২৪)

314. Payment-reminder schedule।
315. Auto late-fee।
316. Instalment/payment plan।
317. Debit note।
318. Pro forma invoice।
319. Advance/deposit invoice।
320. Client credit balance।
321. Write-off/bad debt।
322. Estimate/credit-note/PO-এর আলাদা number series।
323. Auto exchange-rate update।
324. Multi-currency conversion display।

# R4. Tax ও compliance (৩২৫–৩৩১)

325. Tax-rate management।
326. Compound/multi-tax।
327. US state sales tax।
328. VAT/GST number।
329. Tax-exempt client।
330. Fiscal-year setting।
331. Rounding-rule configuration।

# R5. Expanded report (৩৩২–৩৩৮)

332. AR aging report।
333. AP aging report।
334. Product-wise sales।
335. Client-wise profit।
336. Inventory valuation/COGS।
337. Scheduled emailed report।
338. Saved filter preset।

# R6. Expanded inventory (৩৩৯–৩৪৩)

339. Warehouse stock transfer।
340. SKU/barcode support।
341. Sales return/RMA।
342. Purchase return।
343. Packing slip/delivery note।

# R7. Team, permission ও multi-company (৩৪৪–৩৪৯)

344. Granular permission matrix।
345. Company activity log।
346. Multi-company switcher।
347. Client tag/group।
348. Timezone/date format।
349. Expense approval flow।

# R8. Super-admin expansion (৩৫০–৩৫৭)

350. User impersonation।
351. Announcement bar।
352. Audit-log export।
353. Storage-quota monitor।
354. Broadcast email।
355. Changelog page।
356. Platform-health dashboard।
357. Tenant support-ticket submission।

# R9. Navigation ও UX integrity (৩৫৮–৩৬৯)

358. Central navigation map।
359. সর্বত্র breadcrumb।
360. Active-state highlight।
361. Mobile drawer/bottom nav।
362. Command palette (Command/Control-K)।
363. Keyboard shortcut।
364. Zero dead-link audit।
365. Consistent back/cancel।
366. Onboarding checklist/tour।
367. WCAG accessibility ও focus ring।
368. Error boundary ও retry।
369. Confirmation-dialog pattern।

# R10. Security hardening (৩৭০–৩৭৫)

370. CSRF protection।
371. Security header ও CSP।
372. Brute-force lockout।
373. Suspicious-login alert।
374. Upload magic-byte validation।
375. Suspended/rate-limit page।

# R11. Performance ও SEO (৩৭৬–৩৮১)

376. ISR/revalidate cache।
377. Code split/lazy load।
378. Image optimization।
379. JSON-LD structured data।
380. PWA manifest।
381. Consent-gated analytics।

# R12. Developer experience (৩৮২–৩৮৫)

382. API playground।
383. Webhook test/ping।
384. Sandbox/test mode।
385. Demo seed data।

# R13. Additional cron (৩৮৬–৩৮৯)

386. Session-cleanup cron।
387. DB-backup cron।
388. Data-deletion cron।
389. Estimate-expiry cron।

# S1. Pluggable gateway framework (৩৯০–৪০১)

390. NMI gateway integration।
391. NMI Three-Step Redirect।
392. NMI Direct Post।
393. NMI tokenization।
394. NMI recurring billing।
395. Pluggable gateway adapter।
396. Admin custom gateway add।
397. JSON-driven gateway config schema।
398. Enable/disable toggle।
399. Sandbox/test mode।
400. Gateway health/error log।
401. Default gateway priority।

# S2. Local payment: bKash/Nagad (৪০২–৪০৮)

402. bKash payment acceptance।
403. Nagad payment acceptance।
404. bKash/Nagad payout।
405. Super-admin global toggle।
406. Tenant-level toggle।
407. Manual transaction verification।
408. Country-based gateway visibility।

# S3. English-only interface (৪০৯–৪১১)

409. English-only UI policy।
410. Bengali-detection lint guard।
411. Central strings file।

# S4. Tenant-এর client subscription billing (৪১২–৪১৯)

412. Client subscription plan।
413. Auto-charge recurring billing।
414. Client record-এ saved-card token ও mandate-link consent।
415. Autopay authorization।
416. Pause/resume/cancel।
417. Proration calculation।
418. Failed-charge retry।
419. Subscription MRR report।

# S5. Payment experience (৪২০–৪২৬)

420. Standalone payment link।
421. Hosted checkout page।
422. Partial refund।
423. Multi-invoice allocation।
424. Surcharge/convenience fee।
425. Auto receipt email।
426. Apple Pay/Google Pay।

# S6. MoR risk ও settlement (৪২৭–৪৪০)

427. Merchant onboarding।
428. Versioned MoR agreement acceptance।
429. Risk scoring।
430. Velocity/limit rule।
431. Fraud alert।
432. AML/sanction screening।
433. Transaction monitoring।
434. Settlement report।
435. Payout schedule/fee।
436. Chargeback evidence upload।
437. Dispute timeline।
438. Negative-balance recovery।
439. Card data সংরক্ষণ নয়, PCI-safe।
440. Reconciliation dashboard।

# S7. Document integrity ও workflow (৪৪১–৪৫০)

441. Sent invoice immutable lock।
442. Revision history।
443. Invoice approval workflow।
444. Draft autosave।
445. Duplicate detection।
446. Trash/restore UI।
447. Yearly number reset।
448. Estimate approval e-signature।
449. Bulk email send।
450. Email open tracking।

# S8. Support ও help (৪৫১–৪৫৬)

451. Help center/search।
452. In-app help widget।
453. Ticket priority/SLA।
454. Canned response।
455. Email-to-ticket।
456. NPS/feedback collection।

# S9. Marketing ও growth (৪৫৭–৪৬৪)

457. Customer referral programme।
458. Newsletter signup।
459. Lead-capture form।
460. Demo/contact-sales flow।
461. UTM tracking।
462. Integration directory।
463. Partner page।
464. Press/brand kit।

# S10. Legal ও trust (৪৬৫–৪৭৪)

465. Footer company legal information।
466. Security page।
467. DPA page।
468. Subprocessor list।
469. Cookie policy।
470. Accessibility statement।
471. `security.txt`।
472. Terms version/acceptance log।
473. Platform subscription invoice/receipt।
474. SaaS VAT/tax invoice।

# S11. Platform engineering (৪৭৫–৪৮২)

475. Background job queue।
476. Async export center।
477. Cron monitoring/alert।
478. Feature flag।
479. Configuration/secret management।
480. Data retention/archive।
481. Migration versioning।
482. Uptime monitoring hook।

# চূড়ান্ত role model ও reconciliation

- `super_admin`: KD SOLUTION IT operator; পুরো platform, tenant, MoR, KYC ও CMS।
- `owner`: নিজের company-এর সব resource, billing, gateway, staff ও KYC।
- `staff`: owner নির্ধারিত granular permission অনুযায়ী।
- `affiliate`: শুধু referral dashboard।
- Client কোনো account role পাবে না; signed, expiring token link ব্যবহার করবে।
- পরের scope-এ reseller ও accountant access-ও আছে। Schema চূড়ান্তের আগে এটি full role, constrained staff preset, নাকি delegated access type হবে তা চূড়ান্ত করতে হবে; capability বাদ যাবে না।

## Client access-এর স্থির পরিবর্তন

- আলাদা client login বাতিল।
- Magic link বদলে login-বিহীন signed token link।
- Client document list token-authorized public page হবে।
- Payment, receipt, payment history ও estimate approval সব token link-এ হবে।
- 2FA শুধু account holder-এর জন্য, token-link visitor-এর জন্য নয়।
- Saved card token client record-এ থাকবে এবং mandate link দিয়ে consent নেওয়া হবে।
- Client Portal-এর নাম Client Access (tokenized)।

# T1. Tokenized client access (৪৮৩–৪৯৪)

483. HMAC-signed access token।
484. প্রতি document-এর unique link।
485. Token-expiry setting।
486. Token revoke/reissue।
487. Optional email-OTP gate।
488. সব invoice-এর client-hub link।
489. Link-open/document-view log।
490. IP ও user-agent audit।
491. Token rate-limit/brute guard।
492. Search-engine noindex।
493. Expired-link re-request page।
494. Branded client-facing shell।

# T2. Client email journey (৪৯৫–৫০২)

495. Link-সহ invoice mail।
496. Estimate approval link।
497. Payment reminder link।
498. Receipt/confirmation mail।
499. Subscription mandate link।
500. Statement mail।
501. প্রতি email delivery status।
502. Resend/copy-link action।

# T3. Staff ও কাজভিত্তিক email routing (৫০৩–৫০৯)

503. Staff invite email।
504. Sales/Accounts/Support permission preset।
505. Assignment notification।
506. Action-based email rule।
507. Staff-wise activity log।
508. Plan-based staff-seat limit।
509. Data রেখে staff deactivate।

# T4. KYC-শর্তসাপেক্ষ gateway routing (৫১০–৫১৬)

510. Default own gateway বাধ্যতামূলক।
511. KYC verified হলে MoR unlock।
512. MoR term/limit config।
513. Per-merchant fee override।
514. Gateway fallback chain।
515. Checkout-এ payment-method selection।
516. Risk হলে MoR suspend।

# U1. Blind affiliate role (৫১৭–৫২৩)

517. Affiliate শুধু নিজের referral account দেখবে।
518. Referred company name গোপন।
519. Company activity গোপন।
520. শুধু click ও signup count।
521. শুধু commission/payout data।
522. Invoice/client data নয়।
523. Dedicated affiliate RLS।

# U2. Owner-only send (৫২৪–৫২৭)

524. শুধু owner external email পাঠাবে।
525. Staff draft করবে, send নয়।
526. Request-send approval flow।
527. Unauthorised staff-এর send control hidden।

# U3. Batch/bulk send (৫২৮–৫৩৫)

528. Multi-select invoice।
529. Batch send queue।
530. Batch progress bar।
531. প্রতি email success/fail result।
532. Failed email retry।
533. Scheduled batch send।
534. Duplicate-send guard।
535. Batch history log।

# U4. Sent-versus-paid dashboard (৫৩৬–৫৪৭)

536. মোট sent invoice।
537. Paid count।
538. Unpaid count।
539. Overdue count।
540. Viewed count।
541. Failed-email count।
542. Billed বনাম collected amount।
543. Collection rate।
544. Average payment days।
545. Batch performance।
546. Date-range filter।
547. Drill-down list।

# U5. কঠোর tenant isolation (৫৪৮–৫৫৬)

548. এক owner অন্য owner-এর data দেখবে না।
549. প্রতি tenant query-তে `company_id` বাধ্যতামূলক।
550. Default-deny RLS।
551. Cross-tenant ID-তে 404।
552. Tenant-isolated storage path।
553. Shared table-এও tenant scope।
554. Automated isolation test।
555. Search/export tenant guard।
556. শুধু `super_admin` global view।

# V1. Payment-এর আগে consent evidence (৫৫৮–৫৬৮)

558. বাধ্যতামূলক consent checkbox।
559. Goods/services received confirmation।
560. Invoice detail পড়ার confirmation।
561. Versioned terms snapshot acceptance।
562. Refund-policy acceptance।
563. Checkbox ছাড়া Pay disabled।
564. UTC consent timestamp।
565. IP ও geolocation record।
566. Device/user-agent fingerprint।
567. প্রদর্শিত consent text-এর exact copy।
568. Immutable consent record।

# V2. Delivery ও acceptance evidence (৫৬৯–৫৭৬)

569. Delivery-confirmation field।
570. Work-completion/acceptance acknowledgement।
571. Optional client e-signature।
572. Estimate-approval record।
573. Owner delivery-proof upload।
574. Tracking number।
575. Service-completion date।
576. Client acceptance-link confirmation।

# V3. Tamper-evident audit chain (৫৭৭–৫৮৫)

577. Email-send evidence/message ID।
578. Email-delivery receipt।
579. Invoice-open/view timestamp।
580. প্রতি view-এর IP log।
581. Payment-page visit log।
582. Complete event timeline।
583. Tamper-proof hash-chain audit।
584. Invoice-PDF hash।
585. Consent-screen-state snapshot।

# V4. One-click dispute evidence pack (৫৮৬–৫৯৩)

586. Generate Evidence Pack button।
587. Invoice+consent+timeline PDF।
588. Stripe/PayPal gateway-ready format।
589. Screenshot-সদৃশ consent render।
590. Email-thread attachment।
591. Delivery-proof attachment।
592. Evidence pack download/send।
593. প্রতি dispute-এর case file।

# V5. Dispute prevention (৫৯৪–৬০৩)

594. Clear statement descriptor।
595. Instant receipt email।
596. Receipt-এ owner contact।
597. Contact seller first message।
598. Payment-এর আগে refund policy।
599. Direct refund-request link।
600. Owner rapid-refund tool।
601. High-risk transaction alert।
602. Unusual-amount flag।
603. New-client velocity check।

# V6. Legal ও financial protection (৬০৪–৬০৯)

604. Payment authorization record।
605. Chargeback reserve calculation।
606. Dispute rate monitor, 0.65%-এর নিচে।
607. High-rate merchant alert।
608. 18-month evidence retention।
609. Super-admin dispute center।

# W. Design ও navigation standard (৬১০–৬৪৫)

## W1. Layout architecture (৬১০–৬২০)

610. Fixed left app sidebar।
611. Sidebar 264px, collapsed 72px।
612. Sticky 64px topbar।
613. Content max-width 1280px centered।
614. Form page max-width 768px centered।
615. Auth page: centered card ও brand panel।
616. Public page: full-width section ও centered inner container।
617. Standard header: title, breadcrumb, action।
618. ডানে primary action।
619. 4/8/12/16/24/32 spacing scale।
620. 12-column grid, gap 24।

## W2. Navigation integrity (৬২১–৬৩০)

621. এক central nav-map file।
622. সব route nav-map-এ register।
623. Nav-map থেকে auto breadcrumb।
624. Active ও parent-active highlight।
625. Role-based menu filter।
626. Build-time link validation।
627. Zero-dead-link audit script।
628. Consistent back/cancel।
629. Sheet mobile drawer।
630. Settings/detail tab-navigation pattern।

## W3. সম্পূর্ণ page state (৬৩১–৬৩৮)

631. সব page-এ loading skeleton।
632. Error ও retry।
633. Empty state ও CTA।
634. Success state।
635. Blank white screen নয়।
636. Coming-soon page নয়।
637. সব table-এ pagination/sort/filter।
638. সব form-এ inline validation ও invalid হলে disabled submit।

## W4. সম্পূর্ণ English content (৬৩৯–৬৪৫)

639. বাস্তব copy, filler text নয়।
640. সব button/label/tooltip লেখা।
641. সব error/success message লেখা।
642. সব email template-এ পূর্ণ copy।
643. CMS legal page-এ বাস্তব legal content।
644. Code-এ Bengali lint block।
645. UI/DB seed/comment সব English।

# X. Mobile-first standard (৬৪৬–৬৭০)

646. Mobile-first CSS।
647. 320/375/430/768/1024/1280/1920 breakpoint।
648. Hamburger/sliding drawer।
649. পাঁচ-item primary bottom navigation।
650. iOS safe-area inset।
651. Mobile-এ table থেকে card list।
652. Horizontal scroll-এ sticky first column।
653. Mobile full-screen Sheet dialog।
654. Form sticky bottom action bar।
655. 44×44px touch target।
656. Thumb-zone action placement।
657. Numeric/email input keyboard।
658. iOS zoom রোধে 16px input font।
659. Mobile invoice-form stepper।
660. List-item swipe action।
661. Pull-to-refresh।
662. Mobile chart optimization।
663. Mobile PDF preview।
664. Apple/Google Pay mobile payment page।
665. Offline banner।
666. Lazy image/`srcset`।
667. Mobile LCP under 2.5s priority।
668. Reduced-motion support।
669. Landscape handling।
670. সব page 320px test।

# Y1. Secret ও key management (৬৭১–৬৮০)

671. Key-vault abstraction।
672. `ENCRYPTION_KEY` কখনো rotate নয়।
673. অন্য key rotation support।
674. Encrypted field key-version tag।
675. Service role শুধু server-এ।
676. Client bundle secret-leak scan।
677. Boot-এ ENV schema validation।
678. Missing ENV হলে fail-fast।
679. প্রতি environment-এ আলাদা key।
680. Secret-access audit।

# Y2. Application security (৬৮১–৬৯৭)

681. Ownership-check IDOR guard।
682. Parameterised query SQL-injection protection।
683. Webhook/ecommerce URL SSRF guard।
684. Output encoding XSS protection।
685. Nonce-based CSP।
686. `frame-ancestors` clickjacking guard।
687. Strict CORS allowlist।
688. Open-redirect prevention।
689. Zod strip mass-assignment guard।
690. Prototype-pollution guard।
691. ReDoS-safe regex।
692. Magic-byte ও extension match।
693. SVG sanitize/re-encode।
694. Malware-scan hook।
695. ZIP-bomb/large-file guard।
696. Webhook replay window ±5 minute।
697. API idempotency key।

# Y3. Access control ও session (৬৯৮–৭০৯)

698. সর্বত্র server-side permission check।
699. UI hide নিরাপত্তা নয়।
700. Sensitive action-এ step-up 2FA।
701. Super-admin action-এ বাধ্যতামূলক 2FA।
702. Optional admin IP allowlist।
703. Impersonation banner/expiry।
704. Read-only impersonation mode।
705. Session-fixation prevention।
706. Password change-এ সব session revoke।
707. Password policy/breach check।
708. Login velocity/CAPTCHA।
709. Account recovery process।

# Y4. Data protection ও privacy (৭১০–৭২০)

710. Log থেকে PII redact।
711. Sentry PII scrub।
712. Encryption at rest confirmation।
713. Encrypted backup।
714. Short-lived storage signed URL।
715. Download rate limit।
716. Export watermark ও expiry।
717. Immutable append-only audit log।
718. Data-retention schedule।
719. Right-to-delete certificate।
720. Cross-tenant fuzz test।

# Y5. Supply-chain ও CI security (৭২১–৭২৯)

721. `npm audit` CI gate।
722. Dependency pin/lockfile।
723. Dependabot/update policy।
724. CI secret scan।
725. SAST static scan।
726. Licence-compliance check।
727. SBOM generation।
728. Reproducible build।
729. Protected branch/review policy।

# Y6. Email deliverability (৭৩০–৭৩৮)

730. SPF/DKIM/DMARC setup guide।
731. Domain-verification checklist।
732. Suppression list।
733. Hard/soft-bounce policy।
734. Complaint/FBL handling।
735. Plain-text email alternative।
736. List-Unsubscribe header।
737. Spam-score pre-check।
738. Send-rate throttle।

# Y7. Financial accuracy ও compliance (৭৩৯–৭৫২)

739. Gapless sequential numbering।
740. Numbering race-condition lock।
741. Double-submit/duplicate-charge guard।
742. Bankers’ rounding।
743. Line-versus-total rounding policy।
744. Multi-currency FX gain/loss।
745. Historical-rate freeze।
746. Accounting-period lock।
747. Financial-close process।
748. Client credit limit।
749. Multi-level dunning ladder।
750. Tax-filing export।
751. Seven-year legal archive।
752. Payment-allocation audit।

# Y8. Design QA ও consistency (৭৫৩–৭৬৭)

753. এক spacing/radius/shadow scale।
754. Contrast at least 4.5:1।
755. Complete dark-mode parity।
756. এক icon set, Lucide।
757. এক illustration style।
758. Motion duration/easing system।
759. Consistent toast position।
760. Form-pattern guide।
761. Table-density standard।
762. Central date/number/currency format।
763. Timezone-display policy।
764. এক error-message catalogue।
765. Microcopy guide।
766. Skip-link/focus management।
767. Visual-regression snapshot।

# Y9. Performance budget (৭৬৮–৭৭৬)

768. Lighthouse ≥90।
769. LCP <2.5s, INP <200ms, CLS <0.1।
770. Bundle-size budget/analyser।
771. N+1 prevention।
772. Index-coverage audit।
773. Large list cursor pagination।
774. Server-side filter/sort।
775. Cache layer/invalidation map।
776. Heavy component dynamic import।

# Y10. Observability ও incident (৭৭৭–৭৮৭)

777. Structured log/request ID।
778. Payment success-rateসহ metrics।
779. Alert rule/threshold।
780. Webhook-failure alert।
781. Cron-failure alert।
782. Uptime check/status auto-update।
783. Error-budget dashboard।
784. Incident runbook।
785. Disaster recovery RTO/RPO।
786. Backup-restore drill।
787. Postmortem template।

# Y11. Customer lifecycle ও offboarding (৭৮৮–৭৯৫)

788. Account-close request।
789. Offboarding data export।
790. Grace period/restoration।
791. Complete tenant-deletion job।
792. Data-migration import tool।
793. Seat/usage billing reconciliation।
794. Suspended tenant read-only mode।
795. Abuse-handling policy।

# Y12. Delivery quality gate (৭৯৬–৮০৫)

796. প্রতি phase-এর definition of done।
797. `tsc --noEmit` green।
798. Next production build green।
799. ESLint zero error।
800. Bengali scan zero।
801. Unfinished-marker scan zero।
802. Dead-link scan zero।
803. 320px screenshot check।
804. Automated accessibility audit pass।
805. Phase-based smoke test।

# Z1. Netlify/runtime বাস্তবতা (৮০৬–৮১৭)

806. Netlify Function 10s/26s timeout strategy।
807. Long work background function-এ।
808. Raw webhook body preserve।
809. 6MB-এর বেশি direct-to-storage upload।
810. Large export async/signed URL।
811. Netlify Scheduled Function বনাম `pg_cron` নির্বাচন।
812. Netlify-compatible ISR/revalidate।
813. Edge/Node runtime map।
814. Cold-start reduction।
815. Supabase pgBouncer pooling।
816. Serverless connection-leak prevention।
817. Netlify/Vercel/Docker parity test।

# Z2. Database engineering rigor (৮১৮–৮৩২)

818. Money `numeric(18,4)`, float নয়।
819. সব timestamp UTC `TIMESTAMPTZ`।
820. UUID v7।
821. Soft-delete partial unique index।
822. Enum বনাম lookup-table evolution policy।
823. Zero-downtime migration rule।
824. Migration rollback script।
825. Idempotent seed।
826. Negative/range check constraint।
827. সব FK index।
828. `deleted_at IS NULL` partial index।
829. Postgres FTS/`pg_trgm` search।
830. RLS `auth` wrapping performance।
831. Query/statement timeout।
832. Dead-tuple/VACUUM monitor।

# Z3. Concurrency ও race condition (৮৩৩–৮৪১)

833. Invoice-number advisory lock।
834. Version-column optimistic locking।
835. Simultaneous edit conflict message।
836. Stock row lock।
837. Wallet serialized update।
838. Double-click payment guard।
839. `FOR UPDATE SKIP LOCKED` DB queue।
840. Cron leader lock।
841. Processed-webhook-event table।

# Z4. Amazon-grade invoice legal accuracy (৮৪২–৮৫৭)

842. Tax-inclusive/exclusive mode।
843. Tax-এর আগে/পরে discount config।
844. Shipping taxable toggle।
845. Withholding tax field।
846. Rounding-adjustment line।
847. Negative line/credit handling।
848. Overpayment থেকে credit balance।
849. Unit of Measure।
850. Optional HS/SAC code।
851. Invoice-এ item code/SKU।
852. Seller tax registration।
853. Bank/SWIFT/routing Remit-To block।
854. Clear net terms।
855. Client currency বনাম company currency।
856. Rate-wise tax-breakdown table।
857. Month-end/leap-year recurring rule।

# Z5. PDF ও print engine (৮৫৮–৮৬৭)

858. Reliable server-side PDF।
859. Font embed/Unicode।
860. Multi-page table repeat header।
861. Page-break control।
862. Page X of Y footer।
863. A4/Letter toggle।
864. `@page` margin/print CSS।
865. Sent-time PDF snapshot।
866. PDF checksum/hash।
867. Regeneration versus archive policy।

# Z6. Email identity ও anti-abuse (৮৬৮–৮৭৯)

868. From: “Tenant via KD SOLUTION IT”।
869. Tenant email Reply-To।
870. CAN-SPAM platform address।
871. Marketing email unsubscribe link।
872. Verified email ছাড়া send নয়।
873. New-tenant send limit।
874. Phishing/spam content scan।
875. Link-domain allowlist।
876. Abuse-report endpoint।
877. Brand-impersonation prevention।
878. CMS/blog/upload moderation।
879. Sent-email exact snapshot।

# Z7. Entitlement ও monetization (৮৮০–৮৯০)

880. Central entitlement engine।
881. Plan×feature matrix।
882. Locked-feature upsell UI।
883. Server-side entitlement guard।
884. Overage/usage billing।
885. Add-on marketplace structure।
886. Powered by KD SOLUTION IT badge।
887. Badge remove paid feature।
888. White-label tier।
889. Plan-gated custom domain।
890. Tenant sending-domain add-on।

# Z8. Tenant lifecycle ও growth (৮৯১–৯০০)

891. Company ownership transfer।
892. Billing contact বনাম owner।
893. Cancel flow/reason।
894. Win-back offer।
895. Day 1/3/7 onboarding drip email।
896. Demo-data toggle।
897. First-run product tour।
898. In-app changelog widget।
899. Feature-request board।
900. Role×event notification matrix।

# Z9. Admin intelligence (৯০১–৯০৮)

901. Cross-tenant global search।
902. Tenant health score।
903. Churn-risk signal।
904. MRR/ARR/LTV/cohort।
905. Gateway-wise success rate।
906. Support tenant-data export।
907. Impersonation consent/audit।
908. Admin-action undo window।

# Z10. Legal ও consent evidence (৯০৯–৯১৭)

909. Signup terms/IP log।
910. Terms change-এ re-consent।
911. Tenant DPA acceptance।
912. Subprocessor-change notice।
913. Granular cookie category।
914. Cookie-consent evidence।
915. Cookie-free analytics alternative।
916. SLA/uptime page।
917. MoR responsibility disclosure।

# Z11. Developer interface (৯১৮–৯২৩)

918. OpenAPI 3.1 spec।
919. Postman collection।
920. API versioning/deprecation policy।
921. Zapier/Make recipe docs।
922. Webhook payload example।
923. Error-code reference table।

# Z12. Final polish (৯২৪–৯৩০)

924. সব mail-এর client-communication log।
925. Failed payment-এ alternative method UX।
926. Partial payment remaining-balance link।
927. Keyboard-shortcut reference page।
928. PWA install prompt।
929. Offline page।
930. `aria-live` form-error announcement।

# AA1. Token leak ও link security (৯৩১–৯৩৯)

931. Token page-এ `Referrer-Policy: no-referrer`।
932. External link-এ `rel="noopener noreferrer"`।
933. Token URL-এ কখনো PII নয়।
934. Enumeration ঠেকাতে minimum 128-bit token।
935. Log/analytics-এ token mask।
936. Gateway redirect-এ token নয়।
937. PDF-এ tracking pixel নিষেধ।
938. Email-forwarding leak-warning policy।
939. Plan-based token expiry।

# AA2. Payment-engineering depth (৯৪০–৯৫৩)

940. JPY/KRW-এর মতো zero-decimal currency।
941. Minor-unit conversion layer।
942. PCI SAQ-A scope declaration।
943. Server-এ card data নয়, hosted field।
944. Stripe Connect/direct-key mode।
945. MoR platform-account routing।
946. Settlement-এর পর refund handling।
947. Refund platform-fee policy।
948. Minimum payout threshold।
949. Payout FX/conversion fee।
950. Failed-payout reversal।
951. Gateway payout/transaction reconciliation।
952. Partial-capture/authorisation-only।
953. Sandbox test-card documentation।

# AA3. Tax ও international compliance (৯৫৪–৯৬৪)

954. EU reverse-charge।
955. VIES VAT-ID hook।
956. US sales-tax nexus।
957. Marketplace-facilitator disclosure।
958. 1099-K/merchant tax report।
959. Country-specific COA template।
960. Tax-exemption certificate upload।
961. Separate platform invoice sequence।
962. Auditor legal-archive export।
963. Data-residency choice।
964. Country-wise mandatory invoice field।

# AA4. KYC/AML ও maker-checker (৯৬৫–৯৭৬)

965. Business-registration document।
966. Beneficial-owner information।
967. Proof of address।
968. Document expiry/re-verification cycle।
969. Document-hash duplicate detect।
970. Multiple tenant-এ একই bank account flag।
971. Reused device fingerprint detect।
972. Periodic sanction re-screen।
973. KYC document read audit।
974. Large payout four-eyes approval।
975. Maker-checker workflow।
976. Admin undo/reversal log।

# AA5. Form ও data-safety UX (৯৭৭–৯৮৮)

977. Unsaved-change navigation guard।
978. `beforeunload` warning।
979. Crash-পরবর্তী draft recovery।
980. Duplicate-tab detection।
981. Multi-tab session sync।
982. Token-refresh race handling।
983. Destructive action 5-second undo।
984. Count-সহ bulk-action confirmation।
985. Optimistic UI/rollback।
986. Autosave indicator।
987. Realtime reconnect backoff।
988. Co-editing presence indicator।

# AA6. Data migration ও opening balance (৯৮৯–৯৯৭)

989. QuickBooks/Zoho/Wave CSV import।
990. Column-mapping wizard।
991. Import preview/validation report।
992. Import rollback।
993. Legacy invoice number preserve।
994. Client opening balance।
995. Account opening balance।
996. Historical payment import।
997. Import duplicate detection।

# AA7. Service-business billing (৯৯৮–১০০৮)

998. Project/job tracking।
999. Timer/manual time tracking।
1000. Billable hour থেকে invoice।
1001. Staff/project hourly rate।
1002. Timesheet approval।
1003. Milestone billing।
1004. Retainer/prepaid hour।
1005. Reimbursable expense rebill।
1006. Project profitability report।
1007. Client-specific price list।
1008. Quantity-discount tier।

# AA8. Client data quality (১০০৯–১০১৬)

1009. Duplicate client detect।
1010. Client merge।
1011. Client archive।
1012. Do-not-contact flag।
1013. Per-client reminder opt-out।
1014. Bulk edit।
1015. Per-user saved view।
1016. Export-column chooser।

# AA9. Owner-controlled tenant security (১০১৭–১০২৫)

1017. Owner staff-2FA mandatory করতে পারবে।
1018. Owner staff password reset করতে পারবে।
1019. Owner staff-login activity দেখবে।
1020. Tenant IP restriction।
1021. Session-timeout config।
1022. Staff approval amount cap।
1023. Data export-এ owner approval।
1024. Future enterprise SSO/SAML flag।
1025. Device/session revoke।

# AA10. API maturity (১০২৬–১০৩৫)

1026. `X-RateLimit-*`/`Retry-After` header।
1027. Cursor-pagination standard।
1028. Filter/sort syntax spec।
1029. Sparse fieldset।
1030. Webhook signing-key rotation।
1031. Dead-letter queue।
1032. Per-event retry policy।
1033. API changelog।
1034. Stable error-code reference।
1035. API status/incident feed।

# AA11. Release, load ও cost ops (১০৩৬–১০৪৬)

1036. Feature-flag release।
1037. Canary/rapid rollback।
1038. Maintenance-window schedule/banner।
1039. Critical endpoint k6 load test।
1040. Declared load limit।
1041. Supabase usage monitor/alert।
1042. Resend quota monitor।
1043. Quota-end graceful degradation।
1044. CI tenant-isolation test।
1045. Visual-regression baseline।
1046. Isolated E2E seed tenant।

# AA12. Final gap (১০৪৭–১০৫২)

1047. Error-এ correlation ID।
1048. Ticket-এ correlation ID।
1049. Single-tenant restore।
1050. Multi-branch/location।
1051. Estimate-expiry reminder।
1052. Estimate attachment।

# BB. Storage, media, delivery ও file lifecycle (১০৫৩–১১১০)

## BB1. Storage abstraction — ১২টি requirement

- Provider-adapter layer থাকবে।
- Presigned/direct upload থাকবে।
- Storage migration tool থাকবে।
- প্রতি tenant-এর storage quota থাকবে।
- Provider fallback chain থাকবে।
- Business feature থেকে storage-provider configuration আলাদা থাকবে।
- Provider বদলালেও tenant isolation অক্ষুণ্ণ থাকবে।
- File metadata storage location থেকে আলাদা রাখা হবে।
- নিরাপদ provider migration করা যাবে।
- সব provider-এ একই signed-access policy হবে।
- কেন্দ্রীয়ভাবে tenant storage usage পরিমাপ হবে।
- Recoverable ও auditable transfer history রাখা হবে।

## BB2. Media optimisation — ১৪টি requirement

- সাধারণ ছবি AVIF-এ রূপান্তর হবে।
- সাধারণ ছবি WebP-তে রূপান্তর হবে।
- Upload-এর আগে browser-এ ছবি resize হবে।
- EXIF metadata বাদ দেওয়া হবে।
- GPS metadata বাদ দেওয়া হবে।
- Image variant তৈরি হবে।
- Thumbnail variant তৈরি হবে।
- Medium-size variant তৈরি হবে।
- Full-size variant তৈরি হবে।
- Responsive `srcset` দিয়ে image delivery হবে।
- PDF compression হবে।
- PDF font subset করা হবে।
- PDF image 150–200 DPI-তে downsample হবে।
- PDF object stream compress হবে।
- Print quality বজায় থাকবে।
- KYC scan OCR-readable quality-preserving mode-এ থাকবে।
- Video/audio upload বাতিল হবে।

## BB3. File lifecycle — ৯টি requirement

- Hash দিয়ে file deduplication হবে।
- File versioning থাকবে।
- Orphan file cleanup হবে।
- Archive storage tier থাকবে।
- File-retention policy থাকবে।
- File soft delete হবে।
- Soft-deleted file restore করা যাবে।
- Lifecycle ও restoration audit রাখা হবে।
- Deletion/retention প্রত্যেক tenant অনুযায়ী scoped হবে।

## BB4. Delivery ও CDN — ৭টি requirement

- CDN cache header সেট হবে।
- Signed URL-এর expiry থাকবে।
- Hotlinking প্রতিরোধ হবে।
- Bandwidth throttle হবে।
- Range request support থাকবে।
- Private content serve করার আগে authorisation হবে।
- সব provider-এ একই delivery policy বজায় থাকবে।

## BB5. Storage cost control — ৬টি requirement

- Storage-usage dashboard থাকবে।
- Near-quota alert থাকবে।
- Plan-based storage limit থাকবে।
- Overage policy থাকবে।
- Tenant-wise quota measurement হবে।
- Billing ও support-এর জন্য usage history থাকবে।

## BB6. File UX ও access audit — ১০টি requirement

- In-app PDF preview থাকবে।
- In-app image preview থাকবে।
- Drag-and-drop multi-upload থাকবে।
- Resumable upload থাকবে।
- Upload progress দেখা যাবে।
- Upload cancel করা যাবে।
- KYC-এর জন্য mobile-camera capture থাকবে।
- File-access audit থাকবে।
- Upload validation result দেখানো হবে।
- সব file action authorised ও tenant-scoped lifecycle মেনে চলবে।

# CC. First run, infrastructure, governance ও residual UX (১১১১–১১৬২)

## CC1. Platform first run — ৭টি requirement

- Super-admin setup wizard থাকবে।
- Wizard-এ platform branding setup হবে।
- Wizard-এ SMTP setup হবে।
- Wizard-এ gateway setup হবে।
- Wizard-এ plan setup হবে।
- Wizard-এ primary domain setup হবে।
- `/api/health` dependency check, build/version endpoint ও footer build hash থাকবে।

## CC2. Domain ও email infrastructure — ৮টি requirement

- Application ও marketing subdomain আলাদা থাকবে।
- Invoice-এর জন্য short-link domain থাকবে।
- `mail.` sending subdomain থাকবে।
- Bounce-handling subdomain থাকবে।
- DNS-record checklist থাকবে।
- DNS record automatic verification হবে।
- Tenant branding অনুযায়ী safe domain configuration হবে।
- Link, application ও email identity আলাদাভাবে configurable হবে।

## CC3. Abuse ও fraud prevention — ৯টি requirement

- Disposable email block হবে।
- Free-trial abuse detection হবে।
- One-time coupon rule enforce হবে।
- Referral fraud guard থাকবে।
- Optional phone verification থাকবে।
- Seat count নির্ভুলভাবে হিসাব হবে।
- Abuse signal log হবে।
- Suspicious account review-তে যাবে।
- Control চালু থাকলেও tenant data leak হবে না।

## CC4. Collection ও dunning depth — ৮টি requirement

- Tenant local time সকাল 9টায় reminder schedule হবে।
- Quiet hour মানা হবে।
- Business-day due date support হবে।
- Dunning-stage template থাকবে।
- Promise-to-pay date রাখা হবে।
- Collection note রাখা হবে।
- Client risk flag থাকবে।
- Statement PDF তৈরি হবে।

## CC5. Industry preset ও template library — ৭টি requirement

- Onboarding-এ service industry নির্বাচন করা যাবে।
- Onboarding-এ retail industry নির্বাচন করা যাবে।
- Onboarding-এ medical industry নির্বাচন করা যাবে।
- Industry অনুযায়ী chart of accounts preconfigure হবে।
- Industry অনুযায়ী tax preconfigure হবে।
- Industry অনুযায়ী invoice template preconfigure হবে।
- Terms library, note template ও email signature থাকবে।

## CC6. MoR fee transparency — ৬টি requirement

- প্রতি transaction-এ fee breakdown দেখা যাবে।
- Merchant-কে monthly fee invoice দেওয়া হবে।
- Payout schedule দেখা যাবে।
- Hold reason ব্যাখ্যা করা হবে।
- Wallet-statement PDF তৈরি হবে।
- Fee ও hold calculation audit করা যাবে।

## CC7. Documentation ও governance — ৫টি requirement

- ERD diagram থাকবে।
- Data dictionary থাকবে।
- Architecture Decision Record থাকবে।
- প্রতি feature-এর runbook থাকবে।
- Browser-support matrix থাকবে।

## CC8. বাকি UX — ২টি requirement

- Data table-এ full keyboard navigation থাকবে।
- Offline অবস্থায় timer persist করবে।

# DD. Marketing, SEO ও social (১১৬৩–১২৩৪)

## DD1. Analytics ও pixel — ১২টি requirement

- Google Analytics 4 integration থাকবে।
- Google Tag Manager integration থাকবে।
- Google Search Console verification থাকবে।
- Meta Pixel integration থাকবে।
- Server-side Conversions API থাকবে।
- TikTok Pixel থাকবে।
- LinkedIn Pixel থাকবে।
- X Pixel থাকবে।
- Microsoft Clarity ও heatmap integration থাকবে।
- Cookie consent অনুযায়ী tracking load হবে।
- Admin panel থেকে tracking ID বসানো যাবে।
- Analytics configuration ও consent state audit হবে।

## DD2. Deep SEO — ১৪টি requirement

- Organization JSON-LD থাকবে।
- Product ও SoftwareApplication JSON-LD থাকবে।
- FAQ, Breadcrumb, Article ও Review JSON-LD থাকবে।
- Canonical URL generate হবে।
- Dynamic OpenGraph image generate হবে।
- Twitter Card থাকবে।
- CMS ও blog-এর dynamic sitemap হবে।
- Robots rule control থাকবে।
- প্রতি page-এ admin meta editor থাকবে।
- Slug management ও 301 redirect থাকবে।
- Broken-link report থাকবে।
- Heading structure audit হবে।
- Image alt text বাধ্যতামূলক হবে।
- Core Web Vitals report, Google Business Profile ও Bing Webmaster link থাকবে।

## DD3. Social presence ও sharing — ১১টি requirement

- Footer social link admin-editable হবে।
- Header social link admin-editable হবে।
- Facebook share থাকবে।
- X share থাকবে।
- LinkedIn share থাকবে।
- WhatsApp share থাকবে।
- Telegram share থাকবে।
- Copy-link share থাকবে।
- Share-card preview থাকবে।
- Share your QR card flow থাকবে। (Owner decision অনুযায়ী QR business card module বর্তমান scope থেকে বাদ।)
- Invoice/estimate WhatsApp share, referral share kit ও social-proof widget থাকবে।

## DD4. Social-post automation — ১৫টি requirement

- Content calendar থাকবে।
- Multi-platform post composer থাকবে।
- Post scheduler থাকবে।
- Media library থাকবে।
- OAuth-token vault-সহ channel connection থাকবে।
- Facebook Page adapter থাকবে।
- Instagram adapter থাকবে।
- LinkedIn adapter থাকবে।
- X, Threads, Telegram ও Pinterest adapter থাকবে।
- Per-post analytics থাকবে।
- নতুন blog থেকে auto-post rule থাকবে।
- Repost/evergreen queue থাকবে।
- Approval flow থাকবে।
- Database ও UI skeleton এখনই থাকবে।
- Live third-party API পরে স্বাধীনভাবে চালু করা যাবে।

## DD5. Marketing automation — ১১টি requirement

- Email-campaign builder থাকবে।
- Segment ও list থাকবে।
- Drip sequence থাকবে।
- CMS-block দিয়ে landing-page builder থাকবে।
- Popup ও exit-intent থাকবে।
- Lead scoring থাকবে।
- Newsletter archive থাকবে।
- UTM builder থাকবে।
- UTM performance report থাকবে।
- Conversion-funnel report থাকবে।
- Marketing consent ও unsubscribe state মানা হবে।

## DD6. Conversion optimisation — ৯টি requirement

- Homepage/pricing A/B test framework থাকবে।
- CTA variant থাকবে।
- Trust badge থাকবে।
- Recently-signed-up social proof থাকবে।
- Google review request থাকবে।
- Testimonial manager থাকবে।
- Pricing calculator থাকবে।
- Chat/bot-widget hook থাকবে।
- Experiment measurement consent bypass করবে না।

# আরও ভবিষ্যৎ-প্রস্তুত চাহিদা

1. Invoice summary-এর জন্য AI-assistant hook।
2. Expense categorisation-এর জন্য AI-assistant hook।
3. Email draft-এর জন্য AI-assistant hook।
4. API key configured হলে AI provider activate হবে।
5. Reseller/white-label partner programme থাকবে।
6. Customer accountant-এর সীমিত access থাকবে।
7. Invoice/email design template marketplace থাকবে।
8. Zapier/Make integration থাকবে।
9. Quick invoice/timer Chrome extension থাকবে।
10. WhatsApp-এর পাশে SMS থাকবে।
11. WhatsApp-এর পাশে Telegram থাকবে।
12. WhatsApp-এর পাশে Viber থাকবে।
13. Auto reconciliation-এর জন্য bank-feed aggregator থাকবে।
14. Automated expense entry-এর জন্য receipt OCR থাকবে।
15. Contract ও e-sign module থাকবে।
16. BNPL/installment finance partner থাকবে।
17. Loyalty ও client-review collection automation থাকবে।
18. PWA থেকে পরে native mobile wrapper করা যাবে।
19. Video-course help academy থাকবে।
20. Community forum থাকবে।
21. Multilingual public-site readiness থাকবে।

# EE. নতুন module — সব stated capability সংরক্ষিত

> উৎসে EE-কে ১০২টি requirement, `১২৩৫–১৩৩৬` range বলা হলেও দশটি group-এর লেখা total ১১২। কোনো capability বাদ না দিয়ে সবগুলো নিচে রাখা হলো; final planning ADR-এ canonical ID range স্থির হবে।

## EE1. Reseller/white-label

- Reseller role থাকবে।
- Reseller dashboard থাকবে।
- Reseller-এর নিজস্ব brand থাকবে।
- Reseller-এর নিজস্ব logo থাকবে।
- Reseller-এর নিজস্ব domain থাকবে।
- Reseller-এর নিজস্ব pricing থাকবে।
- Reseller margin থাকবে।
- Reseller sub-tenant create করতে পারবে।
- Reseller sub-tenant manage করতে পারবে।
- Reseller billing থাকবে।
- Reseller commission হিসাব হবে।
- Reseller support inbox থাকবে।
- Qualifying tier-এ সম্পূর্ণ platform branding সরানো যাবে।
- Reseller approval flow থাকবে।
- Revenue-share report থাকবে।
- Platform-level audit control থাকবে।
- Sub-tenant isolation থাকবে।
- White-label feature plan-gated হবে এবং reseller config tenant branding থেকে আলাদা থাকবে।

## EE2. Accountant access

- Read ও journal permission-সহ accountant access profile থাকবে।
- এক accountant login বহু company-তে কাজ করবে।
- Company switcher থাকবে।
- Owner accountant invite করতে পারবে।
- Owner accountant access revoke করতে পারবে।
- Accounting-period lock মানা হবে।
- Accountant শুধু accounting module দেখবে।
- Accountant activity log থাকবে।
- Tax-filing export থাকবে।
- প্রতি assignment-এ company scope enforce হবে।
- Approval ও export-এ owner control থাকবে।

## EE3. Template marketplace

- Invoice-design template থাকবে।
- Email template থাকবে।
- Document template থাকবে।
- Free template থাকবে।
- Paid template থাকবে।
- Template install করা যাবে।
- Template preview করা যাবে।
- Author profile থাকবে।
- Rating থাকবে।
- Author revenue share থাকবে।
- Admin moderation থাকবে।
- Template versioning থাকবে।

## EE4. Integration ecosystem

- Trigger/action-সহ Zapier app থাকবে।
- Make.com module থাকবে।
- Quick invoice/timer Chrome extension থাকবে।
- OAuth app registration থাকবে।
- Public app directory থাকবে।
- Developer portal থাকবে।
- Integration credential vault-এ থাকবে।
- Connected-app audit থাকবে।
- Integration-event documentation থাকবে।
- Scoped API permission থাকবে।

## EE5. Multi-channel messaging

- Twilio-compatible SMS adapter থাকবে।
- Telegram Bot channel থাকবে।
- Viber channel থাকবে।
- এক channel-routing engine থাকবে।
- WhatsApp থেকে SMS fallback থাকবে।
- SMS থেকে email fallback থাকবে।
- Per-client channel preference থাকবে।
- Channel-cost tracking থাকবে।
- Quiet hour মানা হবে।
- Cross-channel delivery state থাকবে।
- Messaging consent এবং routing/delivery audit log থাকবে।

## EE6. Bank feed ও reconciliation

- Plaid bank-aggregator adapter থাকবে।
- Salt Edge bank-aggregator adapter থাকবে।
- CSV bank-feed adapter থাকবে।
- Bank transaction auto import হবে।
- Invoice-to-payment smart matching হবে।
- Match suggestion থাকবে।
- Bulk reconciliation হবে।
- Bank-rule engine থাকবে।
- Unmatched queue থাকবে।
- Balance reconciliation হবে।
- Match decision audit হবে।
- Manual correction হবে।
- Tenant-owned encrypted bank connection ও reconciliation-change audit থাকবে।

## EE7. Receipt OCR ও smart entry

- Receipt থেকে field extraction হবে।
- Mobile-camera capture থাকবে।
- Vendor detect হবে।
- Date detect হবে।
- VAT detect হবে।
- Auto category হবে।
- Confidence score থাকবে।
- Manual correction করা যাবে।
- Duplicate receipt detect ও bulk upload হবে।

## EE8. Contract ও electronic signature

- Contract template থাকবে।
- Merge field থাকবে।
- Contract send ও track করা যাবে।
- Audit-trail, IP ও timestamp-সহ e-signature থাকবে।
- Multiple signer থাকবে।
- Signing order নির্ধারণ করা যাবে।
- Signed-PDF seal হবে।
- Expiry reminder থাকবে।
- Renewal reminder থাকবে।
- Contract-to-invoice link থাকবে।
- Signed-document snapshot থাকবে।
- প্রয়োজনে account-বিহীন tokenized signing থাকবে।

## EE9. BNPL/installment finance

- Klarna/Afterpay-ধাঁচের partner adapter থাকবে।
- Eligibility check হবে।
- Checkout-এ BNPL option থাকবে।
- Instalment schedule থাকবে।
- Partner settlement reconciliation হবে।
- Risk policy থাকবে।
- Fee policy থাকবে।
- Provider-neutral adapter boundary থাকবে।

## EE10. Loyalty ও review automation

- Payment-পরবর্তী review request যাবে।
- Google Review deep link থাকবে।
- Internal rating সংগ্রহ হবে।
- Negative feedback resolution-এর জন্য intercept হবে।
- Approved testimonial publish হবে।
- Loyalty point/credit দেওয়া হবে।
- Repeat client reward থাকবে।
- Review request consent-aware ও auditable হবে।

# Q. Deploy ও operations

Extended feature-set-এর পরে নিচের deploy/operations requirements থাকবে:

- Netlify deployment configuration।
- পূর্ণ `.env.example` template।
- `pg_dump` ব্যবহার করে `scripts/backup.sh`।
- `pg_restore` ব্যবহার করে `scripts/restore.sh`।
- Supabase migration এবং idempotent seed data।
- Recurring invoice processing cron।
- Overdue invoice ও reminder cron।
- Format যেখানে comment support করে সেখানে প্রতি source/configuration file-এর শুরুতে full path comment।
- Repository policy মেনে প্রতি সম্পন্ন file change-এর জন্য focused Git commit।

# Coverage ও integrity note

এই বাংলা তালিকায় core platform, design, public site, authentication, onboarding, CRM, invoice, estimate, payment, report, KYC, setting, super admin, email, security, WhatsApp, ecommerce, inventory, supplier, accounting, wallet/MoR, affiliate, public API, tokenized client access, blog/status, tenant branding, American/Amazon-style invoice, 2FA/OAuth/GDPR, testing, hosting, trial, realtime, billing lifecycle, tax, navigation, gateway, local payment, subscription, support, marketing, legal, engineering, consent evidence, mobile, secret/security/privacy, database, PDF, entitlement, storage/media, first-run infrastructure, SEO/social, reseller, accountant, marketplace, integrations, multi-channel, bank feed, OCR, contract, BNPL এবং loyalty—সব প্রদত্ত capability অন্তর্ভুক্ত আছে।
