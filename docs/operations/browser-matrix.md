# Browsers and devices we support

## What supported means

A supported browser renders every page correctly, completes every task, and
is tested before a release. An unsupported browser is not blocked; it simply
is not tested, and a visual defect in it is not an incident.

| Browser                                   | Versions                               | Level                         |
| ----------------------------------------- | -------------------------------------- | ----------------------------- |
| Chrome, Edge, and other Chromium browsers | The current and previous major version | Supported                     |
| Safari on macOS                           | The current and previous major version | Supported                     |
| Safari on iOS                             | The current and previous major version | Supported                     |
| Firefox                                   | The current and previous major version | Supported                     |
| Samsung Internet                          | The current major version              | Supported                     |
| Anything older                            | —                                      | Works or does not; not tested |
| Internet Explorer                         | —                                      | Not supported                 |

## Screens

Every page is built and checked from 320 pixels wide to 1920. The narrow end
is not an afterthought: a freelancer raising an invoice from a phone on a bus
is a normal user of this product, not an edge case. Touch targets are at
least forty four pixels in every direction.

## What we promise on a bad connection

- Every page has a loading state that appears immediately, so nothing looks
  frozen.
- A read that fails shows what it has along with a plain sentence saying
  what could not be read, rather than discarding the whole screen.
- No action is lost to a double press; actions that move money are
  idempotent at the database.

## Assistive technology

Pages are tested with the keyboard alone and with the screen reader built
into the operating system. Every control has a name, every error is
announced, and colour is never the only way something is communicated. The
target is the AA level of the accessibility guidelines, and the places we
fall short are defects rather than decisions.
