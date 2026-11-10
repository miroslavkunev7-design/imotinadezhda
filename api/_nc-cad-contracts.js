// ИМОТИ НАДЕЖДА · Ново строителство · TASK-009 · договори на инструментите за CAD/BIM проверка и 3D модели.
// Зарежда се от api/_nc-contracts.js с един ред (без промяна на останалите договори там) и допълва/уточнява:
//   cad.inspect, models.request, models.publish (вече обявени в TASK-002) + models.get, models.unpublish (нови).
// Не е отделна Vercel функция (името започва с „_“). Изпълнението е в api/_nc-cad.js.
"use strict";

module.exports = function cadContracts(h) {
  const { schema, S, pathInProject, patterns } = h;
  const id = (o) => S("string", Object.assign({ pattern: patterns.ID, max: 64 }, o));
  const confirm = S("literalTrue", { required: true });
  const path = S("string", { required: true, pattern: patterns.PRIVATE_PATH, noDotDot: true, max: 400 });
  const sameProject = (d) => (pathInProject(d.path, d.project_id) ? [] : ["файлът е от друг проект"]);
  // изрично съответствие „елемент от файла → етаж / обект“ (никога по картинка): ref = IFC GlobalId, точно име, слой (DXF) или име на възел (GLB)
  const REF = S("string", { min: 1, max: 120 });
  const mapping = S("object", { fields: {
    storeys: S("array", { max: 250, items: { ref: S("string", { required: true, min: 1, max: 120 }), level: S("int", { required: true, min: -5, max: 200 }) } }),
    units: S("array", { max: 3000, items: { code: S("string", { required: true, pattern: patterns.UNIT_CODE, max: 20 }), refs: S("array", { required: true, min: 1, max: 400, items: REF }) } }),
    control: S("array", { max: 20, items: { label: S("string", { required: true, min: 1, max: 80 }), axis: S("string", { required: true, enum: ["length", "width", "height"] }), meters: S("number", { required: true, gt: 0, max: 2000 }) } })
  } });

  return {
    "cad.inspect": {
      role: "admin",
      description: "Проверява качен CAD/BIM/PDF файл БЕЗ конверсия: истински формат по съдържание (не по име), версия, единици, слоеве/блокове/външни препратки (DXF), етажи и коти (IFC), векторен или сканиран (PDF), мрежи/материали/текстури (GLB) и дали от него може да се направи 3D модел. Файлът трябва вече да е в projects/<project_id>/private/(cad|imports|plans|units)/…. Тежка задача – върши я външният изпълнител; връща job_id веднага → следи с jobs.status, резултат с jobs.result. PDF и 2D чертеж НЕ стават 3D модел; сканиран PDF не е CAD. Повтор за същия файл връща същата задача (rerun:true = нова проверка).",
      input: schema({ project_id: id({ required: true }), path, rerun: S("boolean") }, sameProject),
      output: "{ ok, job_id, state:'queued'|…, idempotent, created, dispatched, format, bytes, correlation_id }", errors: [400, 403, 404, 409, 503],
      idem: "idempotency_key = 'cad_inspect:' + project_id + ':' + sha256 на файла [+ ':r<n>' при rerun] – същият ключ като заявката от импорта (imports.apply → downstream)"
    },
    "models.request": {
      role: "admin",
      description: "Стартира конверсия на ПРОВЕРЕН (cad.inspect → готово, „може 3D“) файл към 3D модел за браузър (GLB) за сграда: IFC, 3D DXF или GLB. DWG – само ако изпълнителят има разрешен конвертор, иначе искай DXF/IFC. Геометрия не се измисля: от PDF, снимка или 2D чертеж модел не се прави. mapping (по избор) = изрично съответствие етаж/обект: storeys[{ref,level}], units[{code,refs[]}], control[{label,axis(length|width|height),meters}] – контролни размери от чертежите, с които се сверява моделът. Връща job_id; резултатът е нова версия в състояние „чака преглед“ – публикува се отделно с models.publish.",
      input: schema({ project_id: id({ required: true }), building_id: id({ required: true }), path, mapping, rerun: S("boolean") }, (d) => {
        const e = sameProject(d), seen = new Set();
        for (const u of (d.mapping && d.mapping.units) || []) { const k = u.code.toLocaleUpperCase("bg"); if (seen.has(k)) e.push("кодът " + u.code + " е подаден два пъти в mapping.units"); seen.add(k); }
        const lv = new Set(); for (const s of (d.mapping && d.mapping.storeys) || []) { if (lv.has(s.ref)) e.push("етажът " + s.ref + " е подаден два пъти в mapping.storeys"); lv.add(s.ref); }
        return e;
      }),
      output: "{ ok, job_id, state, idempotent, created, dispatched, correlation_id }", errors: [400, 403, 404, 409, 503],
      idem: "idempotency_key = 'cad_convert:' + building_id + ':' + sha256 на файла [+ ':m<хеш на mapping>'] [+ ':r<n>' при rerun]"
    },
    "models.publish": {
      role: "admin",
      description: "Прави ПРЕГЛЕДАНАТА от човек версия на 3D модела публична за сградата (изисква confirm:true). Предишната публикувана версия се пази и може да се върне: подай job_id на старата версия + rollback:true. expected_published_version (0 = няма публикувана) пази от едновременна промяна → 409. Публиката получава само оптимизирания GLB през /model/<сграда> (подписан адрес за 60 s), никога оригиналния файл.",
      input: schema({ job_id: S("uuid", { required: true }), building_id: id({ required: true }), confirm, expected_published_version: S("int", { min: 0, max: 100000 }), rollback: S("boolean") }),
      output: "{ building_id, model_public:true, version, previous_version, replayed }", errors: [400, 403, 404, 409, 503],
      idem: "job_id: повтор върху вече публикуваната версия връща същото; expected_published_version → NC409 при чужда промяна; по-стара върху по-нова само с rollback:true"
    },
    "models.unpublish": {
      role: "admin",
      description: "Сваля 3D модела на сграда от публичния сайт (версията остава и може да се публикува отново). Вход: {building_id*, expected_published_version*, confirm*}.",
      input: schema({ building_id: id({ required: true }), expected_published_version: S("int", { required: true, min: 0, max: 100000 }), confirm }),
      output: "{ building_id, model_public:false, previous_version, changed }", errors: [400, 403, 404, 409, 503], idem: "expected_published_version → NC409 при чужда промяна; повтор без публикуван модел не променя нищо"
    },
    "models.get": {
      role: "staff",
      description: "Версиите на 3D модела на сграда: състояние (чака преглед / публикуван / свален / отхвърлен), вид точност (exact / verified / conceptual), размер, триъгълници, колко етажа и обекта са свързани, отчет от проверката и съответствието. preview:true връща и адрес за преглед на избраната версия (важи 60 s, само за екипа). Без пътища към оригинални файлове.",
      input: schema({ building_id: id({ required: true }), version: S("int", { min: 1, max: 100000 }), preview: S("boolean") }),
      output: "{ building_id, published_version, versions:[{ version, status, fidelity, bytes, triangles, floors_mapped, units_mapped, job_id, created_at }], selected:{ version, report, mapping, preview_url? } }", errors: [400, 404, 503], idem: "само четене"
    }
  };
};
