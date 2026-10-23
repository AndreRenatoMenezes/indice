import { describe, expect, it } from "vitest";
import { classifyCredential } from "./credential.js";

const jwt = [
  "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9",
  "eyJzdWIiOiJ1LTEiLCJlbWFpbCI6ImFAYi5jb20ifQ",
  "c2lnbmF0dXJl",
].join(".");

describe("classifyCredential", () => {
  it("X-Api-Key tem prioridade e vira apiKey", () => {
    expect(classifyCredential({ "x-api-key": "chave", authorization: `Bearer ${jwt}` })).toEqual({
      kind: "apiKey",
      value: "chave",
    });
  });

  it("Bearer com três segmentos base64url é JWT", () => {
    expect(classifyCredential({ authorization: `Bearer ${jwt}` })).toEqual({ kind: "jwt", value: jwt });
  });

  it("Bearer de chave de API continua apiKey (compatibilidade dos scripts)", () => {
    expect(classifyCredential({ authorization: "Bearer dev-local-key" })).toEqual({
      kind: "apiKey",
      value: "dev-local-key",
    });
  });

  it("três segmentos com caractere fora de base64url viram apiKey", () => {
    expect(classifyCredential({ authorization: "Bearer aaa.bbb.ccc$" })).toEqual({
      kind: "apiKey",
      value: "aaa.bbb.ccc$",
    });
  });

  it("sem credencial devolve null", () => {
    expect(classifyCredential({})).toBeNull();
    expect(classifyCredential({ authorization: "" })).toBeNull();
    expect(classifyCredential({ authorization: "Basic abc" })).toBeNull();
    expect(classifyCredential({ authorization: "Bearer " })).toBeNull();
  });

  it("aceita o header como lista (primeiro valor)", () => {
    expect(classifyCredential({ "x-api-key": ["a", "b"] })).toEqual({ kind: "apiKey", value: "a" });
  });
});
