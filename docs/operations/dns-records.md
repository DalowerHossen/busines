# DNS records the owner must create

These are the records that have to exist before the platform works
properly on your own domain. The platform console at `/admin/platform`
generates the exact list for your domain and then checks it against the
public internet, so this page is the explanation rather than the source of
truth.

Replace `example.com` with the domain you own, and `your-site.netlify.app`
with the host your deployment gave you.

## The public website

| Type  | Name                 | Value                                                                   | Why                                                                                         |
| ----- | -------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| CNAME | `www.example.com`    | `your-site.netlify.app`                                                 | Points the public site at the application.                                                  |
| TXT   | `example.com`        | `v=spf1 include:_spf.mx.cloudflare.net -all`                            | Says which servers may send mail as this domain.                                            |
| TXT   | `_dmarc.example.com` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=s; aspf=s` | Tells receiving servers what to do with mail that fails the checks, and where to report it. |

## The application

| Type  | Name              | Value                   | Why                                                    |
| ----- | ----------------- | ----------------------- | ------------------------------------------------------ |
| CNAME | `app.example.com` | `your-site.netlify.app` | Where businesses sign in and where client links point. |

## Sending mail

This is the part that fails silently. Without it, invoices do not bounce;
they land in a spam folder and the seller concludes the product is broken.

| Type  | Name                                 | Value                                                  | Why                                                         |
| ----- | ------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------- |
| TXT   | `mail.example.com`                   | `v=spf1 include:_spf.mx.cloudflare.net -all`           | Authorises the sending service for this subdomain.          |
| CNAME | `resend._domainkey.mail.example.com` | the value your sending provider gives you              | Carries the signature that proves an invoice came from you. |
| TXT   | `_dmarc.mail.example.com`            | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com` | Reports on mail sent from the sending subdomain.            |
| MX    | `mail.example.com`                   | `10` and the host your provider gives you              | Receives the bounce reports. Optional but worth having.     |

## Optional, and useful

| Type  | Name                 | Value                     | Why                                                        |
| ----- | -------------------- | ------------------------- | ---------------------------------------------------------- |
| CNAME | `go.example.com`     | `your-site.netlify.app`   | The short domain used in reminders and messages.           |
| CNAME | `assets.example.com` | your content network host | Serves logos and generated documents closer to the reader. |

## Checking it worked

Open `/admin/platform`, enter your domain, and press Check the DNS. Each
record is looked up for real and anything missing is named. A new record can
take up to an hour to appear everywhere, so a failure immediately after
adding one is not necessarily a mistake.

## What this platform cannot do for you

Registering the domain, creating the records at your registrar, and
completing the identity checks your payment partners require. Those are
yours. Everything after them is ours.
