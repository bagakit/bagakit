# Git Message Craft MR Templates

Use these templates when the task needs Git-facing MR text that is durable,
high-signal, and safe to refresh without depending on prior chat memory.

Template classes:

- `title.*.md`
  - rewrite only the MR title
- `body.*.md`
  - draft one machine-managed MR summary block

Managed block markers:

```html
<!-- bagakit:git-message-craft:start -->
<!-- bagakit:git-message-craft:end -->
```

Selection guide:

- choose one title template only when the current title materially misstates
  the diff
- choose one body template based on current MR gate state
- keep human-authored reviewer notes outside the managed block
