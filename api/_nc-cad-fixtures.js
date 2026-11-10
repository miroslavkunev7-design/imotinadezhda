// ИМОТИ НАДЕЖДА · TASK-009 · служебни тестови файлове (TEST-…), генерирани програмно. Не са реален проект, сграда или апартамент.
// Само за тестовете (името започва с „_“ → не е Vercel функция).
"use strict";
const L = require("./_nc-cad-lib.js");

/* кутия [x0..x1]×[y0..y1]×[z0..z1] → 8 върха, 12 триъгълника */
function box(x0, y0, z0, x1, y1, z1) {
  const v = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const f = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
  return { v: Float32Array.from(v), f: Uint16Array.from(f), min: [x0, y0, z0], max: [x1, y1, z1] };
}
/* GLB от списък възли: [{ name, extras, box:[…6], color }] (+ опции за нарочно счупване) */
function glb(nodes, o) {
  o = o || {};
  const bin = [], views = [], accessors = [], meshes = [], gnodes = [{ name: "model", children: [] }], materials = [];
  let off = 0;
  const push = (buf, target) => { const pad = (4 - (off % 4)) % 4; if (pad) { bin.push(Buffer.alloc(pad)); off += pad; } views.push(Object.assign({ buffer: 0, byteOffset: off, byteLength: buf.length }, target ? { target } : {})); bin.push(buf); off += buf.length; return views.length - 1; };
  nodes.forEach((n) => {
    const b = box.apply(null, n.box);
    accessors.push({ bufferView: push(Buffer.from(b.v.buffer), 34962), componentType: 5126, count: 8, type: "VEC3", min: b.min, max: b.max });
    accessors.push({ bufferView: push(Buffer.from(b.f.buffer), 34963), componentType: 5123, count: 36, type: "SCALAR" });
    materials.push({ pbrMetallicRoughness: { baseColorFactor: n.color || [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.85 }, doubleSided: true });
    meshes.push({ primitives: [{ attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: materials.length - 1, mode: 4 }] });
    gnodes.push(Object.assign({ name: n.name, mesh: meshes.length - 1 }, n.extras ? { extras: n.extras } : {}));
    gnodes[0].children.push(gnodes.length - 1);
  });
  const pad = (4 - (off % 4)) % 4; if (pad) { bin.push(Buffer.alloc(pad)); off += pad; }
  const g = { asset: { version: "2.0", generator: L.GENERATOR }, scene: 0, scenes: [{ nodes: [0] }], nodes: gnodes, meshes, materials, accessors, bufferViews: views, buffers: [{ byteLength: off }] };
  if (o.mutate) o.mutate(g);
  let js = Buffer.from(JSON.stringify(g), "utf8"); if (js.length % 4) js = Buffer.concat([js, Buffer.alloc(4 - (js.length % 4), 0x20)]);
  const body = Buffer.concat(bin), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(o.version || 2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
  jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(body.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, js, bh, body]);
}
/* служебна сграда 12 × 6 × 8 m (Y нагоре): обвивка, 2 етажа, 2 обекта */
function testModel(ids, o) {
  ids = ids || {};
  return glb([
    { name: "floor_1", box: [-6, 0, -4, 6, 3, 4], extras: { floor_id: ids.f1 || "testfloor00000000000000000000001", floor_level: 1 }, color: [0.85, 0.82, 0.78, 1] },
    { name: "floor_2", box: [-6, 3, -4, 6, 6, 4], extras: { floor_id: ids.f2 || "testfloor00000000000000000000002", floor_level: 2 }, color: [0.85, 0.82, 0.78, 1] },
    { name: "unit_TEST-101", box: [-5.5, 0.2, -3.5, -0.2, 2.8, 3.5], extras: { unit_id: ids.u1 || "testunit101000000000000000000000", unit_code: "TEST-101" }, color: [0.9, 0.88, 0.84, 1] },
    { name: "unit_TEST-201", box: [0.2, 3.2, -3.5, 5.5, 5.8, 3.5], extras: { unit_id: ids.u2 || "testunit201000000000000000000000", unit_code: "TEST-201" }, color: [0.9, 0.88, 0.84, 1] }
  ], o);
}
/* началото на файл по формат – за разпознаването по съдържание */
const HEADS = {
  ifc: Buffer.from("ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');\nFILE_NAME('TEST.ifc','2026-01-01T00:00:00',(''),(''),'TEST','TEST','');\nFILE_SCHEMA(('IFC4'));\nENDSEC;\nDATA;\n#1=IFCPROJECT('TEST',$,'TEST',$,$,$,$,$,$);\nENDSEC;\nEND-ISO-10303-21;\n"),
  ifc2x3: Buffer.from("ISO-10303-21;\nHEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('','',(''),(''),'','','');FILE_SCHEMA(('IFC2X3'));ENDSEC;DATA;ENDSEC;END-ISO-10303-21;"),
  dxf: Buffer.from("  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1032\n  9\n$INSUNITS\n 70\n     4\n  0\nENDSEC\n  0\nEOF\n"),
  dxfComment: Buffer.from("999\nTEST comment\n  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n  0\nEOF\n"),
  dxfBinary: Buffer.concat([Buffer.from("AutoCAD Binary DXF\r\n\x1a\0", "latin1"), Buffer.alloc(40)]),
  dwg2018: Buffer.concat([Buffer.from("AC1032"), Buffer.alloc(120)]),
  dwg2000: Buffer.concat([Buffer.from("AC1015"), Buffer.alloc(120)]),
  dwgUnknown: Buffer.concat([Buffer.from("AC1099"), Buffer.alloc(120)]),
  pdf: Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog >>\nendobj\n", "latin1"),
  gltf: Buffer.from('{"asset":{"version":"2.0","generator":"TEST"},"buffers":[{"uri":"TEST.bin","byteLength":4}]}'),
  zip: Buffer.concat([Buffer.from([0x50, 0x4b, 3, 4]), Buffer.alloc(60)]),
  ifcxml: Buffer.from('<?xml version="1.0"?>\n<ifc:ifcXML xmlns:ifc="http://www.buildingsmart-tech.org/ifcXML/IFC4/final"></ifc:ifcXML>'),
  jpeg: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16]), Buffer.from("JFIF\0"), Buffer.alloc(60)]),
  png: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), Buffer.alloc(60)]),
  exe: Buffer.concat([Buffer.from("MZ"), Buffer.alloc(100, 1)]),
  empty: Buffer.alloc(0)
};
module.exports = { box, glb, testModel, HEADS };
