// 用 node 验证移植后的 EPUB 生成逻辑（与浏览器同一份 epub.js）。
import { makeEpub } from "../epub.js";
import { writeFileSync } from "node:fs";

const title = "测试网页标题";
const blocks = [
  { type: "h", text: "第一节 简介" },
  { type: "p", text: "这是一段正文，用来验证 EPUB 生成是否能正常工作。" },
  { type: "p", text: "第二段正文，包含 <特殊> & 字符需要转义。" },
  { type: "img", ext: "png", bytes: new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]) },
  { type: "h", text: "第二节 结尾" },
  { type: "p", text: "最后一段。" }
];

const epub = makeEpub(title, blocks);
writeFileSync("D:/小红书小工具开发/edge-extension/test/edge_test.epub", Buffer.from(epub));
console.log("EPUB bytes:", epub.length, "-> edge_test.epub");
