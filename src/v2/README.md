# Cercis v2

This directory is the staged redesign of Cercis.

## Architecture

Telegram webhook → v2 entrypoint → update classifier → callback/message router → services → D1

Production `main` is intentionally unchanged while v2 is developed and tested on `redesign/v2`.

## Rules

- `/start` must be handled before any D1 query.
- Callback handling is isolated from message handling.
- D1 schema is preserved; no destructive migration is part of the redesign.
- Existing business logic is migrated incrementally, not duplicated blindly.
