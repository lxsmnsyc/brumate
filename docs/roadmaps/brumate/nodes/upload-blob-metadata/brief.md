---
id: upload-blob-metadata
title: "Server function uploads keep the metadata of files and blobs"
status: active
priority: must
type: hotfix
outline: false
milestone: 0.4.3
target: main
from:
size: S
spike: false
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-02
spent:
owns: []
shared:
  - .changeset/*.md
  - packages/brumate/src/runtime/serial.ts
  - packages/brumate/test/shared.test.ts
reserves: []
provides: []
depends_on: []
---

# Server function uploads keep the metadata of files and blobs

## Goal

A file or blob passed to a server function arrives with its own type, name and `lastModified`, and a blob stays a `Blob`. Today every multipart part arrives as a `File`, an empty type becomes `application/octet-stream`, `lastModified` is the parse time, and `%22` in a name decodes to `"`.

## Context

- Built on branch fix/upload-blob-metadata (f2e4e848, 2026-11-02) from `main`, outside the roadmap; added here as a 0.4.3 hotfix.
- The upload node carries the type, and for a file the name and `lastModified`; the server rebuilds the value over the part's bytes. A node with only the index, from an older page, still reads as the part.

## Acceptance

- [ ] Tests in packages/brumate/test/shared.test.ts send the form through a `Request`, and fail on `main`.
- [ ] A patch changeset for brumate.
- [ ] A fresh review, and CI green on the PR to `main`.

## Sizing

S: one serial plugin and its tests.
