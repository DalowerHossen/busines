# Rotating a key that has leaked

## Treat it as leaked if you are not sure

A key that appeared in a screenshot, a support ticket, a public repository
or a log is leaked. The cost of rotating unnecessarily is a few minutes; the
cost of not rotating is somebody else's money.

## The order matters

1. Create the replacement at the provider first. Do not revoke the old one
   yet.
2. In the connections console, press Rotate key on that integration and
   paste the new value. The old key keeps working for five minutes, which
   covers requests already in flight.
3. Press Test connection and confirm it answers.
4. Wait out the grace window, then revoke the old key at the provider.
5. Check the integration's last error and last used timestamps over the next
   few minutes.

## Keys that are not rotated this way

- **The Supabase service role key.** Change it at Supabase, update the
  environment variable, redeploy. There is no grace window, so do it in a
  quiet period.
- **The encryption key.** It is never rotated. Every stored secret is
  encrypted with it; changing it makes all of them unreadable. If it is ever
  genuinely compromised, every integration secret must be re-entered after
  the new key is deployed, and that is a planned migration rather than an
  incident response.

## Afterwards

Record in the audit trail why the key was rotated. The console already logs
who and when; only you can supply the why.
