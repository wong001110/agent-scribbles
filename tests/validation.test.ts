import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMessage, validateKey, linkParts, WallError } from "../src/lib/validation";
import { boundedBody } from "../src/lib/http";

test("normalizes anonymous text and preserves emoji and line breaks", () => {
  assert.deepEqual(validateMessage({name:"  ",message:"  hello 👋\r\n世界  "}),{name:"anonymous",message:"hello 👋\n世界",clientId:undefined});
  assert.equal(Array.from(validateMessage({message:"🚀".repeat(1000)}).message).length,1000);
  assert.throws(() => validateMessage({message:"🚀".repeat(1001)}),WallError);
});
test("rejects blank, malformed, multiline names and dangerous controls", () => {
  for (const body of [null,[],{message:12},{message:" "},{message:"ok",name:"a\nb"},{message:"x\u0000"},{message:"x\u202e"},{message:"ok",client_id:"invalid"}]) assert.throws(() => validateMessage(body),WallError);
  assert.equal(validateMessage({message:"👩‍💻\tlooks good"}).name,"anonymous");
});
test("idempotency keys are bounded and validated", () => {
  assert.equal(validateKey(null),null);
  assert.equal(validateKey("12345678-abcd"),"12345678-abcd");
  for (const key of ["short","x".repeat(129),"eight /? chars"]) assert.throws(() => validateKey(key),WallError);
});
test("only HTTP links without credentials become anchors, preserving text", () => {
  const text = '<img src=x onerror=alert(1)> javascript:alert(1) https://example.com/a. https://user:pass@example.com/';
  const parts = linkParts(text);
  assert.equal(parts.map(p=>p.text).join(""),text);
  assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),["https://example.com/a"]);
});
test("body limit applies to actual bytes even without Content-Length", async () => {
  const good = new Request("https://example.com",{method:"POST",body:"hello 世界"});
  assert.equal(await boundedBody(good),"hello 世界");
  const large = new Request("https://example.com",{method:"POST",body:"a".repeat(16385)});
  await assert.rejects(boundedBody(large),(e:unknown) => e instanceof WallError && e.status === 413);
  const declared = new Request("https://example.com",{method:"POST",body:"x",headers:{"Content-Length":"20000"}});
  await assert.rejects(boundedBody(declared),(e:unknown) => e instanceof WallError && e.status === 413);
});
