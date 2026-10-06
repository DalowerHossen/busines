# Launch checklist

The platform console at `/admin/platform` computes most of this from the
configuration itself, so it cannot claim to be finished while something is
actually broken. This page is the version you can read on a phone.

## Before taking a single real payment

- [ ] The business is registered and has a business bank account.
- [ ] The payment partners have approved the account, and the keys are in
      the connections console rather than in a file somewhere.
- [ ] The domain is yours, and the application and sending records are
      verified in the platform console.
- [ ] Mail has been sent to a real inbox at a major provider and arrived in
      the inbox rather than the spam folder.
- [ ] The terms of service and privacy policy are published and reachable
      from the footer.
- [ ] The default plan a new signup lands on is set.
- [ ] Collection terms are set: the fee, the hold period and the withdrawal
      promise. These are what the business is committing to.
- [ ] A test invoice has been raised, paid by card, held, released and
      withdrawn end to end, with real money, by somebody who will notice if
      a figure is a penny out.

## Before telling anybody about it

- [ ] A monitor is pointed at the health endpoint and somebody is paged
      when it fails.
- [ ] Error reporting is receiving events and somebody reads them.
- [ ] A backup has been restored once, as a rehearsal, by the person who
      would have to do it in an emergency.
- [ ] Two people can administer the platform. One is a single point of
      failure, including on holiday.
- [ ] The support address on every outgoing email reaches somebody.

## In the first week

- [ ] Watch the signup funnel in the platform console. The step most new
      sellers stop on is the thing to fix next, whatever the plan said.
- [ ] Read the first ten support messages personally, whoever you are.
- [ ] Check the first real settlement by hand against the provider's
      dashboard: gross, provider fee, platform fee, seller share.
