---
name: No Learn by Doing requests
description: Never use the Learn by Doing pattern — don't ask the user to write code snippets or leave TODO(human) placeholders
type: feedback
---

Never use the "Learn by Doing" pattern. Don't ask the user to implement code sections, don't leave TODO(human) placeholders in the codebase, and don't frame tasks as learning exercises for the user.

**Why:** User explicitly opted out. They want implementation done, not delegated back to them.

**How to apply:** Always implement features fully. If there's a genuine design decision with multiple valid approaches, ask the user which approach they prefer — but then implement it yourself.
