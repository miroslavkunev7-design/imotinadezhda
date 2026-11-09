"use strict";
const assert = require("assert");
const S = require("./_storage-access.js");

assert.strictEqual(S.safeStoragePath("ted-chat/2026-11/abc.jpg"), "ted-chat/2026-11/abc.jpg");
assert.strictEqual(S.safeStoragePath("/nd-files/clients/abc/chat/file.pdf"), "clients/abc/chat/file.pdf");
assert.strictEqual(S.safeStoragePath("../secrets"), null);
assert.strictEqual(S.safeStoragePath("other/bucket/file.jpg"), null);
assert.strictEqual(S.safeStoragePath("ted-chat/a\\b"), null);

const signed = "https://hyvwfsmjbaynozceookv.supabase.co/storage/v1/object/sign/nd-files/ted-chat/2026-11/a.jpg?token=eyJhbGciOiJIUzI1NiJ9.e30.sig";
assert.strictEqual(S.pathFromReference(signed), "ted-chat/2026-11/a.jpg");
assert.strictEqual(S.pathFromReference("https://evil.example/nd-files/ted-chat/a.jpg"), null);

assert.strictEqual(S.isJwtFailure(403, '{"message":"InvalidJWT"}'), true);
assert.strictEqual(S.isJwtFailure(401, "invalid jwt"), true);
assert.strictEqual(S.isJwtFailure(404, "Object not found"), false);

assert.strictEqual(S.mimeFromName("Договор.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
assert.strictEqual(S.mimeFromName("pack.pdf"), "application/pdf");
const cd = S.contentDisposition("Превод.pdf", true);
assert.ok(cd.startsWith("attachment;"));
assert.ok(cd.includes("filename*=UTF-8''"));
assert.ok(!cd.includes("\n"));

console.log("storage-access tests ok");
