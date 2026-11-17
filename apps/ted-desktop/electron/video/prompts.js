// Rooms, the walk prompt and the camera moves of the site's AI video skill, copied verbatim from
// mobile/crm/crm-video.js (lines 42–58), plus its FATAL pattern: the same engines, prompts and stop rules.
export const ROOMS = [["out", "Отвън", "outside"], ["entry", "Вход", "the entrance"], ["living", "Хол", "the living room"], ["dining", "Трапезария", "the dining area"], ["kitchen", "Кухня", "the kitchen"], ["stairs", "Стълбище", "the staircase"], ["bedroom", "Спалня", "the bedroom"], ["bath", "Баня", "the bathroom"], ["patio", "Тераса", "the covered patio"], ["pool", "Басейн", "the pool"], ["garden", "Двор", "the garden"], ["final", "Краен кадър", "the final outdoor view"], ["other", "Друго", "the next room"]];
export const WALK_BASE = "Smoothly blend from the first image into the second image and keep the camera stable and make the transitions seamless. Then, follow the camera path through the property.";
export function roomEn(id) { const r = ROOMS.filter((x) => x[0] === id)[0]; return r ? r[2] : "the next room"; }
export function roomBg(id) { const r = ROOMS.filter((x) => x[0] === id)[0]; return r ? r[1] : "Друго"; }
export function move(a, b) {
  if (a === "out" && b === "entry") return "Start outside and move towards the entrance.";
  if (b === "final") return "Move away from " + roomEn(a) + " and finish with a final outdoor view of the property.";
  if (a === "entry") return "Go through the entrance and move inside with a slight turn to the right into " + roomEn(b) + ".";
  if (a === "living" && b === "kitchen") return "Pull back through the living room, then push forward into the kitchen.";
  if (a === "living") return "Pull back through the living room, then glide forward into " + roomEn(b) + ".";
  if (b === "patio") return "Move out from " + roomEn(a) + " onto the covered patio.";
  if (b === "pool") return "Continue outside from " + roomEn(a) + " towards the pool.";
  if (a === "out") return "Start outside and move towards " + roomEn(b) + ".";
  return "Move forward from " + roomEn(a) + " into " + roomEn(b) + ".";
}
export const FATAL = /Липсва|няма валиден ключ|Няма ключ|Непознат двигател|401|403|402|insufficient|credit|billing|quota|not available on the free|paid tier|PERMISSION_DENIED|API key/i;
export const CONC = 3;
